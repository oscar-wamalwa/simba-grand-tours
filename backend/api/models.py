"""
Django models for Simba Grand Tours.
"""

import uuid

from django.db import models
from django.db.models import Q, Sum
from django.utils import timezone

from .legal_defaults import DEFAULT_PRIVACY_POLICY, DEFAULT_TERMS_CONDITIONS


def generate_booking_reference():
    return f"SGT-{uuid.uuid4().hex[:16].upper()}"


class Safari(models.Model):
    """Safari package model."""
    title = models.CharField(max_length=255)
    description = models.TextField()
    location = models.CharField(max_length=255)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    booking_fee_kes = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text='Flat booking fee in whole Kenyan shillings for a reservation.',
    )
    booking_terms = models.TextField(blank=True, default='')
    duration = models.CharField(max_length=50, blank=True, null=True)
    difficulty = models.CharField(max_length=50, default='Moderate')
    trip_type = models.CharField(max_length=100, blank=True)
    trip_mode = models.CharField(
        max_length=20,
        choices=[('group', 'Group'), ('private', 'Private'), ('either', 'Group or private')],
        default='either',
    )
    county = models.CharField(max_length=100, blank=True)
    images = models.JSONField(default=list, blank=True)
    videos = models.JSONField(default=list, blank=True)
    highlights = models.JSONField(default=list, blank=True)
    inclusions = models.JSONField(default=list, blank=True)
    exclusions = models.JSONField(default=list, blank=True)
    itinerary = models.JSONField(default=list, blank=True)
    pickup_points = models.JSONField(default=list, blank=True)
    packing_checklist = models.JSONField(default=list, blank=True)
    visible = models.BooleanField(default=True)
    is_signature = models.BooleanField(default=False)
    is_featured = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        db_table = 'safaris'

    def __str__(self):
        return self.title


class Destination(models.Model):
    CATEGORY_CHOICES = [
        ('iconic_safaris', 'Iconic Safaris'),
        ('beach_coastal_escapes', 'Beach and Coastal Escapes'),
        ('rift_valley_weekenders', 'Rift Valley Weekenders'),
        ('hidden_gems_road_trips', 'Hidden Gems and Road Trips'),
    ]

    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=220, unique=True)
    category = models.CharField(max_length=32, choices=CATEGORY_CHOICES)
    badge = models.CharField(max_length=120, blank=True)
    duration = models.CharField(max_length=100, blank=True)
    hook = models.TextField()
    highlights = models.JSONField(default=list, blank=True)
    cta_label = models.CharField(max_length=120, blank=True)
    starting_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    images = models.JSONField(default=list, blank=True)
    safaris = models.ManyToManyField(Safari, related_name='destinations', blank=True)
    visible = models.BooleanField(default=True)
    featured_on_home = models.BooleanField(default=False)
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['sort_order', 'name']

    def __str__(self):
        return self.name


class TripDeparture(models.Model):
    """A dated, capacity-limited departure of a safari package."""

    safari = models.ForeignKey(Safari, on_delete=models.CASCADE, related_name='departures')
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    seats_total = models.PositiveIntegerField()
    price_kes = models.PositiveIntegerField(help_text='Per-person M-Pesa price in whole Kenyan shillings.')
    pickup_points = models.JSONField(default=list, blank=True)
    pickup_time = models.CharField(max_length=100, blank=True)
    is_open = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['start_date']
        constraints = [
            models.UniqueConstraint(fields=['safari', 'start_date'], name='unique_safari_departure_date'),
            models.CheckConstraint(check=Q(seats_total__gte=0), name='departure_seats_nonnegative'),
            models.CheckConstraint(check=Q(price_kes__gt=0), name='departure_price_positive'),
        ]

    def __str__(self):
        return f'{self.safari.title} - {self.start_date}'

    @property
    def seats_taken(self):
        now = timezone.now()
        return self.bookings.filter(
            Q(status=Booking.Status.CONFIRMED)
            | Q(status=Booking.Status.PENDING_PAYMENT, expires_at__gt=now)
        ).aggregate(total=Sum('participant_count'))['total'] or 0

    @property
    def seats_available(self):
        return max(0, self.seats_total - self.seats_taken)


