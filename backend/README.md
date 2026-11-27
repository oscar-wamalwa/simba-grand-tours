# Booking feature deployment

The booking flow stores prices and payments as whole Kenyan shillings (KES). Before enabling bookings in Railway, configure:

- `MPESA_ENVIRONMENT` (`sandbox` for testing, `production` for live payments)
- `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_SHORTCODE`, and `MPESA_PASSKEY`
- `MPESA_CALLBACK_URL` as the callback base URL ending in `/api/payments/mpesa/callback`
- `MPESA_CALLBACK_TOKEN` as a long, unique secret. Never commit secrets or send them in chat.
- SMTP settings and `DEFAULT_FROM_EMAIL` for booking receipts and admin replies to contact messages
- Optional WhatsApp Cloud API credentials plus approved booking, reminder, and waitlist template names

The callback endpoint queries Daraja before confirming a successful STK payment. Test with Safaricom sandbox credentials first, and separately verify live credentials before accepting real payments.

For a live Till, set `MPESA_SHORTCODE` to the Safaricom-issued Till number and `MPESA_TRANSACTION_TYPE=CustomerBuyGoodsOnline`. Sandbox PayBill transactions use `CustomerPayBillOnline`. Keep the consumer key, secret, and passkey in Railway variables; never send them in chat.

The admin Sales Reports page uses the staff-only `GET /api/bookings/report/` endpoint. Optional `start_date` and `end_date` query parameters use `YYYY-MM-DD`; revenue totals include confirmed bookings only.

Admins can set a flat reservation booking fee and terms on each safari. The booking fee is charged once per reservation; the departure's per-person price remains the full trip amount. Promo discounts apply to the full amount, and the M-Pesa prompt charges only the configured fee. A successful fee payment reserves the seats and leaves the discounted balance due for collection separately.

Visitors can submit stories from The Simba Pulse. Public submissions are rate-limited and always enter pending review; staff must approve and publish them before they appear publicly.

Newsletter signups can optionally provide a Kenyan mobile number and explicitly opt in to SMS updates. Staff can send subscriber updates by email, SMS, or both from the Subscribers page. Email delivery uses the configured SMTP settings, with a 15-second default connection timeout (`EMAIL_TIMEOUT`); SMS delivery uses Africa's Talking. Configure `AFRICASTALKING_USERNAME`, `AFRICASTALKING_API_KEY`, `AFRICASTALKING_ENVIRONMENT` (`sandbox` or `production`), and the optional `AFRICASTALKING_SENDER_ID` in the backend environment. Keep the API key private. SMS campaigns only target subscribers with recorded SMS consent and a valid phone number; provider charges may apply.

The public Destinations page is managed from the admin Destinations section. Admins can update each card's copy, photos, optional starting price, home-page featuring, visibility, and linked safari packages. The initial destination catalog is created by the database migrations.

The Railway Procfile applies pending migrations at startup. If you deploy with a different start command, run `python manage.py migrate` before serving traffic. Configure a daily Railway cron job to run:

```sh
python manage.py send_trip_reminders
```

This command releases expired 10-minute checkout holds and sends reminders for confirmed trips departing today or tomorrow. Booking holds, receipt emails, and WhatsApp messages are not active until their provider credentials and templates are configured.
