import json
import logging
import urllib.error
import urllib.parse
import urllib.request

from django.conf import settings

logger = logging.getLogger(__name__)


class SubscriberSmsError(Exception):
    """Raised when an Africa's Talking SMS batch cannot be submitted."""


def send_subscriber_sms(recipients, message):
    username = getattr(settings, 'AFRICASTALKING_USERNAME', '')
    api_key = getattr(settings, 'AFRICASTALKING_API_KEY', '')
    environment = getattr(settings, 'AFRICASTALKING_ENVIRONMENT', 'sandbox').lower()
    sender_id = getattr(settings, 'AFRICASTALKING_SENDER_ID', '')
    if not username or not api_key:
        raise SubscriberSmsError('Africa’s Talking is not configured on the backend.')

    if environment == 'sandbox':
        endpoint = 'https://api.sandbox.africastalking.com/version1/messaging'
    elif environment == 'production':
        endpoint = 'https://api.africastalking.com/version1/messaging'
    else:
        raise SubscriberSmsError('Africa’s Talking environment must be sandbox or production.')

    sent = 0
    failed = 0
    errors = []
    for offset in range(0, len(recipients), 50):
        batch = recipients[offset:offset + 50]
        payload = {
            'username': username,
            'to': ','.join(f'+{subscriber.phone}' for subscriber in batch),
            'message': message,
        }
        if sender_id:
            payload['from'] = sender_id
        request = urllib.request.Request(
            endpoint,
            data=urllib.parse.urlencode(payload).encode(),
            headers={
                'apiKey': api_key,
                'Accept': 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            method='POST',
        )
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                provider_response = json.loads(response.read().decode('utf-8'))
        except urllib.error.HTTPError as error:
            logger.error('Africa’s Talking SMS batch failed with HTTP %s.', error.code)
            failed += len(batch)
            errors.append(f'SMS provider rejected the request (HTTP {error.code}).')
            continue
        except (urllib.error.URLError, TimeoutError) as error:
            logger.error('Africa’s Talking SMS batch failed: %s', type(error).__name__)
            failed += len(batch)
            errors.append('Could not connect to the SMS provider for a batch.')
            continue
        except (json.JSONDecodeError, UnicodeDecodeError) as error:
            logger.error('Africa’s Talking SMS batch returned an unreadable response: %s', type(error).__name__)
            failed += len(batch)
            errors.append('SMS provider returned an unreadable response for a batch.')
            continue

        message_data = provider_response.get('SMSMessageData') if isinstance(provider_response, dict) else None
        recipients_result = message_data.get('Recipients') if isinstance(message_data, dict) else None
        if not isinstance(recipients_result, list):
            logger.error('Africa’s Talking response did not contain recipient statuses.')
            failed += len(batch)
            errors.append('SMS provider response did not include recipient delivery statuses.')
            continue

        accepted = 0
        status_codes = set()
        for result in recipients_result:
            if not isinstance(result, dict):
                continue
            try:
                status_code = int(result.get('statusCode'))
                status_codes.add(status_code)
                if status_code in (101, 102):
                    accepted += 1
            except (TypeError, ValueError):
                continue
        sent += min(accepted, len(batch))
        failed += len(batch) - min(accepted, len(batch))
        if accepted < len(batch):
            if status_codes:
                codes = ', '.join(str(code) for code in sorted(status_codes))
                logger.error('Africa’s Talking rejected SMS recipients with status codes: %s', codes)
                errors.append(f'SMS provider rejected one or more recipients (status codes: {codes}).')
            else:
                errors.append('SMS provider rejected one or more recipients.')

    return {'attempted': len(recipients), 'sent': sent, 'failed': failed, 'errors': errors}
