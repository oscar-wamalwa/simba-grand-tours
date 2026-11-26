"""
Django models for Simba Grand Tours.
"""

from django.db import models


class Safari(models.Model):
    """Safari package model."""
    title = models.CharField(max_length=255)
    description = models.TextField()
    location = models.CharField(max_length=255)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    duration = models.CharField(max_length=50, blank=True, null=True)
    difficulty = models.CharField(max_length=50, default='Moderate')
    images = models.JSONField(default=list, blank=True)
    highlights = models.JSONField(default=list, blank=True)
    inclusions = models.JSONField(default=list, blank=True)
    exclusions = models.JSONField(default=list, blank=True)
    itinerary = models.JSONField(default=list, blank=True)
    visible = models.BooleanField(default=True)
    is_signature = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        db_table = 'safaris'

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
    image = models.URLField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        db_table = 'blogs'

    def __str__(self):
        return self.title


class Subscriber(models.Model):
    """Newsletter subscriber model."""
    email = models.EmailField(unique=True)
    name = models.CharField(max_length=255, blank=True, null=True)
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
    whatsapp = models.CharField(max_length=50, blank=True, null=True)
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
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        db_table = 'testimonials'

    def __str__(self):
        return f"Testimonial from {self.full_name or 'Anonymous'} - {self.rating} stars"

