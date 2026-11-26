import logging
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from api.booking_views import notify_waitlist_for_departure
from api.models import Booking, TripDeparture
from api.notifications import send_departure_reminder

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Send upcoming trip reminders and release expired payment holds.'

    def handle(self, *args, **options):
        now = timezone.now()
        expired_departure_ids = list(
            Booking.objects.filter(
                status=Booking.Status.PENDING_PAYMENT,
                expires_at__lte=now,
            ).values_list('departure_id', flat=True).distinct()
        )
        expired_count = Booking.objects.filter(
            status=Booking.Status.PENDING_PAYMENT,
            expires_at__lte=now,
        ).update(status=Booking.Status.PAYMENT_FAILED, expires_at=None)
        if expired_count:
            logger.info('Released %s expired M-Pesa checkout hold(s).', expired_count)
            for departure_id in expired_departure_ids:
                notify_waitlist_for_departure(departure_id)

        today = timezone.localdate()
        departures = TripDeparture.objects.filter(
            start_date__gte=today,
            start_date__lte=today + timedelta(days=1),
        )
        bookings = Booking.objects.filter(
            departure__in=departures,
            status=Booking.Status.CONFIRMED,
            reminder_sent_at__isnull=True,
        ).select_related('departure__safari')
        sent = 0
        for booking in bookings.iterator():
            if send_departure_reminder(booking):
                Booking.objects.filter(pk=booking.pk, reminder_sent_at__isnull=True).update(
                    reminder_sent_at=timezone.now()
                )
                sent += 1
        self.stdout.write(self.style.SUCCESS(
            f'Released {expired_count} expired hold(s); sent {sent} trip reminder(s).'
        ))
