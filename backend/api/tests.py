import json
from datetime import timedelta
from unittest.mock import MagicMock, patch
from urllib.error import HTTPError
from urllib.parse import parse_qs

from django.contrib.auth import get_user_model
from django.core import mail
from django.core.mail.backends.smtp import EmailBackend
from django.db.models.deletion import ProtectedError
from django.test import SimpleTestCase, override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase, APIClient

from .models import (
    Blog,
    BlogComment,
    Booking,
    ContactMessage,
    Destination,
    Passenger,
    PromoCode,
    Safari,
    Subscriber,
    Testimonial,
    TripDeparture,
    WaitlistEntry,
)
from .mpesa import _transaction_type
from .subscriber_campaigns import send_subscriber_sms


class MpesaConfigurationTests(SimpleTestCase):
    @override_settings(MPESA_ENVIRONMENT='sandbox', MPESA_TRANSACTION_TYPE='')
    def test_sandbox_defaults_to_paybill_transaction_type(self):
        self.assertEqual(_transaction_type(), 'CustomerPayBillOnline')

    @override_settings(MPESA_ENVIRONMENT='production', MPESA_TRANSACTION_TYPE='')
    def test_production_defaults_to_buy_goods_transaction_type_for_till(self):
        self.assertEqual(_transaction_type(), 'CustomerBuyGoodsOnline')


