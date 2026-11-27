# Booking feature deployment

Online booking payments are disabled by default. Customers can contact the team by WhatsApp or phone; inquiries do not automatically reserve seats or create booking records. Existing payment callbacks remain active.

Staff can record and edit manual bookings under Departures and Bookings after checking the M-Pesa payment independently. The booking reference is generated automatically; the contact name, phone, traveler location, payment reference, trip, guest count and amounts are required. The balance is calculated from the full amount and amount received. Confirmed bookings reserve seats automatically; other statuses release them. Editing a record does not process a payment or refund or notify the traveler. The passenger manifest contains only the booking contact for manual bookings. Financial details of online checkout records remain protected.

The default privacy policy and terms are updated for this flow, but admin-customized policy text is preserved. Review any customized text in Settings to ensure it describes the current booking process.

The staff-only Invoices dashboard saves editable invoice records and generates DOCX files with the Simba Grand Tours logo. Business details are copied from website settings when starting an invoice and can be edited per invoice. Enter line-item prices, tax rate and any prior payment in the selected KES or USD currency; there is no automatic conversion. Each line is rounded to two decimal places, tax is added to the subtotal, and the balance is calculated after payments. Invoice numbers are generated automatically. Generating an invoice does not process a payment or submit a tax invoice to a tax authority; check any applicable invoicing requirements separately. Editing a saved invoice does not change documents already downloaded.

To re-enable online payments later, set `ONLINE_PAYMENTS_ENABLED=true` on the backend and `VITE_ONLINE_PAYMENTS_ENABLED=true` when building the client, then deploy both. Verify the payment flow in a sandbox first. The booking flow stores prices and payments as whole Kenyan shillings (KES). Before enabling online payments in Railway, configure:

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

Staff can edit departure dates, available seats, pickup details, pricing and booking availability, and edit booking contacts, travelers and departure. Setting seats left adjusts total capacity around existing reservations and payment holds. Moving a booking or changing its traveler count keeps its recorded prices and payment unchanged; staff must arrange any adjustment and notify travelers separately. Trip and traveler-count edits are blocked while a payment callback may still complete. New departure prices do not change existing bookings.

Staff can archive departures to hide them from public booking while retaining bookings, payment records and waitlists; archived departures can be restored. Pending payments can still complete. Departures without bookings may instead be permanently deleted, which also deletes their waitlist entries. Departures with any booking records must be archived rather than deleted.

Visitors can submit stories from The Simba Pulse. Public submissions are rate-limited and always enter pending review; staff must approve and publish them before they appear publicly.

Newsletter signups can optionally provide a Kenyan mobile number and explicitly opt in to SMS updates. Staff can send subscriber updates by email, SMS, or both from the Subscribers page. Email delivery uses the configured SMTP settings, with a 15-second default connection timeout (`EMAIL_TIMEOUT`); SMS delivery uses Africa's Talking. Configure `AFRICASTALKING_USERNAME`, `AFRICASTALKING_API_KEY`, `AFRICASTALKING_ENVIRONMENT` (`sandbox` or `production`), and the optional `AFRICASTALKING_SENDER_ID` in the backend environment. Keep the API key private. SMS campaigns only target subscribers with recorded SMS consent and a valid phone number; provider charges may apply.

The public Destinations page is managed from the admin Destinations section. Admins can update each card's copy, photos, optional starting price, home-page featuring, visibility, and linked safari packages. The initial destination catalog is created by the database migrations.

Staff can feature up to six testimonials on the homepage, whether or not the traveler is verified. Verification is independent of featuring; only verified testimonials show a Verified badge. Public submissions remain hidden until staff feature them.

The Railway Procfile applies pending migrations at startup. If you deploy with a different start command, run `python manage.py migrate` before serving traffic. Configure a daily Railway cron job to run:

```sh
python manage.py send_trip_reminders
```

This command releases expired 10-minute checkout holds and sends reminders for confirmed trips departing today or tomorrow. Booking holds, receipt emails, and WhatsApp messages are not active until their provider credentials and templates are configured.