class PromoCode(models.Model):
    class DiscountType(models.TextChoices):
        PERCENT = 'percent', 'Percentage'
        FIXED_KES = 'fixed_kes', 'Fixed KES amount'

    code = models.CharField(max_length=40, unique=True)
    discount_type = models.CharField(max_length=20, choices=DiscountType.choices)
    value = models.DecimalField(max_digits=10, decimal_places=2)
    starts_at = models.DateTimeField(null=True, blank=True)
    ends_at = models.DateTimeField(null=True, blank=True)
    max_uses = models.PositiveIntegerField(null=True, blank=True)
    uses_count = models.PositiveIntegerField(default=0)
    min_participants = models.PositiveIntegerField(default=1)
    active = models.BooleanField(default=True)

    def clean(self):
        self.code = self.code.strip().upper()

    def __str__(self):
        return self.code


class Booking(models.Model):
    class Status(models.TextChoices):
        PENDING_PAYMENT = 'pending_payment', 'Pending payment'
        CONFIRMED = 'confirmed', 'Confirmed'
        PAYMENT_FAILED = 'payment_failed', 'Payment failed'
        CANCELLED = 'cancelled', 'Cancelled'
        REFUND_REQUIRED = 'refund_required', 'Refund required'

    reference = models.CharField(max_length=20, unique=True, default=generate_booking_reference)
    departure = models.ForeignKey(TripDeparture, on_delete=models.PROTECT, related_name='bookings')
    promo_code = models.ForeignKey(PromoCode, on_delete=models.SET_NULL, null=True, blank=True, related_name='bookings')
    full_name = models.CharField(max_length=255)
    email = models.EmailField()
    phone = models.CharField(max_length=30)
    participant_count = models.PositiveIntegerField()
    amount_kes = models.PositiveIntegerField()
    full_amount_kes = models.PositiveIntegerField(default=0)
    booking_fee_kes = models.PositiveIntegerField(default=0)
    discount_kes = models.PositiveIntegerField(default=0)
    balance_due_kes = models.PositiveIntegerField(default=0)
    booking_terms = models.TextField(blank=True, default='')
    terms_accepted_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.PENDING_PAYMENT)
    payment_phone = models.CharField(max_length=30)
    checkout_request_id = models.CharField(max_length=100, unique=True, null=True, blank=True)
    merchant_request_id = models.CharField(max_length=100, blank=True)
    mpesa_receipt = models.CharField(max_length=30, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    reminder_sent_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.CheckConstraint(check=Q(participant_count__gt=0), name='booking_participants_positive'),
            models.CheckConstraint(check=Q(amount_kes__gt=0), name='booking_amount_positive'),
        ]

    def __str__(self):
        return f'{self.reference} - {self.full_name}'


class Passenger(models.Model):
    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name='passengers')
    full_name = models.CharField(max_length=255)
    phone = models.CharField(max_length=30, blank=True)
    emergency_contact = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['id']

    def __str__(self):
        return f'{self.full_name} - {self.booking.reference}'


class WaitlistEntry(models.Model):
    class Status(models.TextChoices):
        WAITING = 'waiting', 'Waiting'
        NOTIFIED = 'notified', 'Notified'
        BOOKED = 'booked', 'Booked'
        CANCELLED = 'cancelled', 'Cancelled'

    departure = models.ForeignKey(TripDeparture, on_delete=models.CASCADE, related_name='waitlist_entries')
    full_name = models.CharField(max_length=255)
    email = models.EmailField()
    phone = models.CharField(max_length=30)
    participant_count = models.PositiveIntegerField(default=1)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.WAITING)
    notified_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']
        constraints = [
            models.CheckConstraint(check=Q(participant_count__gt=0), name='waitlist_participants_positive'),
        ]

    def __str__(self):
        return f'{self.full_name} - {self.departure}'


class TripAnnouncement(models.Model):
    title = models.CharField(max_length=180)
    message = models.TextField()
    image = models.URLField(blank=True)
    link_url = models.URLField(blank=True)
    starts_at = models.DateTimeField(null=True, blank=True)
    ends_at = models.DateTimeField(null=True, blank=True)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.title