class PublicContentAccessTests(APITestCase):
    def setUp(self):
        self.visible_safari = Safari.objects.create(
            title='Published safari',
            description='Details',
            location='Kenya',
            price='1200.00',
            visible=True,
        )
        self.hidden_safari = Safari.objects.create(
            title='Hidden safari',
            description='Private draft',
            location='Kenya',
            price='1500.00',
            visible=False,
        )
        Destination.objects.create(
            name='Hidden destination',
            slug='hidden-destination',
            category='iconic_safaris',
            hook='Private draft.',
            visible=False,
        )
        Blog.objects.create(title='Published story', content='Story', status='published')
        Blog.objects.create(title='Draft story', content='Draft', status='draft')
        Testimonial.objects.create(
            full_name='Featured guest',
            message='Wonderful trip',
            is_featured=True,
            is_verified=True,
        )
        Testimonial.objects.create(
            full_name='Unapproved guest',
            message='Pending moderation',
            is_featured=False,
        )
        ContactMessage.objects.create(
            full_name='Private sender',
            email='private@example.com',
            message='Private inquiry',
        )
        Subscriber.objects.create(email='private@example.com')

    def test_public_reads_only_show_published_website_content(self):
        safaris = self.client.get('/api/safaris/').data['results']
        destinations = self.client.get('/api/destinations/').data['results']
        blogs = self.client.get('/api/blogs/').data['results']
        testimonials = self.client.get('/api/testimonials/').data['results']

        self.assertEqual([item['id'] for item in safaris], [self.visible_safari.id])
        self.assertNotIn('Hidden destination', [item['name'] for item in destinations])
        mara = next(item for item in destinations if item['slug'] == 'maasai-mara-national-reserve')
        self.assertEqual(mara['category_label'], 'Iconic Safaris')
        self.assertEqual([item['title'] for item in blogs], ['Published story'])
        self.assertEqual([item['full_name'] for item in testimonials], ['Featured guest'])
        featured = self.client.get('/api/testimonials/featured/').data
        self.assertEqual([item['full_name'] for item in featured], ['Featured guest'])
        settings_response = self.client.get('/api/settings/website_settings/')
        self.assertEqual(settings_response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            settings_response.data['tiktok'],
            'https://www.tiktok.com/@simba.grand.tours',
        )
        self.assertIn('Information we collect', settings_response.data['privacy_policy'])
        self.assertIn('Bookings and payments', settings_response.data['terms_conditions'])

    def test_public_users_cannot_manage_destinations(self):
        response = self.client.post(
            '/api/destinations/',
            {
                'name': 'Private destination',
                'slug': 'private-destination-test',
                'category': 'iconic_safaris',
                'hook': 'A private draft.',
            },
            format='json',
        )
        self.assertIn(response.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))

    def test_seeded_destination_catalog_includes_lake_nakuru_photo_and_copy(self):
        response = self.client.get('/api/destinations/')
        destinations = response.data['results']
        lake_nakuru = next(item for item in destinations if item['slug'] == 'lake-nakuru-national-park')

        self.assertEqual(len(destinations), 16)
        self.assertEqual(lake_nakuru['images'], ['/images/lakenakuru.jpg'])
        self.assertEqual(len(lake_nakuru['highlights']), 3)
        self.assertIsNone(lake_nakuru['starting_price'])
        mara = next(item for item in destinations if item['slug'] == 'maasai-mara-national-reserve')
        migration = next(item for item in destinations if item['slug'] == 'serengeti-great-migration')
        malindi = next(item for item in destinations if item['slug'] == 'malindi')
        mombasa = next(item for item in destinations if item['slug'] == 'mombasa')
        diani = next(item for item in destinations if item['slug'] == 'diani-beach-south-coast')
        lamu = next(item for item in destinations if item['slug'] == 'lamu-island')
        self.assertEqual(mara['images'], [])
        self.assertEqual(migration['images'], [])
        self.assertEqual(
            {diani['category_label'], malindi['category_label'], mombasa['category_label'], lamu['category_label']},
            {'Beach and Coastal Escapes'},
        )
        self.assertEqual(malindi['package_ids'], [])
        self.assertEqual(mombasa['package_ids'], [])
        lake_naivasha = next(item for item in destinations if item['slug'] == 'lake-naivasha-hells-gate')
        self.assertEqual(lake_naivasha['name'], 'Lake Naivasha and Hell’s Gate')
        self.assertFalse(any('&' in item['name'] for item in destinations))

    def test_private_inbox_and_subscriber_records_are_not_public(self):
        for endpoint in ('/api/contact-messages/', '/api/subscribers/'):
            response = self.client.get(endpoint)
            self.assertIn(response.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))

    def test_public_forms_can_submit_without_authentication(self):
        contact = self.client.post(
            '/api/contact-messages/',
            {'full_name': 'Guest', 'email': 'guest@example.com', 'message': 'Hello'},
            format='json',
        )
        review = self.client.post(
            '/api/testimonials/',
            {
                'full_name': 'Guest',
                'email': 'guest@example.com',
                'booking_reference': 'SGT-INVALID',
                'message': 'Great',
                'rating': 5,
            },
            format='json',
        )
        subscriber = self.client.post(
            '/api/subscribers/',
            {'email': 'newsletter@example.com'},
            format='json',
        )

        self.assertEqual(contact.status_code, status.HTTP_201_CREATED)
        self.assertEqual(review.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(subscriber.status_code, status.HTTP_201_CREATED)

    def test_subscriber_sms_opt_in_requires_a_valid_phone_and_records_consent(self):
        missing_phone = self.client.post(
            '/api/subscribers/',
            {'email': 'sms@example.com', 'sms_opt_in': True},
            format='json',
        )
        self.assertEqual(missing_phone.status_code, status.HTTP_400_BAD_REQUEST)

        response = self.client.post(
            '/api/subscribers/',
            {
                'email': 'sms@example.com',
                'phone': '0712 345 678',
                'sms_opt_in': True,
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['phone'], '+254712345678')
        self.assertTrue(response.data['sms_opt_in'])
        self.assertIsNotNone(response.data['sms_opt_in_at'])

    def test_public_blog_submission_requires_staff_approval_before_publication(self):
        response = self.client.post(
            '/api/blogs/',
            {
                'title': 'A guest safari story',
                'category': 'Safari Story',
                'author': 'Amina Guest',
                'location': 'Maasai Mara',
                'content': 'We saw elephants at sunrise.',
                'status': 'published',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['status'], 'pending_review')
        self.assertNotIn(
            'A guest safari story',
            [blog['title'] for blog in self.client.get('/api/blogs/').data['results']],
        )

        staff_user = get_user_model().objects.create_user(
            username='blog-approver',
            password='test-password',
            is_staff=True,
        )
        self.client.force_authenticate(user=staff_user)
        staff_blogs = self.client.get('/api/blogs/').data['results']
        self.assertIn('A guest safari story', [blog['title'] for blog in staff_blogs])
        approval = self.client.patch(
            f"/api/blogs/{response.data['id']}/",
            {'status': 'published'},
            format='json',
        )
        self.assertEqual(approval.status_code, status.HTTP_200_OK)

        self.client.force_authenticate(user=None)
        published_titles = [blog['title'] for blog in self.client.get('/api/blogs/').data['results']]
        self.assertIn('A guest safari story', published_titles)

    def test_blog_image_is_optional_and_accepts_valid_image_data(self):
        image = (
            'data:image/png;base64,'
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0y8AAAAASUVORK5CYII='
        )
        without_image = self.client.post(
            '/api/blogs/',
            {
                'title': 'A story without an image',
                'author': 'Guest',
                'content': 'This story does not need a picture.',
            },
            format='json',
        )
        self.assertEqual(without_image.status_code, status.HTTP_201_CREATED)
        self.assertIn(without_image.data['image'], (None, ''))

        response = self.client.post(
            '/api/blogs/',
            {
                'title': 'A story with an optional image',
                'author': 'Guest',
                'content': 'Paragraph one.\n\nParagraph two.',
                'image': image,
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['image'], image)
        self.assertEqual(response.data['status'], 'pending_review')

    def test_public_blog_replies_require_staff_approval(self):
        blog = Blog.objects.get(title='Published story')
        response = self.client.post(
            '/api/blog-comments/',
            {
                'blog': blog.id,
                'name': 'Reader',
                'email': 'reader@example.com',
                'content': 'A helpful reply.',
                'status': 'approved',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['status'], 'pending_review')
        self.assertNotIn('email', response.data)
        self.assertEqual(
            self.client.get('/api/blog-comments/', {'blog': blog.id}).data['results'],
            [],
        )

        staff_user = get_user_model().objects.create_user(
            username='reply-approver',
            password='test-password',
            is_staff=True,
        )
        self.client.force_authenticate(user=staff_user)
        staff_comments = self.client.get('/api/blog-comments/').data['results']
        self.assertEqual(len(staff_comments), 1)
        self.assertEqual(staff_comments[0]['email'], 'reader@example.com')

        approval = self.client.patch(
            f"/api/blog-comments/{response.data['id']}/",
            {'status': 'approved'},
            format='json',
        )
        self.assertEqual(approval.status_code, status.HTTP_200_OK)

        self.client.force_authenticate(user=None)
        public_comments = self.client.get('/api/blog-comments/', {'blog': blog.id}).data['results']
        self.assertEqual([comment['content'] for comment in public_comments], ['A helpful reply.'])
        self.assertNotIn('email', public_comments[0])

        self.client.force_authenticate(user=staff_user)
        deletion = self.client.delete(f"/api/blog-comments/{response.data['id']}/")
        self.assertEqual(deletion.status_code, status.HTTP_204_NO_CONTENT)

        self.client.force_authenticate(user=None)
        self.assertEqual(
            self.client.get('/api/blog-comments/', {'blog': blog.id}).data['results'],
            [],
        )

    def test_public_cannot_reply_to_unpublished_blog(self):
        draft = Blog.objects.get(title='Draft story')
        response = self.client.post(
            '/api/blog-comments/',
            {
                'blog': draft.id,
                'name': 'Reader',
                'content': 'A reply to a draft.',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(BlogComment.objects.exists())

    def test_public_reviews_require_a_confirmed_booking_and_matching_email(self):
        safari = Safari.objects.create(
            title='Completed safari',
            description='Details',
            location='Kenya',
            price='20000.00',
        )
        departure = TripDeparture.objects.create(
            safari=safari,
            start_date='2030-07-01',
            seats_total=2,
            price_kes=20000,
        )
        booking = Booking.objects.create(
            departure=departure,
            full_name='Verified guest',
            email='verified@example.com',
            phone='0712345678',
            payment_phone='254712345678',
            participant_count=1,
            amount_kes=20000,
            status=Booking.Status.CONFIRMED,
        )
        payload = {
            'full_name': 'Verified guest',
            'email': 'verified@example.com',
            'booking_reference': booking.reference,
            'message': 'Great trip',
            'rating': 5,
            'is_featured': True,
        }

        mismatch = self.client.post(
            '/api/testimonials/',
            {**payload, 'email': 'other@example.com'},
            format='json',
        )
        submitted = self.client.post('/api/testimonials/', payload, format='json')
        duplicate = self.client.post('/api/testimonials/', payload, format='json')

        self.assertEqual(mismatch.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(submitted.status_code, status.HTTP_201_CREATED)
        self.assertTrue(submitted.data['is_verified'])
        self.assertFalse(submitted.data['is_featured'])
        self.assertNotIn('email', submitted.data)
        self.assertNotIn('booking', submitted.data)
        self.assertEqual(duplicate.status_code, status.HTTP_409_CONFLICT)
        featured = APIClient().get('/api/testimonials/featured/').data
        self.assertEqual([item['full_name'] for item in featured], ['Featured guest'])

    def test_booking_details_are_optional_and_unverified_reviews_stay_private(self):
        submissions = [
            {},
            {'email': 'optional@example.com'},
            {'booking_reference': 'SGT-OPTIONAL'},
        ]

        for index, booking_details in enumerate(submissions):
            with self.subTest(booking_details=booking_details):
                response = self.client.post(
                    '/api/testimonials/',
                    {
                        'full_name': f'Unverified guest {index}',
                        'location': 'Nairobi',
                        'message': 'A good trip.',
                        'rating': 5,
                        'is_verified': True,
                        **booking_details,
                    },
                    format='json',
                )

                self.assertEqual(response.status_code, status.HTTP_201_CREATED)
                self.assertFalse(response.data['is_verified'])
                self.assertFalse(response.data['is_featured'])

        public_names = [
            item['full_name']
            for item in APIClient().get('/api/testimonials/').data['results']
        ]
        self.assertFalse(any(name.startswith('Unverified guest') for name in public_names))


class DestinationManagementTests(APITestCase):
    def setUp(self):
        self.staff_user = get_user_model().objects.create_user(
            username='destination-admin',
            password='test-password',
            is_staff=True,
        )
        self.safari = Safari.objects.create(
            title='Mara weekend',
            description='A short Mara trip.',
            location='Maasai Mara',
            price='32000.00',
        )

    def test_staff_can_create_destination_and_link_safari_packages(self):
        self.client.force_authenticate(user=self.staff_user)
        response = self.client.post(
            '/api/destinations/',
            {
                'name': 'Staff-created destination',
                'slug': 'staff-created-destination',
                'category': 'iconic_safaris',
                'badge': 'New',
                'duration': '2 Days',
                'hook': 'A memorable weekend in the wild.',
                'highlights': ['Sunrise game drive', 'Expert guide', 'Lodge stay'],
                'cta_label': 'Explore package',
                'starting_price': '32000.00',
                'images': ['/images/greatmigration.jpg'],
                'package_ids': [self.safari.id],
                'visible': True,
                'featured_on_home': True,
                'sort_order': 14,
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['package_ids'], [self.safari.id])
        self.assertEqual(response.data['starting_price'], '32000.00')
        self.assertEqual(response.data['category_label'], 'Iconic Safaris')


class SubscriberCampaignTests(APITestCase):
    def setUp(self):
        self.staff_user = get_user_model().objects.create_user(
            username='subscriber-campaign-admin',
            password='test-password',
            is_staff=True,
        )
        self.sms_subscriber = Subscriber.objects.create(
            email='sms-subscriber@example.com',
            phone='254712345678',
            sms_opt_in=True,
            sms_opt_in_at=timezone.now(),
        )
        self.email_subscriber = Subscriber.objects.create(email='email-subscriber@example.com')

    @override_settings(
        DEFAULT_FROM_EMAIL='updates@example.com',
        EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
        AFRICASTALKING_USERNAME='test-user',
        AFRICASTALKING_API_KEY='test-key',
    )
    @patch('api.views.send_subscriber_sms')
    def test_staff_can_send_both_channels_without_texting_non_opted_subscribers(self, send_sms):
        send_sms.return_value = {'attempted': 1, 'sent': 1, 'failed': 0}
        self.client.force_authenticate(user=self.staff_user)

        response = self.client.post(
            '/api/subscribers/send_update/',
            {
                'channel': 'both',
                'subject': 'Safari updates',
                'message': 'New trips are now available.',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['results']['email']['sent'], 2)
        self.assertEqual(response.data['results']['sms']['sent'], 1)
        self.assertEqual(len(mail.outbox), 2)
        send_sms.assert_called_once_with([self.sms_subscriber], 'New trips are now available.')

    def test_public_users_cannot_send_subscriber_campaigns(self):
        response = self.client.post(
            '/api/subscribers/send_update/',
            {'channel': 'sms', 'message': 'Update'},
            format='json',
        )
        self.assertIn(response.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))

    @override_settings(
        DEFAULT_FROM_EMAIL='updates@example.com',
        EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    )
    @patch('api.views.send_mail', side_effect=TimeoutError)
    def test_email_campaign_reports_smtp_timeout(self, send_mail):
        self.client.force_authenticate(user=self.staff_user)

        response = self.client.post(
            '/api/subscribers/send_update/',
            {
                'channel': 'email',
                'subject': 'Safari updates',
                'message': 'New trips are now available.',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['results']['email']['attempted'], 2)
        self.assertEqual(response.data['results']['email']['failed'], 2)
        self.assertEqual(
            response.data['results']['email']['errors'],
            ['Email provider failed to accept one or more messages.'],
        )
        self.assertEqual(send_mail.call_count, 2)

    @override_settings(
        DEFAULT_FROM_EMAIL='updates@example.com',
        EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    )
    @patch('api.views.send_mail')
    @patch('api.views.get_connection')
    def test_email_campaign_reuses_one_connection_for_individual_messages(self, get_connection, send_mail):
        connection = get_connection.return_value
        send_mail.return_value = 1
        self.client.force_authenticate(user=self.staff_user)

        response = self.client.post(
            '/api/subscribers/send_update/',
            {
                'channel': 'email',
                'subject': 'Safari updates',
                'message': 'New trips are now available.',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['results']['email']['sent'], 2)
        self.assertEqual(get_connection.call_count, 1)
        connection.open.assert_called_once_with()
        connection.close.assert_called_once_with()
        self.assertEqual(send_mail.call_count, 2)
        self.assertTrue(all(call.kwargs['connection'] is connection for call in send_mail.call_args_list))
        self.assertEqual(
            sorted(call.args[3][0] for call in send_mail.call_args_list),
            ['email-subscriber@example.com', 'sms-subscriber@example.com'],
        )

    def test_staff_can_add_phone_and_sms_consent_to_existing_subscriber(self):
        subscriber = Subscriber.objects.create(email='existing@example.com')
        self.client.force_authenticate(user=self.staff_user)

        response = self.client.patch(
            f'/api/subscribers/{subscriber.id}/',
            {'phone': '0712345678', 'sms_opt_in': True},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['phone'], '+254712345678')
        self.assertTrue(response.data['sms_opt_in'])
        self.assertIsNotNone(response.data['sms_opt_in_at'])


class SmtpTimeoutTests(SimpleTestCase):
    @override_settings(
        EMAIL_HOST='smtp.example.com',
        EMAIL_PORT=587,
        EMAIL_USE_TLS=False,
        EMAIL_TIMEOUT=15,
    )
    @patch('django.core.mail.backends.smtp.smtplib.SMTP')
    def test_smtp_backend_uses_configured_connection_timeout(self, smtp):
        backend = EmailBackend()
        backend.open()

        self.assertEqual(smtp.call_args.kwargs['timeout'], 15)

        backend.close()


class AfricaTalkingSmsTests(SimpleTestCase):
    @override_settings(
        AFRICASTALKING_USERNAME='test-user',
        AFRICASTALKING_API_KEY='test-key',
        AFRICASTALKING_ENVIRONMENT='sandbox',
        AFRICASTALKING_SENDER_ID='SIMBATEST',
    )
    @patch('api.subscriber_campaigns.urllib.request.urlopen')
    def test_sends_sms_to_provider_and_counts_accepted_recipients(self, urlopen):
        response_context = MagicMock()
        response_context.read.return_value = json.dumps({
            'SMSMessageData': {
                'Recipients': [
                    {'statusCode': 101},
                    {'statusCode': 102},
                ],
            },
        }).encode()
        urlopen.return_value.__enter__.return_value = response_context
        recipients = [
            Subscriber(phone='+254712345678'),
            Subscriber(phone='254711222333'),
        ]

        result = send_subscriber_sms(recipients, 'Safari update')

        request = urlopen.call_args.args[0]
        payload = parse_qs(request.data.decode())
        self.assertEqual(request.full_url, 'https://api.sandbox.africastalking.com/version1/messaging')
        self.assertEqual(request.get_header('Apikey'), 'test-key')
        self.assertEqual(payload['to'], ['+254712345678,+254711222333'])
        self.assertEqual(payload['from'], ['SIMBATEST'])
        self.assertEqual(result, {'attempted': 2, 'sent': 2, 'failed': 0, 'errors': []})

    @override_settings(
        AFRICASTALKING_USERNAME='test-user',
        AFRICASTALKING_API_KEY='test-key',
        AFRICASTALKING_ENVIRONMENT='production',
    )
    @patch('api.subscriber_campaigns.urllib.request.urlopen')
    def test_reports_recipient_rejection_codes_without_exposing_phone_numbers(self, urlopen):
        response_context = MagicMock()
        response_context.read.return_value = json.dumps({
            'SMSMessageData': {
                'Recipients': [
                    {'statusCode': 403, 'status': 'Rejected', 'number': '+254712345678'},
                ],
            },
        }).encode()
        urlopen.return_value.__enter__.return_value = response_context

        result = send_subscriber_sms([Subscriber(phone='254712345678')], 'Safari update')

        self.assertEqual(result['sent'], 0)
        self.assertEqual(result['failed'], 1)
        self.assertEqual(
            result['errors'],
            ['SMS provider rejected one or more recipients (status codes: 403).'],
        )
        self.assertNotIn('254712345678', str(result))

    @override_settings(
        AFRICASTALKING_USERNAME='test-user',
        AFRICASTALKING_API_KEY='test-key',
        AFRICASTALKING_ENVIRONMENT='production',
    )
    @patch('api.subscriber_campaigns.urllib.request.urlopen')
    def test_reports_http_status_when_provider_rejects_batch(self, urlopen):
        urlopen.side_effect = HTTPError(
            'https://api.africastalking.com/version1/messaging',
            401,
            'Unauthorized',
            None,
            None,
        )

        result = send_subscriber_sms([Subscriber(phone='254712345678')], 'Safari update')

        self.assertEqual(result['sent'], 0)
        self.assertEqual(result['failed'], 1)
        self.assertEqual(result['errors'], ['SMS provider rejected the request (HTTP 401).'])

class ContactMessageReplyTests(APITestCase):
    def setUp(self):
        self.contact_message = ContactMessage.objects.create(
            full_name='Amina Guest',
            email='amina@example.com',
            subject='Safari inquiry',
            message='Can you share more details?',
        )
        self.staff_user = get_user_model().objects.create_user(
            username='message-admin',
            password='test-password',
            is_staff=True,
        )
        self.reply_url = f'/api/contact-messages/{self.contact_message.id}/reply/'

    @override_settings(
        DEFAULT_FROM_EMAIL='support@example.com',
        EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    )
    def test_staff_reply_sends_email_to_contact_and_public_user_cannot_reply(self):
        unauthorized = self.client.post(self.reply_url, {'message': 'Thank you for reaching out.'}, format='json')
        self.assertIn(unauthorized.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))

        self.client.force_authenticate(user=self.staff_user)
        response = self.client.post(
            self.reply_url,
            {'message': 'Thank you for reaching out.'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ['amina@example.com'])
        self.assertEqual(mail.outbox[0].from_email, 'support@example.com')
        self.assertEqual(mail.outbox[0].subject, 'Re: Safari inquiry')
        self.assertIn('Thank you for reaching out.', mail.outbox[0].body)

    @override_settings(
        DEFAULT_FROM_EMAIL='',
        EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    )
    def test_reply_reports_when_email_is_not_configured(self):
        self.client.force_authenticate(user=self.staff_user)

        response = self.client.post(
            self.reply_url,
            {'message': 'Thank you for reaching out.'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertIn('Email sending is not configured', response.data['detail'])


class AdminContentAccessTests(APITestCase):
    def setUp(self):
        user_model = get_user_model()
        self.regular_user = user_model.objects.create_user(
            username='regular',
            password='test-password',
        )
        self.staff_user = user_model.objects.create_user(
            username='staff',
            password='test-password',
            is_staff=True,
        )
        self.safari = Safari.objects.create(
            title='Staff safari',
            description='Details',
            location='Kenya',
            price='1200.00',
        )
        self.testimonial = Testimonial.objects.create(
            full_name='New guest',
            message='A great experience',
            is_featured=False,
            is_verified=True,
        )

    def test_only_staff_can_edit_testimonial_text_before_publishing(self):
        url = f'/api/testimonials/{self.testimonial.id}/'
        payload = {'message': 'A great experience, truly', 'full_name': 'Jane Guest', 'rating': 4}

        self.assertIn(self.client.patch(url, payload, format='json').status_code, (401, 403, 404))
        self.client.force_authenticate(user=self.regular_user)
        self.assertIn(self.client.patch(url, payload, format='json').status_code, (401, 403, 404))

        self.client.force_authenticate(user=self.staff_user)
        invalid = self.client.patch(url, {'rating': 9}, format='json')
        edited = self.client.patch(url, payload, format='json')

        self.assertEqual(invalid.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(edited.status_code, status.HTTP_200_OK)
        self.testimonial.refresh_from_db()
        self.assertEqual(self.testimonial.message, 'A great experience, truly')
        self.assertEqual(self.testimonial.full_name, 'Jane Guest')
        self.assertEqual(self.testimonial.rating, 4)
        self.assertFalse(self.testimonial.is_featured)

    def test_non_staff_users_cannot_write_content(self):
        self.client.force_authenticate(user=self.regular_user)

        create_response = self.client.post(
            '/api/safaris/',
            {
                'title': 'Unauthorized safari',
                'description': 'Details',
                'location': 'Kenya',
                'price': '1000.00',
            },
            format='json',
        )
        update_response = self.client.patch(
            f'/api/safaris/{self.safari.id}/',
            {'visible': False},
            format='json',
        )
        settings_response = self.client.patch(
            '/api/settings/website_settings/',
            {'privacy_policy': 'Unauthorized edit'},
            format='json',
        )

        self.assertEqual(create_response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(update_response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(settings_response.status_code, status.HTTP_403_FORBIDDEN)
        self.safari.refresh_from_db()
        self.assertTrue(self.safari.visible)

    def test_staff_users_can_manage_content_and_private_records(self):
        self.client.force_authenticate(user=self.staff_user)

        response = self.client.patch(
            f'/api/safaris/{self.safari.id}/',
            {'visible': False, 'isSignature': True},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['is_signature'])
        self.assertEqual(self.client.get('/api/contact-messages/').status_code, status.HTTP_200_OK)
        self.assertEqual(self.client.get('/api/subscribers/').status_code, status.HTTP_200_OK)
        self.safari.refresh_from_db()
        self.assertTrue(self.safari.is_signature)

        featured_response = self.client.patch(
            f'/api/testimonials/{self.testimonial.id}/',
            {'is_featured': True},
            format='json',
        )
        self.assertEqual(featured_response.status_code, status.HTTP_200_OK)
        public_featured = APIClient().get('/api/testimonials/featured/').data
        self.assertEqual([item['full_name'] for item in public_featured], ['New guest'])

    def test_staff_can_verify_unverified_testimonials_before_featuring(self):
        testimonial = Testimonial.objects.create(
            full_name='Unverified guest',
            message='A good trip.',
            is_verified=False,
        )
        self.client.force_authenticate(user=self.staff_user)

        verification = self.client.patch(
            f'/api/testimonials/{testimonial.id}/',
            {'is_verified': True},
            format='json',
        )

        self.assertEqual(verification.status_code, status.HTTP_200_OK)
        self.assertTrue(verification.data['is_verified'])

        featuring = self.client.patch(
            f'/api/testimonials/{testimonial.id}/',
            {'is_featured': True},
            format='json',
        )

        self.assertEqual(featuring.status_code, status.HTTP_200_OK)
        public_featured = APIClient().get('/api/testimonials/featured/').data
        self.assertEqual([item['full_name'] for item in public_featured], ['Unverified guest'])

    def test_staff_can_feature_unverified_and_change_verification_without_unfeaturing(self):
        testimonial = Testimonial.objects.create(
            full_name='Guest', email='private@example.com', message='Great trip.', is_verified=False,
        )
        self.client.force_authenticate(user=self.staff_user)
        url = f'/api/testimonials/{testimonial.id}/'

        featured = self.client.patch(url, {'is_featured': True}, format='json')
        self.assertEqual(featured.status_code, status.HTTP_200_OK)
        for endpoint in ('/api/testimonials/', '/api/testimonials/featured/'):
            response = APIClient().get(endpoint)
            items = response.data['results'] if isinstance(response.data, dict) else response.data
            self.assertEqual(len(items), 1)
            self.assertFalse(items[0]['is_verified'])
            self.assertNotIn('email', items[0])
            self.assertNotIn('booking', items[0])

        for verified in (True, False):
            response = self.client.patch(url, {'is_verified': verified}, format='json')
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertTrue(response.data['is_featured'])
            self.assertEqual(APIClient().get('/api/testimonials/featured/').data[0]['is_verified'], verified)

        self.client.force_authenticate(user=self.regular_user)
        denied = self.client.patch(url, {'is_featured': False}, format='json')
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)
        self.client.force_authenticate(user=self.staff_user)
        self.client.patch(url, {'is_featured': False}, format='json')
        self.assertEqual(APIClient().get('/api/testimonials/featured/').data, [])

    def test_settings_accept_domains_without_a_scheme(self):
        self.client.force_authenticate(user=self.staff_user)
        response = self.client.patch(
            '/api/settings/website_settings/',
            {
                'website': 'www.simbagrandtours.com',
                'instagram': 'instagram.com/simba.grand.tours',
                'facebook': '',
                'tiktok': 'tiktok.com/@simba.grand.tours',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['website'], 'https://www.simbagrandtours.com')
        self.assertEqual(response.data['instagram'], 'https://instagram.com/simba.grand.tours')
        self.assertEqual(response.data['tiktok'], 'https://tiktok.com/@simba.grand.tours')

    def test_staff_can_update_legal_pages_visible_to_public(self):
        self.client.force_authenticate(user=self.staff_user)
        response = self.client.patch(
            '/api/settings/website_settings/',
            {
                'privacy_policy': '## Privacy updates\n\nUpdated privacy copy.',
                'terms_conditions': '## Booking updates\n\nUpdated terms copy.',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        public_settings = APIClient().get('/api/settings/website_settings/').data
        self.assertEqual(public_settings['privacy_policy'], '## Privacy updates\n\nUpdated privacy copy.')
        self.assertEqual(public_settings['terms_conditions'], '## Booking updates\n\nUpdated terms copy.')


@override_settings(ONLINE_PAYMENTS_ENABLED=True)
class BookingFlowTests(APITestCase):
    def setUp(self):
        self.safari = Safari.objects.create(
            title='Maasai Mara',
            description='Three-day group trip',
            location='Narok',
            price='20000.00',
            booking_fee_kes=5000,
            booking_terms='Booking fee is non-refundable.',
        )
        self.departure = TripDeparture.objects.create(
            safari=self.safari,
            start_date='2030-07-01',
            seats_total=3,
            price_kes=20000,
        )
        self.booking_data = {
            'departure': self.departure.id,
            'full_name': 'Amina Guest',
            'email': 'amina@example.com',
            'phone': '0712345678',
            'payment_phone': '0712345678',
            'participant_count': 2,
            'terms_accepted': True,
            'passengers': [
                {'full_name': 'Amina Guest'},
                {'full_name': 'Sam Guest'},
            ],
        }

    def test_safari_card_closes_when_no_departure_is_open(self):
        def card_state():
            results = self.client.get('/api/safaris/').data['results']
            return next(item for item in results if item['id'] == self.safari.id)['bookings_open']

        self.assertTrue(card_state())
        self.departure.is_open = False
        self.departure.save()
        self.assertFalse(card_state())
        self.departure.is_open = True
        self.departure.save()
        self.assertTrue(card_state())

    def test_manually_closed_safari_shows_closed_and_cannot_be_booked(self):
        self.safari.is_open = False
        self.safari.save()
        results = self.client.get('/api/safaris/').data['results']
        self.assertFalse(next(item for item in results if item['id'] == self.safari.id)['bookings_open'])
        departures = self.client.get('/api/departures/')
        self.assertEqual(departures.data.get('results', departures.data), [])
        response = self.client.post('/api/bookings/create/', self.booking_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_open_label_needs_a_published_departure(self):
        def card():
            results = self.client.get('/api/safaris/').data['results']
            return next(item for item in results if item['id'] == self.safari.id)
        self.assertTrue(card()['has_open_departure'])
        self.departure.is_archived = True
        self.departure.save()
        self.assertFalse(card()['has_open_departure'])
        self.assertTrue(card()['bookings_open'])

    @override_settings(MPESA_CALLBACK_TOKEN='callback-secret')
    def test_booking_holds_seats_and_starts_kes_payment(self):
        with self.settings(MPESA_CALLBACK_TOKEN='callback-secret'):
            from unittest.mock import patch
            with patch('api.booking_views.initiate_stk_push', return_value={
                'checkout_request_id': 'checkout-1',
                'merchant_request_id': 'merchant-1',
                'customer_message': 'Check your phone.',
                'payment_phone': '254712345678',
            }) as initiate:
                response = self.client.post('/api/bookings/create/', self.booking_data, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['currency'], 'KES')
        self.assertEqual(response.data['amount_kes'], 5000)
        self.assertEqual(response.data['full_amount_kes'], 40000)
        self.assertEqual(response.data['booking_fee_kes'], 5000)
        self.assertEqual(response.data['balance_due_kes'], 35000)
        self.assertEqual(self.departure.__class__.objects.get(pk=self.departure.pk).seats_available, 1)
        booking = Booking.objects.get(reference=response.data['reference'])
        self.assertEqual(booking.status, Booking.Status.PENDING_PAYMENT)
        self.assertEqual(booking.passengers.count(), 2)
        self.assertEqual(booking.payment_phone, '254712345678')
        self.assertEqual(booking.booking_terms, self.safari.booking_terms)
        self.assertIsNotNone(booking.terms_accepted_at)
        initiate.assert_called_once()

    @override_settings(ONLINE_PAYMENTS_ENABLED=False)
    def test_disabled_online_payments_do_not_create_bookings_or_start_payment(self):
        with patch('api.booking_views.initiate_stk_push') as initiate:
            response = self.client.post('/api/bookings/create/', self.booking_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertIn('WhatsApp or phone', response.data['detail'])
        self.assertFalse(Booking.objects.exists())
        initiate.assert_not_called()

    def test_booking_requires_acceptance_of_admin_terms(self):
        from unittest.mock import patch

        payload = {**self.booking_data, 'terms_accepted': False}
        with patch('api.booking_views.initiate_stk_push') as initiate:
            response = self.client.post('/api/bookings/create/', payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('terms_accepted', response.data)
        initiate.assert_not_called()

    def test_booking_fee_stays_fixed_and_promo_reduces_balance(self):
        PromoCode.objects.create(
            code='SAVE10',
            discount_type=PromoCode.DiscountType.PERCENT,
            value=10,
        )
        from unittest.mock import patch

        payload = {**self.booking_data, 'promo_code': 'SAVE10'}
        with patch('api.booking_views.initiate_stk_push', return_value={
            'checkout_request_id': 'checkout-promo',
            'merchant_request_id': 'merchant-promo',
            'customer_message': 'Check your phone.',
            'payment_phone': '254712345678',
        }) as initiate:
            response = self.client.post('/api/bookings/create/', payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['amount_kes'], 5000)
        self.assertEqual(response.data['full_amount_kes'], 40000)
        self.assertEqual(response.data['discount_kes'], 4000)
        self.assertEqual(response.data['balance_due_kes'], 31000)
        self.assertEqual(initiate.call_args.kwargs['booking'].amount_kes, 5000)

    def test_booking_rejects_discount_that_reduces_total_below_booking_fee(self):
        PromoCode.objects.create(
            code='TOOLOW',
            discount_type=PromoCode.DiscountType.FIXED_KES,
            value=38000,
        )
        from unittest.mock import patch

        payload = {**self.booking_data, 'promo_code': 'TOOLOW'}
        with patch('api.booking_views.initiate_stk_push') as initiate:
            response = self.client.post('/api/bookings/create/', payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('promo_code', response.data)
        initiate.assert_not_called()

    def test_staff_sales_report_sums_confirmed_bookings_and_filters_dates(self):
        Booking.objects.create(
            departure=self.departure,
            full_name='Confirmed Guest',
            email='confirmed@example.com',
            phone='0711111111',
            payment_phone='254711111111',
            participant_count=2,
            amount_kes=40000,
            status=Booking.Status.CONFIRMED,
        )
        Booking.objects.create(
            departure=self.departure,
            full_name='Pending Guest',
            email='pending@example.com',
            phone='0722222222',
            payment_phone='254722222222',
            participant_count=1,
            amount_kes=20000,
            status=Booking.Status.PENDING_PAYMENT,
        )
        outside_range = Booking.objects.create(
            departure=self.departure,
            full_name='Old Guest',
            email='old@example.com',
            phone='0733333333',
            payment_phone='254733333333',
            participant_count=1,
            amount_kes=20000,
            status=Booking.Status.CONFIRMED,
        )
        Booking.objects.filter(pk=outside_range.pk).update(
            created_at=timezone.now() - timedelta(days=40),
        )

        staff_user = get_user_model().objects.create_user(
            username='report-staff',
            password='test-password',
            is_staff=True,
        )
        start_date = (timezone.localdate() - timedelta(days=1)).isoformat()
        end_date = (timezone.localdate() + timedelta(days=1)).isoformat()
        self.client.force_authenticate(user=staff_user)

        response = self.client.get('/api/bookings/report/', {
            'start_date': start_date,
            'end_date': end_date,
        })

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['total_bookings'], 2)
        self.assertEqual(response.data['confirmed_bookings'], 1)
        self.assertEqual(response.data['participants'], 2)
        self.assertEqual(response.data['revenue_kes'], 40000)
        self.assertEqual(response.data['status_counts'], {
            Booking.Status.CONFIRMED: 1,
            Booking.Status.PENDING_PAYMENT: 1,
        })
        self.assertEqual(response.data['by_safari'], [{
            'safari_id': self.safari.id,
            'safari_title': self.safari.title,
            'confirmed_bookings': 1,
            'participants': 2,
            'revenue_kes': 40000,
        }])
    def test_sales_report_rejects_invalid_date_range_and_requires_staff(self):
        unauthorized = self.client.get('/api/bookings/report/')
        self.assertIn(unauthorized.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))

        staff_user = get_user_model().objects.create_user(
            username='report-validation-staff',
            password='test-password',
            is_staff=True,
        )
        self.client.force_authenticate(user=staff_user)

        invalid_date = self.client.get('/api/bookings/report/', {'start_date': 'not-a-date'})
        reversed_range = self.client.get('/api/bookings/report/', {
            'start_date': '2030-07-02',
            'end_date': '2030-07-01',
        })

        self.assertEqual(invalid_date.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(reversed_range.status_code, status.HTTP_400_BAD_REQUEST)

    def test_checkout_refuses_to_oversell_departure(self):
        Booking.objects.create(
            departure=self.departure,
            full_name='Existing',
            email='existing@example.com',
            phone='0711111111',
            payment_phone='254711111111',
            participant_count=2,
            amount_kes=40000,
            status=Booking.Status.CONFIRMED,
        )

        response = self.client.post('/api/bookings/create/', self.booking_data, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('participant_count', response.data)

    def test_public_waitlist_only_accepts_sold_out_departures(self):
        Booking.objects.create(
            departure=self.departure,
            full_name='Existing',
            email='existing@example.com',
            phone='0711111111',
            payment_phone='254711111111',
            participant_count=3,
            amount_kes=60000,
            status=Booking.Status.CONFIRMED,
        )
        response = self.client.post('/api/waitlist/', {
            'departure': self.departure.id,
            'full_name': 'Amina Guest',
            'email': 'amina@example.com',
            'phone': '0712345678',
            'participant_count': 1,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    @override_settings(
        DEFAULT_FROM_EMAIL='bookings@example.com',
        EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    )
    def test_waitlist_is_notified_when_spots_are_available(self):
        from api.booking_views import notify_waitlist_for_departure
        from django.core import mail

        entry = WaitlistEntry.objects.create(
            departure=self.departure,
            full_name='Amina Guest',
            email='amina@example.com',
            phone='0712345678',
            participant_count=2,
        )

        notify_waitlist_for_departure(self.departure.id)

        entry.refresh_from_db()
        self.assertEqual(entry.status, WaitlistEntry.Status.NOTIFIED)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('spots are available', mail.outbox[0].body)

    @override_settings(
        ONLINE_PAYMENTS_ENABLED=False,
        MPESA_CALLBACK_TOKEN='callback-secret',
        DEFAULT_FROM_EMAIL='bookings@example.com',
        EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    )
    def test_only_matching_mpesa_callback_confirms_and_sends_receipt(self):
        booking = Booking.objects.create(
            departure=self.departure,
            full_name='Amina Guest',
            email='amina@example.com',
            phone='0712345678',
            payment_phone='254712345678',
            participant_count=1,
            amount_kes=5000,
            full_amount_kes=20000,
            booking_fee_kes=5000,
            balance_due_kes=15000,
            checkout_request_id='checkout-paid',
            merchant_request_id='merchant-paid',
        )
        callback = {
            'Body': {
                'stkCallback': {
                    'MerchantRequestID': 'merchant-paid',
                    'CheckoutRequestID': 'checkout-paid',
                    'ResultCode': 0,
                    'CallbackMetadata': {'Item': [
                        {'Name': 'Amount', 'Value': 5000},
                        {'Name': 'MpesaReceiptNumber', 'Value': 'QWE123456'},
                        {'Name': 'PhoneNumber', 'Value': 254712345678},
                    ]},
                },
            },
        }

        from unittest.mock import patch
        with patch('api.booking_views.query_stk_push', return_value={
            'CheckoutRequestID': 'checkout-paid',
            'MerchantRequestID': 'merchant-paid',
            'ResultCode': '0',
        }):
            with self.captureOnCommitCallbacks(execute=True):
                response = self.client.post(
                    '/api/payments/mpesa/callback/callback-secret/',
                    callback,
                    format='json',
                )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        booking.refresh_from_db()
        self.assertEqual(booking.status, Booking.Status.CONFIRMED)
        self.assertEqual(booking.mpesa_receipt, 'QWE123456')
        self.assertEqual(booking.balance_due_kes, 15000)
        self.assertEqual(self.departure.__class__.objects.get(pk=self.departure.pk).seats_available, 2)
        from django.core import mail
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn(booking.reference, mail.outbox[0].body)
        self.assertIn('Remaining balance: KES 15,000', mail.outbox[0].body)

    @override_settings(MPESA_CALLBACK_TOKEN='callback-secret')
    def test_callback_does_not_confirm_when_daraja_query_disagrees(self):
        booking = Booking.objects.create(
            departure=self.departure,
            full_name='Amina Guest',
            email='amina@example.com',
            phone='0712345678',
            payment_phone='254712345678',
            participant_count=1,
            amount_kes=20000,
            checkout_request_id='checkout-pending',
            merchant_request_id='merchant-pending',
        )
        callback = {
            'Body': {
                'stkCallback': {
                    'MerchantRequestID': 'merchant-pending',
                    'CheckoutRequestID': 'checkout-pending',
                    'ResultCode': 0,
                    'CallbackMetadata': {'Item': [
                        {'Name': 'Amount', 'Value': 20000},
                        {'Name': 'MpesaReceiptNumber', 'Value': 'QWE123456'},
                        {'Name': 'PhoneNumber', 'Value': 254712345678},
                    ]},
                },
            },
        }

        from unittest.mock import patch
        with patch('api.booking_views.query_stk_push', return_value={
            'CheckoutRequestID': 'checkout-pending',
            'MerchantRequestID': 'merchant-pending',
            'ResultCode': '1032',
        }):
            response = self.client.post(
                '/api/payments/mpesa/callback/callback-secret/',
                callback,
                format='json',
            )

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        booking.refresh_from_db()
        self.assertEqual(booking.status, Booking.Status.PENDING_PAYMENT)
        self.assertFalse(booking.mpesa_receipt)

    def test_booking_records_are_private_to_staff(self):
        booking = Booking.objects.create(
            departure=self.departure,
            full_name='Amina Guest',
            email='amina@example.com',
            phone='0712345678',
            payment_phone='254712345678',
            participant_count=1,
            amount_kes=20000,
        )
        response = self.client.get('/api/bookings/')
        self.assertIn(response.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))
        status_response = self.client.get(f'/api/bookings/{booking.reference}/status/')
        self.assertEqual(status_response.status_code, status.HTTP_200_OK)
        self.assertNotIn('email', status_response.data)

    def test_staff_can_permanently_delete_confirmed_booking_and_passengers(self):
        booking = Booking.objects.create(
            departure=self.departure,
            full_name='Amina Guest',
            email='amina@example.com',
            phone='0712345678',
            payment_phone='254712345678',
            participant_count=1,
            amount_kes=5000,
            booking_fee_kes=5000,
            status=Booking.Status.CONFIRMED,
            mpesa_receipt='QWE123456',
        )
        passenger = Passenger.objects.create(booking=booking, full_name='Amina Guest')
        unauthorized_response = self.client.delete(f'/api/bookings/{booking.id}/')
        self.assertIn(
            unauthorized_response.status_code,
            (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN),
        )
        self.assertTrue(Booking.objects.filter(pk=booking.pk).exists())

        self.client.force_authenticate(user=get_user_model().objects.create_user(
            username='booking-delete-admin',
            password='test-password',
            is_staff=True,
        ))

        response = self.client.delete(f'/api/bookings/{booking.id}/')

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Booking.objects.filter(pk=booking.pk).exists())
        self.assertFalse(Passenger.objects.filter(pk=passenger.pk).exists())


class AdminBookingEditingTests(APITestCase):
    def setUp(self):
        self.staff = get_user_model().objects.create_user(username='editor', is_staff=True)
        self.safari = Safari.objects.create(
            title='Safari', description='Trip', location='Kenya', price='20000.00', visible=True,
        )
        self.departure = TripDeparture.objects.create(
            safari=self.safari, start_date=timezone.localdate() + timedelta(days=10),
            seats_total=5, price_kes=20000,
        )
        self.other = TripDeparture.objects.create(
            safari=self.safari, start_date=timezone.localdate() + timedelta(days=20),
            seats_total=3, price_kes=25000,
        )
        self.booking = Booking.objects.create(
            departure=self.departure, full_name='Guest', email='guest@example.com',
            phone='0712345678', payment_phone='254712345678', participant_count=2,
            amount_kes=5000, booking_fee_kes=5000, full_amount_kes=40000,
            balance_due_kes=35000, status=Booking.Status.CONFIRMED, mpesa_receipt='RECEIPT1',
        )
        self.passengers = [
            Passenger.objects.create(booking=self.booking, full_name='Guest'),
            Passenger.objects.create(booking=self.booking, full_name='Companion'),
        ]
        self.client.force_authenticate(user=self.staff)

    def test_staff_sets_available_seats_and_pickup_without_losing_reservations(self):
        response = self.client.patch(f'/api/departures/{self.departure.pk}/', {
            'seats_available': 0, 'pickup_time': '6:30 AM', 'pickup_points': ['Nairobi'],
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.departure.refresh_from_db()
        self.assertEqual((self.departure.seats_total, self.departure.seats_available), (2, 0))
        self.assertEqual(self.departure.pickup_time, '6:30 AM')
        self.assertEqual(self.departure.pickup_points, ['Nairobi'])

        response = self.client.patch(f'/api/departures/{self.other.pk}/', {'seats_available': 0}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.other.refresh_from_db()
        self.assertEqual((self.other.seats_total, self.other.seats_available), (0, 0))

    def test_departure_edits_enforce_staff_and_capacity(self):
        self.client.force_authenticate(user=None)
        response = self.client.patch(f'/api/departures/{self.departure.pk}/', {'seats_available': 4}, format='json')
        self.assertIn(response.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))
        self.client.force_authenticate(user=self.staff)
        response = self.client.patch(f'/api/departures/{self.departure.pk}/', {'seats_total': 1}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.departure.refresh_from_db()
        self.assertEqual(self.departure.seats_total, 5)

    def test_available_seats_include_active_payment_holds(self):
        Booking.objects.create(
            departure=self.departure, full_name='Pending', email='pending@example.com',
            phone='0712345678', payment_phone='254712345678', participant_count=1,
            amount_kes=5000, status=Booking.Status.PENDING_PAYMENT,
            expires_at=timezone.now() + timedelta(minutes=5),
        )
        response = self.client.patch(f'/api/departures/{self.departure.pk}/', {'seats_available': 4}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.departure.refresh_from_db()
        self.assertEqual((self.departure.seats_total, self.departure.seats_available), (7, 4))

    def test_booking_move_and_traveler_edit_preserves_payment(self):
        response = self.client.patch(f'/api/bookings/{self.booking.pk}/edit-details/', {
            'departure': self.other.pk, 'participant_count': 3, 'full_name': 'Updated Guest',
            'passengers': [
                {'id': self.passengers[0].pk, 'full_name': 'Updated Guest', 'phone': '0700000000'},
                {'id': self.passengers[1].pk, 'full_name': 'Companion'},
                {'full_name': 'Third guest', 'emergency_contact': 'Family'},
            ],
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.booking.refresh_from_db()
        self.assertEqual((self.booking.departure_id, self.booking.participant_count), (self.other.pk, 3))
        self.assertEqual((self.booking.amount_kes, self.booking.full_amount_kes, self.booking.balance_due_kes, self.booking.mpesa_receipt), (5000, 40000, 35000, 'RECEIPT1'))
        self.assertEqual(self.booking.passengers.count(), 3)
        self.departure.refresh_from_db()
        self.other.refresh_from_db()
        self.assertEqual((self.departure.seats_available, self.other.seats_available), (5, 0))

    def test_booking_edits_reject_overbooking_invalid_passengers_and_financial_fields(self):
        self.other.seats_total = 1
        self.other.save()
        url = f'/api/bookings/{self.booking.pk}/edit-details/'
        response = self.client.patch(url, {'departure': self.other.pk}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        response = self.client.patch(url, {'passengers': [
            {'id': self.passengers[0].pk, 'full_name': 'One'},
            {'id': self.passengers[0].pk, 'full_name': 'Two'},
        ]}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        response = self.client.patch(url, {'amount_kes': 1}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.booking.refresh_from_db()
        self.assertEqual((self.booking.departure_id, self.booking.amount_kes), (self.departure.pk, 5000))

    def test_removing_traveler_releases_seat_and_notifies_waitlist(self):
        with patch('api.booking_views.notify_waitlist_for_departure') as notify:
            with self.captureOnCommitCallbacks(execute=True):
                response = self.client.patch(f'/api/bookings/{self.booking.pk}/edit-details/', {
                    'participant_count': 1,
                    'passengers': [{'id': self.passengers[0].pk, 'full_name': 'Guest'}],
                }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(self.booking.passengers.count(), 1)
        self.departure.refresh_from_db()
        self.assertEqual(self.departure.seats_available, 4)
        notify.assert_called_once_with(self.departure.pk)

    def test_pending_or_late_payment_blocks_trip_changes_but_allows_contact_edits(self):
        url = f'/api/bookings/{self.booking.pk}/edit-details/'
        for booking_status in (Booking.Status.PENDING_PAYMENT, Booking.Status.PAYMENT_FAILED):
            self.booking.status = booking_status
            self.booking.checkout_request_id = 'checkout-id'
            self.booking.save()
            response = self.client.patch(url, {'departure': self.other.pk}, format='json')
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
            response = self.client.patch(url, {'phone': '0700000000'}, format='json')
            self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.client.force_authenticate(user=None)
        response = self.client.patch(url, {'phone': '0700000001'}, format='json')
        self.assertIn(response.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))

    def test_staff_can_archive_and_restore_without_losing_booking_records(self):
        waitlist = WaitlistEntry.objects.create(
            departure=self.departure, full_name='Waiting', email='waiting@example.com',
            phone='0712345678',
        )
        url = f'/api/departures/{self.departure.pk}/'
        response = self.client.patch(url, {'is_archived': True}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertTrue(response.data['is_archived'])
        self.assertTrue(Booking.objects.filter(pk=self.booking.pk).exists())
        self.assertTrue(WaitlistEntry.objects.filter(pk=waitlist.pk).exists())
        public = APIClient()
        self.assertEqual(public.get(url).status_code, status.HTTP_404_NOT_FOUND)
        ids = [item['id'] for item in public.get('/api/departures/').data['results']]
        self.assertNotIn(self.departure.pk, ids)
        self.assertEqual(self.client.get(url).status_code, status.HTTP_200_OK)

        with patch('api.booking_views.notify_waitlist_for_departure') as notify:
            with self.captureOnCommitCallbacks(execute=True):
                response = self.client.patch(url, {'is_archived': False}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(public.get(url).status_code, status.HTTP_200_OK)
        notify.assert_called_once_with(self.departure.pk)

    @override_settings(ONLINE_PAYMENTS_ENABLED=True)
    def test_archived_departures_reject_new_bookings_waitlist_and_booking_moves(self):
        self.other.is_archived = True
        self.other.save()
        response = self.client.patch(f'/api/bookings/{self.booking.pk}/edit-details/', {
            'departure': self.other.pk,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        public = APIClient()
        booking = public.post('/api/bookings/create/', {
            'departure': self.other.pk, 'full_name': 'Guest', 'email': 'guest@example.com',
            'phone': '0712345678', 'payment_phone': '0712345678', 'participant_count': 1,
            'passengers': [{'full_name': 'Guest'}],
        }, format='json')
        self.assertEqual(booking.status_code, status.HTTP_400_BAD_REQUEST)
        waitlist = public.post('/api/waitlist/', {
            'departure': self.other.pk, 'full_name': 'Waiting', 'email': 'waiting@example.com',
            'phone': '0712345678', 'participant_count': 1,
        }, format='json')
        self.assertEqual(waitlist.status_code, status.HTTP_400_BAD_REQUEST)

    def test_departure_deletion_protects_bookings_and_requires_staff(self):
        booking_url = f'/api/departures/{self.departure.pk}/'
        empty_url = f'/api/departures/{self.other.pk}/'
        self.client.force_authenticate(user=None)
        denied = self.client.delete(empty_url)
        self.assertIn(denied.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))
        self.client.force_authenticate(user=self.staff)
        protected = self.client.delete(booking_url)
        self.assertEqual(protected.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(protected.data['code'], 'departure_has_bookings')
        self.assertTrue(Booking.objects.filter(pk=self.booking.pk).exists())
        waitlist = WaitlistEntry.objects.create(
            departure=self.other, full_name='Waiting', email='waiting@example.com', phone='0712345678',
        )
        deleted = self.client.delete(empty_url)
        self.assertEqual(deleted.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(TripDeparture.objects.filter(pk=self.other.pk).exists())
        self.assertFalse(WaitlistEntry.objects.filter(pk=waitlist.pk).exists())

    def test_staff_can_explicitly_delete_departure_and_associated_bookings(self):
        url = f'/api/departures/{self.departure.pk}/?delete_bookings=true'
        waitlist = WaitlistEntry.objects.create(
            departure=self.departure, full_name='Waiting', email='waiting@example.com', phone='0712345678',
        )
        review = Testimonial.objects.create(message='Review', booking=self.booking)
        self.client.force_authenticate(user=None)
        denied = self.client.delete(url)
        self.assertIn(denied.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))
        self.assertTrue(Booking.objects.filter(pk=self.booking.pk).exists())

        self.client.force_authenticate(user=self.staff)
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(TripDeparture.objects.filter(pk=self.departure.pk).exists())
        self.assertFalse(Booking.objects.filter(pk=self.booking.pk).exists())
        self.assertFalse(Passenger.objects.filter(pk__in=[p.pk for p in self.passengers]).exists())
        self.assertFalse(WaitlistEntry.objects.filter(pk=waitlist.pk).exists())
        review.refresh_from_db()
        self.assertIsNone(review.booking_id)

    def test_forced_departure_deletion_rolls_back_if_still_protected(self):
        url = f'/api/departures/{self.departure.pk}/?delete_bookings=true'
        with patch.object(TripDeparture, 'delete', side_effect=ProtectedError('protected', [])):
            response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertTrue(TripDeparture.objects.filter(pk=self.departure.pk).exists())
        self.assertTrue(Booking.objects.filter(pk=self.booking.pk).exists())
        self.assertEqual(Passenger.objects.filter(booking=self.booking).count(), 2)

    def test_safari_deletion_requires_booked_departures_to_be_deleted_separately(self):
        url = f'/api/safaris/{self.safari.pk}/'
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertIn('departures with bookings', response.data['detail'])
        self.assertTrue(Safari.objects.filter(pk=self.safari.pk).exists())
        self.assertTrue(Booking.objects.filter(pk=self.booking.pk).exists())

        self.assertEqual(
            self.client.delete(f'/api/departures/{self.departure.pk}/?delete_bookings=true').status_code,
            status.HTTP_204_NO_CONTENT,
        )
        self.assertEqual(self.client.delete(url).status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(TripDeparture.objects.filter(pk=self.other.pk).exists())


class ManualBookingTests(APITestCase):
    def setUp(self):
        self.staff = get_user_model().objects.create_user(username='manual-admin', is_staff=True)
        safari = Safari.objects.create(title='Safari', description='Trip', location='Kenya', price='20000.00')
        self.departure = TripDeparture.objects.create(
            safari=safari, start_date=timezone.localdate() + timedelta(days=10), seats_total=2, price_kes=20000,
        )
        self.data = {
            'departure': self.departure.pk, 'full_name': 'Guest', 'phone': '0712345678',
            'traveler_location': 'Nairobi', 'participant_count': 2, 'full_amount_kes': 40000,
            'amount_kes': 5000, 'mpesa_receipt': 'ABC123', 'status': 'confirmed',
        }

    def test_staff_creates_paid_booking_without_initiating_payment(self):
        denied = self.client.post('/api/bookings/manual/', self.data, format='json')
        self.assertIn(denied.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))
        self.client.force_authenticate(user=self.staff)
        with patch('api.booking_views.initiate_stk_push') as initiate:
            response = self.client.post('/api/bookings/manual/', self.data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        booking = Booking.objects.get(pk=response.data['id'])
        self.assertTrue(booking.is_manual)
        self.assertTrue(booking.reference)
        self.assertEqual((booking.traveler_location, booking.mpesa_receipt), ('Nairobi', 'ABC123'))
        self.assertEqual((booking.amount_kes, booking.booking_fee_kes, booking.balance_due_kes), (5000, 5000, 35000))
        self.assertEqual(booking.passengers.get().full_name, 'Guest')
        self.assertEqual(self.departure.seats_available, 0)
        initiate.assert_not_called()

    def test_required_fields_amounts_and_capacity_are_enforced(self):
        self.client.force_authenticate(user=self.staff)
        for field in ('full_name', 'phone', 'traveler_location', 'mpesa_receipt'):
            response = self.client.post('/api/bookings/manual/', {**self.data, field: ' '}, format='json')
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, field)
        for changes in ({'amount_kes': 0}, {'amount_kes': 40001}, {'participant_count': 3}):
            response = self.client.post('/api/bookings/manual/', {**self.data, **changes}, format='json')
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, changes)
        self.assertFalse(Booking.objects.exists())

    def test_manual_edit_updates_amounts_and_seats_and_protects_online_records(self):
        self.client.force_authenticate(user=self.staff)
        created = self.client.post('/api/bookings/manual/', self.data, format='json')
        url = f"/api/bookings/{created.data['id']}/manual/"
        with patch('api.booking_views.notify_waitlist_for_departure') as notify:
            with self.captureOnCommitCallbacks(execute=True):
                response = self.client.patch(url, {
                    **self.data, 'participant_count': 1, 'amount_kes': 10000,
                    'traveler_location': 'Mombasa', 'mpesa_receipt': 'NEW123',
                }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual((response.data['balance_due_kes'], response.data['mpesa_receipt']), (30000, 'NEW123'))
        self.assertEqual(self.departure.seats_available, 1)
        notify.assert_called_once_with(self.departure.pk)
        response = self.client.patch(url, {
            **self.data, 'status': 'cancelled', 'mpesa_receipt': 'NEW123',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(self.departure.seats_available, 2)

        other = self.client.post('/api/bookings/manual/', {
            **self.data, 'participant_count': 1, 'mpesa_receipt': 'OTHER123',
        }, format='json')
        self.assertEqual(other.status_code, status.HTTP_201_CREATED, other.data)
        response = self.client.patch(url, self.data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.departure.seats_available, 1)

        booking = Booking.objects.get(pk=created.data['id'])
        booking.is_manual = False
        booking.save(update_fields=['is_manual'])
        response = self.client.patch(url, self.data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        booking.refresh_from_db()
        self.assertEqual(booking.mpesa_receipt, 'NEW123')

    @override_settings(DEFAULT_FROM_EMAIL='bookings@example.com')
    def test_reminder_without_email_skips_email_but_attempts_whatsapp(self):
        from .notifications import send_departure_reminder

        self.client.force_authenticate(user=self.staff)
        response = self.client.post('/api/bookings/manual/', self.data, format='json')
        booking = Booking.objects.get(pk=response.data['id'])
        with patch('api.notifications.send_mail') as send_email, patch(
            'api.notifications._send_whatsapp_template', return_value=True,
        ) as send_whatsapp:
            self.assertTrue(send_departure_reminder(booking))
        send_email.assert_not_called()
        send_whatsapp.assert_called_once()


class InvoiceTests(APITestCase):
    def setUp(self):
        self.staff = get_user_model().objects.create_user(username='invoice-admin', is_staff=True)
        self.data = {
            'issue_date': '2030-01-01', 'due_date': '2030-01-31', 'currency': 'USD',
            'issuer_name': 'Simba Grand Tours', 'issuer_address': 'Nairobi',
            'issuer_email': 'business@example.com', 'issuer_phone': '0700000000',
            'issuer_tax_id': 'P123', 'client_name': 'Example Company', 'client_contact': 'Guest',
            'client_address': 'Mombasa', 'client_email': 'client@example.com',
            'client_phone': '0712345678', 'client_tax_id': 'C123',
            'service_details': 'Three-day safari', 'payment_instructions': 'Pay by bank transfer',
            'booking_terms': 'Subject to availability', 'notes': 'Thank you',
            'tax_rate': '16.00', 'amount_paid': '4.37',
            'items': [
                {'description': 'Transport & guide', 'quantity': '1.50', 'unit_price': '0.67'},
                {'description': 'Safari', 'quantity': '2.00', 'unit_price': '10.00'},
            ],
        }

    def test_staff_invoice_and_docx_contain_details_logo_and_exact_totals(self):
        from io import BytesIO
        from pathlib import Path
        from zipfile import ZipFile
        from docx import Document

        self.client.force_authenticate(user=self.staff)
        response = self.client.post('/api/invoices/', self.data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertTrue(response.data['number'].startswith('INV-'))
        self.assertEqual(
            (response.data['subtotal'], response.data['tax_amount'], response.data['total'], response.data['balance_due']),
            ('21.01', '3.36', '24.37', '20.00'),
        )
        document_response = self.client.get(f"/api/invoices/{response.data['id']}/document/")
        self.assertEqual(document_response.status_code, status.HTTP_200_OK)
        self.assertIn('.docx', document_response['Content-Disposition'])
        self.assertEqual(document_response['Cache-Control'], 'no-store')
        content = b''.join(document_response.streaming_content)
        document = Document(BytesIO(content))
        self.assertEqual(len(document.inline_shapes), 1)
        with ZipFile(BytesIO(content)) as archive:
            images = [name for name in archive.namelist() if name.startswith('word/media/')]
            self.assertEqual(len(images), 1)
            self.assertEqual(archive.read(images[0]), Path(__file__).with_name('invoice-logo.png').read_bytes())
        text = '\n'.join(p.text for p in document.paragraphs)
        table_text = '\n'.join(cell.text for row in document.tables[0].rows for cell in row.cells)
        for expected in [response.data['number'], 'Example Company', 'Subject to availability',
                         'Pay by bank transfer', 'Balance due: USD 20.00']:
            self.assertIn(expected, text)
        self.assertIn('Transport & guide', table_text)
        self.assertIn('USD 1.01', table_text)

    def test_edit_preserves_number_replaces_items_and_recalculates(self):
        self.client.force_authenticate(user=self.staff)
        created = self.client.post('/api/invoices/', self.data, format='json')
        updated = self.client.put(f"/api/invoices/{created.data['id']}/", {
            **self.data, 'tax_rate': '0', 'amount_paid': '50',
            'items': [{'description': 'Updated trip', 'quantity': '1', 'unit_price': '100'}],
        }, format='json')
        self.assertEqual(updated.status_code, status.HTTP_200_OK, updated.data)
        self.assertEqual(updated.data['number'], created.data['number'])
        self.assertEqual((updated.data['total'], updated.data['balance_due']), ('100.00', '50.00'))
        self.assertEqual(len(updated.data['items']), 1)
        self.assertEqual(updated.data['items'][0]['description'], 'Updated trip')

    def test_invoice_access_and_validation(self):
        self.assertIn(self.client.get('/api/invoices/').status_code, (401, 403))
        self.assertIn(self.client.post('/api/invoices/', self.data, format='json').status_code, (401, 403))
        self.client.force_authenticate(user=self.staff)
        for changes in (
            {'due_date': '2029-12-31'}, {'amount_paid': '999'}, {'tax_rate': '101'},
            {'items': []}, {'items': [{'description': 'Trip', 'quantity': '0', 'unit_price': '10'}]},
        ):
            response = self.client.post('/api/invoices/', {**self.data, **changes}, format='json')
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, changes)
        created = self.client.post('/api/invoices/', self.data, format='json')
        self.client.force_authenticate(user=None)
        denied = self.client.get(f"/api/invoices/{created.data['id']}/document/")
        self.assertIn(denied.status_code, (401, 403))


class PromoCodeTests(APITestCase):
    def test_promo_code_limits_discount_to_valid_percentage(self):
        staff = get_user_model().objects.create_user(
            username='promo-admin',
            password='test-password',
            is_staff=True,
        )
        self.client.force_authenticate(user=staff)
        invalid = self.client.post('/api/promocodes/', {
            'code': 'summer',
            'discount_type': 'percent',
            'value': '101',
        }, format='json')
        valid = self.client.post('/api/promocodes/', {
            'code': ' summer ',
            'discount_type': 'percent',
            'value': '10',
        }, format='json')

        self.assertEqual(invalid.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(valid.status_code, status.HTTP_201_CREATED)
        self.assertEqual(PromoCode.objects.get().code, 'SUMMER')


class PhotoThumbnailTests(APITestCase):
    def setUp(self):
        import base64, io
        from PIL import Image
        buffer = io.BytesIO()
        Image.new('RGB', (2000, 1500), 'green').save(buffer, 'JPEG')
        self.photo = 'data:image/jpeg;base64,' + base64.b64encode(buffer.getvalue()).decode()
        self.safari = Safari.objects.create(
            title='Thumb', description='d', location='Kenya', price=100, images=[self.photo], visible=True,
        )
        self.hidden = Safari.objects.create(
            title='Hidden', description='d', location='Kenya', price=100, images=[self.photo], visible=False,
        )

    def test_list_returns_thumbnail_urls_only_when_requested(self):
        full = self.client.get('/api/safaris/?visible=true').json()
        full = full.get('results', full)
        self.assertTrue(full[0]['images'][0].startswith('data:image/'))
        slim = self.client.get('/api/safaris/?visible=true&thumbs=1').json()
        slim = slim.get('results', slim)
        self.assertIn(f'/api/media/safaris/{self.safari.pk}/0/', slim[0]['images'][0])

    def test_light_mode_drops_photos_for_staff_only(self):
        from django.contrib.auth import get_user_model
        staff = get_user_model().objects.create_user('lightstaff', password='pw', is_staff=True)
        anonymous = self.client.get('/api/safaris/?light=1').json()
        anonymous = anonymous.get('results', anonymous)
        self.assertTrue(anonymous[0]['images'][0].startswith('data:image/'))
        self.client.force_authenticate(staff)
        light = self.client.get('/api/safaris/?light=1').json()
        light = light.get('results', light)
        self.assertEqual({item['title']: (item['images'], item['image_count']) for item in light},
                         {'Thumb': ([], 1), 'Hidden': ([], 1)})
        detail = self.client.get(f'/api/safaris/{self.safari.pk}/').json()
        self.assertTrue(detail['images'][0].startswith('data:image/'))

    def test_thumbnail_is_resized_cacheable_and_hides_unpublished(self):
        import io
        from PIL import Image
        response = self.client.get(f'/api/media/safaris/{self.safari.pk}/0/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('immutable', response['Cache-Control'])
        self.assertLessEqual(Image.open(io.BytesIO(response.content)).width, 900)
        self.assertEqual(self.client.get(f'/api/media/safaris/{self.hidden.pk}/0/').status_code, 404)
        self.assertEqual(self.client.get(f'/api/media/safaris/{self.safari.pk}/5/').status_code, 404)


class InvoiceDeleteTests(APITestCase):
    def test_only_staff_can_delete_an_invoice(self):
        from .models import Invoice
        invoice = Invoice.objects.create(
            issue_date='2030-01-01', issuer_name='Simba Grand Tours', client_name='Test client',
        )
        url = f'/api/invoices/{invoice.pk}/'
        self.assertEqual(self.client.delete(url).status_code, 401)
        self.client.force_authenticate(get_user_model().objects.create_user(username='inv-del', is_staff=True))
        self.assertEqual(self.client.delete(url).status_code, 204)
        self.assertFalse(Invoice.objects.filter(pk=invoice.pk).exists())


class AdminProfileTests(APITestCase):
    PNG = (
        'data:image/png;base64,'
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
    )

    def test_staff_can_edit_own_profile_and_public_cannot(self):
        self.assertEqual(self.client.get('/api/auth/profile/').status_code, 401)
        staff = get_user_model().objects.create_user(username='boss', password='pass12345', is_staff=True)
        self.client.force_authenticate(user=staff)
        first = self.client.get('/api/auth/profile/').data
        self.assertEqual(first['username'], 'boss')
        self.assertEqual(first['display_name'], '')
        response = self.client.patch(
            '/api/auth/profile/', {'display_name': ' Oscar ', 'photo': self.PNG}, format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['display_name'], 'Oscar')
        bad = self.client.patch('/api/auth/profile/', {'photo': 'data:image/png;base64,AAAA'}, format='json')
        self.assertEqual(bad.status_code, 400)
        self.assertEqual(self.client.get('/api/auth/profile/').data['photo'], self.PNG)


class PastDepartureTests(APITestCase):
    def test_staff_can_record_a_past_trip_and_it_stays_closed(self):
        staff = get_user_model().objects.create_user(username='past', password='pass12345', is_staff=True)
        self.client.force_authenticate(user=staff)
        safari = Safari.objects.create(title='May trip', description='Done', location='Kenya', price='1000.00')
        response = self.client.post('/api/departures/', {
            'safari': safari.id, 'start_date': '2026-05-10', 'end_date': '2026-05-12',
            'seats_total': 10, 'price_kes': 1000,
        }, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        self.client.force_authenticate(user=None)
        detail = self.client.get(f'/api/safaris/{safari.id}/').data
        self.assertFalse(detail['bookings_open'])
        self.assertFalse(detail['has_open_departure'])


class PromoPoolTests(APITestCase):
    def setUp(self):
        from .models import Safari
        self.safari = Safari.objects.create(title='Mara', description='d', location='Mara', price=5000, visible=True)
        self.staff = get_user_model().objects.create_user(username='admin1', password='pass12345', is_staff=True)

    def generate(self, items):
        self.client.force_authenticate(user=self.staff)
        response = self.client.post('/api/promo-pool/generate/', {'items': items}, format='json')
        self.client.force_authenticate(user=None)
        return response

    def test_admin_generates_codes_and_public_cannot(self):
        self.assertEqual(self.client.post('/api/promo-pool/generate/', {'items': [{'discount_kes': 100, 'quantity': 1}]}, format='json').status_code, 401)
        response = self.generate([{'discount_kes': 100, 'quantity': 3}, {'discount_kes': 500, 'quantity': 1}])
        self.assertEqual(response.status_code, 201)
        self.assertEqual(len(response.data), 4)
        self.assertEqual(len({row['code'] for row in response.data}), 4)
        self.assertEqual(self.client.get(f'/api/promo-pool-public/status/?safari={self.safari.pk}').data, {'total': 4, 'remaining': 4})

    def test_each_claim_gets_a_different_code_until_empty(self):
        self.generate([{'discount_kes': 100, 'quantity': 2}])
        first = self.client.post('/api/promo-pool-public/claim/', {'safari': self.safari.pk}, format='json')
        second = self.client.post('/api/promo-pool-public/claim/', {'safari': self.safari.pk}, format='json')
        self.assertEqual(first.status_code, 201)
        self.assertEqual(first.data['discounted_price_kes'], 4900)
        self.assertEqual(first.data['remaining'], 1)
        self.assertNotEqual(first.data['code'], second.data['code'])
        third = self.client.post('/api/promo-pool-public/claim/', {'safari': self.safari.pk}, format='json')
        self.assertEqual(third.status_code, 409)
        self.assertEqual(self.client.get(f'/api/promo-pool-public/status/?safari={self.safari.pk}').data['remaining'], 0)

    def test_inactive_codes_are_not_handed_out(self):
        rows = self.generate([{'discount_kes': 100, 'quantity': 1}]).data
        self.client.force_authenticate(user=self.staff)
        self.client.patch(f"/api/promo-pool/{rows[0]['id']}/", {'is_active': False}, format='json')
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get(f'/api/promo-pool-public/status/?safari={self.safari.pk}').data['total'], 0)
        self.assertEqual(self.client.post('/api/promo-pool-public/claim/', {'safari': self.safari.pk}, format='json').status_code, 409)

    def test_codes_only_apply_to_selected_trips(self):
        from .models import Safari
        other = Safari.objects.create(title='Diani', description='d', location='Diani', price=3000, visible=True)
        self.generate_for([self.safari.pk], [{'discount_kes': 200, 'quantity': 1}])
        self.assertEqual(self.client.get(f'/api/promo-pool-public/status/?safari={other.pk}').data['remaining'], 0)
        self.assertEqual(self.client.post('/api/promo-pool-public/claim/', {'safari': other.pk}, format='json').status_code, 409)
        self.assertEqual(self.client.get(f'/api/promo-pool-public/status/?safari={self.safari.pk}').data['remaining'], 1)
        self.assertEqual(self.client.post('/api/promo-pool-public/claim/', {'safari': self.safari.pk}, format='json').status_code, 201)

    def generate_for(self, safari_ids, items):
        self.client.force_authenticate(user=self.staff)
        response = self.client.post('/api/promo-pool/generate/', {'items': items, 'safari_ids': safari_ids}, format='json')
        self.client.force_authenticate(user=None)
        return response
