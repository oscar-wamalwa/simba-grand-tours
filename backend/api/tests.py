from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core import mail
from django.test import SimpleTestCase, override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase, APIClient

from .models import (
    Blog,
    Booking,
    ContactMessage,
    Passenger,
    PromoCode,
    Safari,
    Subscriber,
    Testimonial,
    TripDeparture,
    WaitlistEntry,
)
from .mpesa import _transaction_type


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
        blogs = self.client.get('/api/blogs/').data['results']
        testimonials = self.client.get('/api/testimonials/').data['results']

        self.assertEqual([item['id'] for item in safaris], [self.visible_safari.id])
        self.assertEqual([item['title'] for item in blogs], ['Published story'])
        self.assertEqual([item['full_name'] for item in testimonials], ['Featured guest'])
        featured = self.client.get('/api/testimonials/featured/').data
        self.assertEqual([item['full_name'] for item in featured], ['Featured guest'])
        self.assertEqual(self.client.get('/api/settings/website_settings/').status_code, status.HTTP_200_OK)

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

        self.assertEqual(create_response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(update_response.status_code, status.HTTP_403_FORBIDDEN)
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

    def test_settings_accept_domains_without_a_scheme(self):
        self.client.force_authenticate(user=self.staff_user)
        response = self.client.patch(
            '/api/settings/website_settings/',
            {
                'website': 'www.simbagrandtours.com',
                'instagram': 'instagram.com/simba.grand.tours',
                'facebook': '',
                'twitter': 'https://x.com/simba_tours',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['website'], 'https://www.simbagrandtours.com')
        self.assertEqual(response.data['instagram'], 'https://instagram.com/simba.grand.tours')


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
