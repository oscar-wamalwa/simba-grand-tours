from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase, APIClient

from .models import Blog, ContactMessage, Safari, Subscriber, Testimonial


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
            {'full_name': 'Guest', 'email': 'guest@example.com', 'message': 'Great', 'rating': 5},
            format='json',
        )
        subscriber = self.client.post(
            '/api/subscribers/',
            {'email': 'newsletter@example.com'},
            format='json',
        )

        self.assertEqual(contact.status_code, status.HTTP_201_CREATED)
        self.assertEqual(review.status_code, status.HTTP_201_CREATED)
        self.assertEqual(subscriber.status_code, status.HTTP_201_CREATED)


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