class Blog(models.Model):
    """Blog post model."""
    CATEGORY_CHOICES = [
        ('Safari Story', 'Safari Story'),
        ('Travel Tips', 'Travel Tips'),
        ('Wildlife Update', 'Wildlife Update'),
        ('Conservation', 'Conservation'),
        ('Guest Post', 'Guest Post'),
    ]
    
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('pending_review', 'Pending review'),
        ('published', 'Published'),
    ]

    title = models.CharField(max_length=255)
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES, default='Safari Story')
    author = models.CharField(max_length=255, default='Simba Grand Tours')
    location = models.CharField(max_length=255, default='Kenya')
    content = models.TextField()
    read_time = models.CharField(max_length=50, default='5 min read')
    publish_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    image = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        db_table = 'blogs'

    def __str__(self):
        return self.title


class BlogComment(models.Model):
    """Reader response to a blog post, held for staff review before publication."""

    STATUS_CHOICES = [
        ('pending_review', 'Pending review'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]

    blog = models.ForeignKey(Blog, related_name='comments', on_delete=models.CASCADE)
    name = models.CharField(max_length=120)
    email = models.EmailField(blank=True, default='')
    content = models.TextField(max_length=5000)
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending_review',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']
        db_table = 'blog_comments'

    def __str__(self):
        return f"Reply by {self.name} to {self.blog.title}"


class Subscriber(models.Model):
    """Newsletter subscriber model."""
    email = models.EmailField(unique=True)
    name = models.CharField(max_length=255, blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True, default='')
    sms_opt_in = models.BooleanField(default=False)
    sms_opt_in_at = models.DateTimeField(null=True, blank=True)
    subscribed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-subscribed_at']
        db_table = 'subscribers'

    def __str__(self):
        return self.email


class ContactMessage(models.Model):
    """Contact form submission model."""
    full_name = models.CharField(max_length=255, blank=True, null=True)
    email = models.EmailField(default='no-reply@simbagrandtours.com', blank=True, null=True)
    phone = models.CharField(max_length=50, blank=True, null=True)
    subject = models.CharField(max_length=255, blank=True, null=True)
    message = models.TextField(blank=True, null=True)
    read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    submitted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-submitted_at']
        db_table = 'contact_messages'

    def __str__(self):
        return f"Message from {self.full_name or self.email}"


class Settings(models.Model):
    """Website settings model."""
    id = models.CharField(max_length=100, primary_key=True)
    site_name = models.CharField(max_length=255, default='Simba Grand Tours')
    site_email = models.EmailField(default='simbagrandtours@gmail.com')
    site_phone = models.CharField(max_length=50, default='+254 707 984 287')
    address = models.TextField(default='Platinumz Plaza, Tom Mboya Street, Nairobi CBD')
    website = models.URLField(default='https://www.simbagrandtours.com')
    instagram = models.URLField(blank=True, null=True)
    facebook = models.URLField(blank=True, null=True)
    twitter = models.URLField(blank=True, null=True)
    tiktok = models.URLField(default='https://www.tiktok.com/@simba.grand.tours')
    whatsapp = models.CharField(max_length=50, blank=True, null=True)
    privacy_policy = models.TextField(default=DEFAULT_PRIVACY_POLICY, blank=True)
    terms_conditions = models.TextField(default=DEFAULT_TERMS_CONDITIONS, blank=True)
    featured_testimonials = models.JSONField(default=list, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'settings'

    def __str__(self):
        return self.site_name


class Testimonial(models.Model):
    """Testimonial/Review model for safari experiences."""
    full_name = models.CharField(max_length=255, blank=True, null=True)
    email = models.EmailField(default='no-reply@simbagrandtours.com', blank=True, null=True)
    location = models.CharField(max_length=255, blank=True, null=True)
    safari = models.CharField(max_length=255, blank=True, null=True)
    rating = models.IntegerField(default=5)
    message = models.TextField(blank=True, null=True)
    is_featured = models.BooleanField(default=False)
    is_verified = models.BooleanField(default=False)
    booking = models.ForeignKey(
        Booking,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviews',
    )
    media = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        db_table = 'testimonials'

    def __str__(self):
        return f"Testimonial from {self.full_name or 'Anonymous'} - {self.rating} stars"

