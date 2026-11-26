import base64
import hmac
import json
import logging
import urllib.error
import urllib.request

from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)


class MpesaError(Exception):
    """Raised when Daraja credentials are missing or a request fails."""


def normalize_phone_number(phone):
    digits = ''.join(character for character in phone if character.isdigit())
    if digits.startswith('0'):
        digits = f'254{digits[1:]}'
    elif digits.startswith('7') or digits.startswith('1'):
        digits = f'254{digits}'
    if len(digits) != 12 or not digits.startswith('254'):
        raise ValueError('Enter a valid Kenyan mobile number, for example 0712345678.')
    return digits


def _request_json(url, *, method='GET', headers=None, data=None):
    request = urllib.request.Request(
        url,
        data=data,
        headers=headers or {},
        method=method,
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            return json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as error:
        body = error.read().decode('utf-8', errors='replace')
        logger.error('Daraja request returned HTTP %s: %s', error.code, body[:1000])
        raise MpesaError('M-Pesa could not process the payment request. Please try again.') from error
    except (urllib.error.URLError, TimeoutError) as error:
        logger.error('Daraja request failed: %s', error)
        raise MpesaError('M-Pesa is temporarily unavailable. Please try again.') from error
    except (json.JSONDecodeError, UnicodeDecodeError) as error:
        logger.error('Daraja returned an invalid response: %s', error)
        raise MpesaError('M-Pesa returned an invalid response. Please try again.') from error


def _daraja_base_url():
    environment = getattr(settings, 'MPESA_ENVIRONMENT', 'sandbox').lower()
    if environment == 'sandbox':
        return 'https://sandbox.safaricom.co.ke'
    if environment == 'production':
        return 'https://api.safaricom.co.ke'
    raise MpesaError('M-Pesa environment must be sandbox or production.')


def _required_setting(name):
    value = getattr(settings, name, '')
    if not value:
        raise MpesaError(f'M-Pesa is not configured: {name} is missing.')
    return value


def _access_token():
    consumer_key = _required_setting('MPESA_CONSUMER_KEY')
    consumer_secret = _required_setting('MPESA_CONSUMER_SECRET')
    credentials = base64.b64encode(f'{consumer_key}:{consumer_secret}'.encode()).decode()
    response = _request_json(
        f'{_daraja_base_url()}/oauth/v1/generate?grant_type=client_credentials',
        headers={'Authorization': f'Basic {credentials}'},
    )
    token = response.get('access_token')
    if not token:
        logger.error('Daraja OAuth response did not contain an access token.')
        raise MpesaError('M-Pesa authentication failed. Please try again later.')
    return token


def initiate_stk_push(*, booking, phone):
    shortcode = str(_required_setting('MPESA_SHORTCODE'))
    passkey = _required_setting('MPESA_PASSKEY')
    callback_token = _required_setting('MPESA_CALLBACK_TOKEN')
    callback_base_url = _required_setting('MPESA_CALLBACK_URL').rstrip('/')
    normalized_phone = normalize_phone_number(phone)
    timestamp = timezone.localtime().strftime('%Y%m%d%H%M%S')
    password = base64.b64encode(f'{shortcode}{passkey}{timestamp}'.encode()).decode()
    callback_url = f'{callback_base_url}/{callback_token}/'
    payload = {
        'BusinessShortCode': shortcode,
        'Password': password,
        'Timestamp': timestamp,
        'TransactionType': getattr(settings, 'MPESA_TRANSACTION_TYPE', 'CustomerPayBillOnline'),
        'Amount': booking.amount_kes,
        'PartyA': normalized_phone,
        'PartyB': shortcode,
        'PhoneNumber': normalized_phone,
        'CallBackURL': callback_url,
        'AccountReference': booking.reference,
        'TransactionDesc': f'Simba Grand Tours {booking.reference}',
    }
    response = _request_json(
        f'{_daraja_base_url()}/mpesa/stkpush/v1/processrequest',
        method='POST',
        headers={
            'Authorization': f'Bearer {_access_token()}',
            'Content-Type': 'application/json',
        },
        data=json.dumps(payload).encode(),
    )
    if (
        response.get('ResponseCode') != '0'
        or not response.get('CheckoutRequestID')
        or not response.get('MerchantRequestID')
    ):
        logger.error(
            'Daraja rejected STK request for booking %s: %s',
            booking.reference,
            response.get('CustomerMessage') or response.get('errorMessage') or 'Unknown response',
        )
        raise MpesaError(response.get('CustomerMessage') or 'M-Pesa could not start the payment request.')
    return {
        'checkout_request_id': response['CheckoutRequestID'],
        'merchant_request_id': response['MerchantRequestID'],
        'customer_message': response.get('CustomerMessage', 'Check your phone to complete payment.'),
        'payment_phone': normalized_phone,
    }


def query_stk_push(*, checkout_request_id):
    shortcode = str(_required_setting('MPESA_SHORTCODE'))
    passkey = _required_setting('MPESA_PASSKEY')
    timestamp = timezone.localtime().strftime('%Y%m%d%H%M%S')
    password = base64.b64encode(f'{shortcode}{passkey}{timestamp}'.encode()).decode()
    payload = {
        'BusinessShortCode': shortcode,
        'Password': password,
        'Timestamp': timestamp,
        'CheckoutRequestID': checkout_request_id,
    }
    return _request_json(
        f'{_daraja_base_url()}/mpesa/stkpushquery/v1/query',
        method='POST',
        headers={
            'Authorization': f'Bearer {_access_token()}',
            'Content-Type': 'application/json',
        },
        data=json.dumps(payload).encode(),
    )


def is_payment_callback_token_valid(token):
    configured_token = getattr(settings, 'MPESA_CALLBACK_TOKEN', '')
    return bool(configured_token and token and hmac.compare_digest(token, configured_token))


def parse_callback_amount(metadata):
    for item in metadata or []:
        if item.get('Name') == 'Amount':
            try:
                return int(item.get('Value'))
            except (TypeError, ValueError):
                return None
    return None


def parse_callback_receipt(metadata):
    for item in metadata or []:
        if item.get('Name') == 'MpesaReceiptNumber':
            return str(item.get('Value', ''))
    return ''


def parse_callback_phone(metadata):
    for item in metadata or []:
        if item.get('Name') == 'PhoneNumber':
            return str(item.get('Value', ''))
    return ''
