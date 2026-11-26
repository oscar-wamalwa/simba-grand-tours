# Booking feature deployment

The booking flow stores prices and payments as whole Kenyan shillings (KES). Before enabling bookings in Railway, configure:

- `MPESA_ENVIRONMENT` (`sandbox` for testing, `production` for live payments)
- `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_SHORTCODE`, and `MPESA_PASSKEY`
- `MPESA_CALLBACK_URL` as the callback base URL ending in `/api/payments/mpesa/callback`
- `MPESA_CALLBACK_TOKEN` as a long, unique secret. Never commit secrets or send them in chat.
- SMTP settings and `DEFAULT_FROM_EMAIL` for booking receipts
- Optional WhatsApp Cloud API credentials plus approved booking, reminder, and waitlist template names

The callback endpoint queries Daraja before confirming a successful STK payment. Test with Safaricom sandbox credentials first, and separately verify live credentials before accepting real payments.

For a live Till, set `MPESA_SHORTCODE` to the Safaricom-issued Till number and `MPESA_TRANSACTION_TYPE=CustomerBuyGoodsOnline`. Sandbox PayBill transactions use `CustomerPayBillOnline`. Keep the consumer key, secret, and passkey in Railway variables; never send them in chat.

The admin Sales Reports page uses the staff-only `GET /api/bookings/report/` endpoint. Optional `start_date` and `end_date` query parameters use `YYYY-MM-DD`; revenue totals include confirmed bookings only.

Run `python manage.py migrate` after deployment. Configure a daily Railway cron job to run:

```sh
python manage.py send_trip_reminders
```

This command releases expired 10-minute checkout holds and sends reminders for confirmed trips departing today or tomorrow. Booking holds, receipt emails, and WhatsApp messages are not active until their provider credentials and templates are configured.
