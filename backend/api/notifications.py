import json
import logging
import smtplib
import urllib.error
import urllib.request

from django.conf import settings
from django.core.mail import send_mail

from .mpesa import normalize_phone_number

logger = logging.getLogger(__name__)


def _send_whatsapp_template(*, phone, template_name, parameters):
    token = getattr(settings, 'WHATSAPP_ACCESS_TOKEN', '')
    phone_number_id = getattr(settings, 'WHATSAPP_PHONE_NUMBER_ID', '')
    if not token or not phone_number_id or not template_name:
        logger.warning('WhatsApp notification skipped because its provider is not configured.')
        return False
    try:
        recipient = normalize_phone_number(phone)
    except ValueError:
        logger.error('WhatsApp notification skipped: invalid recipient phone number.')
        return False

    version = getattr(settings, 'WHATSAPP_API_VERSION', 'v21.0')
    url = f'https://graph.facebook.com/{version}/{phone_number_id}/messages'
    components = [{
        'type': 'body',
        'parameters': [{'type': 'text', 'text': str(value)} for value in parameters],
    }]
    payload = {
        'messaging_product': 'whatsapp',
        'to': recipient,
        'type': 'template',
        'template': {
            'name': template_name,
            'language': {'code': getattr(settings, 'WHATSAPP_TEMPLATE_LANGUAGE', 'en')},
            'components': components,
        },
    }
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json',
        },
        method='POST',
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            response.read()
        return True
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as error:
        logger.error('WhatsApp provider rejected a notification: %s', error)
        return False


def send_booking_confirmation(booking_id):
    from .models import Booking

    booking = Booking.objects.select_related('departure__safari').filter(pk=booking_id).first()
    if not booking or booking.status != Booking.Status.CONFIRMED:
        return
    departure = booking.departure
    safari_title = departure.safari.title
    date = departure.start_date.strftime('%d %B %Y')
    amount = f'KES {booking.amount_kes:,}'
    subject = f'Booking confirmed: {booking.reference}'
    body = (
        f'Hello {booking.full_name},\n\n'
        f'Your payment for {safari_title} on {date} has been confirmed.\n'
        f'Booking reference: {booking.reference}\n'
        f'Amount paid: {amount}\n'
        f'M-Pesa receipt: {booking.mpesa_receipt}\n'
        f'Travellers: {booking.participant_count}\n\n'
        'Please keep this email as your booking receipt. We look forward to welcoming you.'
    )
    sender = getattr(settings, 'DEFAULT_FROM_EMAIL', '')
    if sender:
        try:
            send_mail(subject, body, sender, [booking.email], fail_silently=False)
        except (OSError, RuntimeError, smtplib.SMTPException) as error:
            logger.error('Could not send booking receipt email for %s: %s', booking.reference, error)
    else:
        logger.warning('Booking receipt email skipped because DEFAULT_FROM_EMAIL is not configured.')

    _send_whatsapp_template(
        phone=booking.phone,
        template_name=getattr(settings, 'WHATSAPP_BOOKING_TEMPLATE', ''),
        parameters=[
            booking.full_name,
            booking.reference,
            safari_title,
            date,
            amount,
            booking.mpesa_receipt,
        ],
    )


def send_departure_reminder(booking):
    departure = booking.departure
    safari_title = departure.safari.title
    date = departure.start_date.strftime('%d %B %Y')
    body = (
        f'Hello {booking.full_name}, this is a reminder that {safari_title} departs on {date}. '
        f'Your booking reference is {booking.reference}.'
    )
    sender = getattr(settings, 'DEFAULT_FROM_EMAIL', '')
    email_sent = False
    if sender:
        try:
            email_sent = bool(send_mail(
                f'Trip reminder: {safari_title} departs tomorrow',
                body,
                sender,
                [booking.email],
                fail_silently=False,
            ))
        except (OSError, RuntimeError, smtplib.SMTPException) as error:
            logger.error('Could not send departure reminder for %s: %s', booking.reference, error)
    whatsapp_sent = _send_whatsapp_template(
        phone=booking.phone,
        template_name=getattr(settings, 'WHATSAPP_REMINDER_TEMPLATE', ''),
        parameters=[booking.full_name, booking.reference, safari_title, date],
    )
    return email_sent or whatsapp_sent


def send_waitlist_open_spot(entry):
    departure = entry.departure
    title = departure.safari.title
    date = departure.start_date.strftime('%d %B %Y')
    subject = f'Spots opened: {title}'
    body = (
        f'Hello {entry.full_name}, spots are available for {title} departing on {date}. '
        'Visit our website or contact Simba Grand Tours to book. Spots are allocated in payment order.'
    )
    sender = getattr(settings, 'DEFAULT_FROM_EMAIL', '')
    email_sent = False
    if sender:
        try:
            email_sent = bool(send_mail(subject, body, sender, [entry.email], fail_silently=False))
        except (OSError, RuntimeError, smtplib.SMTPException) as error:
            logger.error('Could not send waitlist email for %s: %s', entry.email, error)
    whatsapp_sent = _send_whatsapp_template(
        phone=entry.phone,
        template_name=getattr(settings, 'WHATSAPP_WAITLIST_TEMPLATE', ''),
        parameters=[entry.full_name, title, date, str(entry.participant_count)],
    )
    return email_sent or whatsapp_sent
