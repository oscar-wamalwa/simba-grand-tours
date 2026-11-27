import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Download, Edit2, Plus, RefreshCw, TicketCheck, Trash2, X } from 'lucide-react';
import api from '../api';

const initialDeparture = {
  safari: '',
  start_date: '',
  end_date: '',
  seats_total: '',
  price_kes: '',
  pickup_time: '',
  pickup_points: '',
};

const initialManualBooking = {
  departure: '', full_name: '', email: '', phone: '', traveler_location: '',
  participant_count: '1', full_amount_kes: '', amount_kes: '', mpesa_receipt: '', status: 'confirmed',
};

function downloadCsv(filename, rows) {
  const contents = rows
    .map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const url = URL.createObjectURL(new Blob([contents], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function BookingsView({ formatPrice }) {
  const [safaris, setSafaris] = useState([]);
  const [departures, setDepartures] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [departureForm, setDepartureForm] = useState(initialDeparture);
  const [selectedDeparture, setSelectedDeparture] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editingDeparture, setEditingDeparture] = useState(null);
  const [departureEditForm, setDepartureEditForm] = useState(null);
  const [editingBooking, setEditingBooking] = useState(null);
  const [bookingEditForm, setBookingEditForm] = useState(null);
  const [manualBooking, setManualBooking] = useState(null);
  const [manualForm, setManualForm] = useState(null);
  const [editError, setEditError] = useState('');
  const [showArchivedDepartures, setShowArchivedDepartures] = useState(false);

  const filteredBookings = useMemo(
    () => bookings.filter(booking => !selectedDeparture || String(booking.departure) === selectedDeparture),
    [bookings, selectedDeparture],
  );
  const visibleDepartures = departures.filter(departure => Boolean(departure.is_archived) === showArchivedDepartures);

  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      const [safariData, departureData, bookingData] = await Promise.all([
        api.safaris.getAll(),
        api.departures.getAll(),
        api.bookings.getAll(),
      ]);
      setSafaris(safariData);
      setDepartures(departureData);
      setBookings(bookingData);
    } catch (requestError) {
      console.error('Could not load bookings and departures:', requestError);
      setError('Could not load booking data. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const createDeparture = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await api.departures.create({
        ...departureForm,
        safari: Number(departureForm.safari),
        seats_total: Number(departureForm.seats_total),
        price_kes: Number(departureForm.price_kes),
        end_date: departureForm.end_date || null,
        pickup_points: departureForm.pickup_points.split('\n').map(item => item.trim()).filter(Boolean),
      });
      setDepartureForm(initialDeparture);
      setMessage('Departure created.');
      await refresh();
    } catch (requestError) {
      setError(requestError.message || 'Could not create departure.');
    } finally {
      setSaving(false);
    }
  };

  const openDepartureEditor = departure => {
    setEditingDeparture(departure);
    setDepartureEditForm({
      start_date: departure.start_date,
      end_date: departure.end_date || '',
      seats_available: String(departure.seats_available),
      price_kes: String(departure.price_kes),
      pickup_time: departure.pickup_time || '',
      pickup_points: (departure.pickup_points || []).join('\n'),
      is_open: departure.is_open,
    });
    setEditError('');
  };

  const saveDeparture = async event => {
    event.preventDefault();
    setSaving(true);
    setEditError('');
    const data = {};
    for (const key of ['start_date', 'end_date', 'pickup_time', 'is_open']) {
      const oldValue = editingDeparture[key] ?? (key === 'end_date' ? '' : editingDeparture[key]);
      if (departureEditForm[key] !== oldValue) data[key] = departureEditForm[key] || (key === 'end_date' ? null : departureEditForm[key]);
    }
    for (const key of ['seats_available', 'price_kes']) {
      if (Number(departureEditForm[key]) !== editingDeparture[key]) data[key] = Number(departureEditForm[key]);
    }
    const points = departureEditForm.pickup_points.split('\n').map(item => item.trim()).filter(Boolean);
    if (JSON.stringify(points) !== JSON.stringify(editingDeparture.pickup_points || [])) data.pickup_points = points;
    try {
      if (Object.keys(data).length) await api.departures.partialUpdate(editingDeparture.id, data);
      setEditingDeparture(null);
      setMessage('Departure updated.');
      await refresh();
    } catch (requestError) {
      setEditError(requestError.message || 'Could not update departure.');
    } finally {
      setSaving(false);
    }
  };

  const openBookingEditor = booking => {
    setEditingBooking(booking);
    setBookingEditForm({
      departure: String(booking.departure),
      full_name: booking.full_name,
      email: booking.email,
      phone: booking.phone,
      passengers: Array.from({ length: booking.participant_count }, (_, index) => (
        booking.passengers?.[index] || { full_name: '', phone: '', emergency_contact: '' }
      )),
    });
    setEditError('');
  };

  const saveBooking = async event => {
    event.preventDefault();
    const tripChanged = Number(bookingEditForm.departure) !== editingBooking.departure
      || bookingEditForm.passengers.length !== editingBooking.participant_count;
    if (tripChanged && !window.confirm('The recorded price and payment will not change. Arrange any price adjustment separately. Travelers are not automatically notified. Continue?')) return;
    setSaving(true);
    setEditError('');
    try {
      await api.bookings.editDetails(editingBooking.id, {
        ...bookingEditForm,
        departure: Number(bookingEditForm.departure),
        participant_count: bookingEditForm.passengers.length,
      });
      setEditingBooking(null);
      setMessage('Booking updated. Recorded prices and payments were not changed.');
      await refresh();
    } catch (requestError) {
      setEditError(requestError.message || 'Could not update booking.');
    } finally {
      setSaving(false);
    }
  };

  const bookingTripLocked = editingBooking && ['pending_payment', 'payment_failed'].includes(editingBooking.status);

  const openManualBooking = booking => {
    setManualBooking(booking);
    setManualForm(booking ? {
      departure: String(booking.departure), full_name: booking.full_name, email: booking.email,
      phone: booking.phone, traveler_location: booking.traveler_location,
      participant_count: String(booking.participant_count), full_amount_kes: String(booking.full_amount_kes),
      amount_kes: String(booking.amount_kes), mpesa_receipt: booking.mpesa_receipt, status: booking.status,
    } : { ...initialManualBooking });
    setEditError('');
  };

  const saveManualBooking = async event => {
    event.preventDefault();
    if (manualBooking && manualBooking.status !== manualForm.status && manualForm.status !== 'confirmed'
      && !window.confirm('This releases reserved seats. No refund is issued automatically. Continue?')) return;
    setSaving(true);
    setEditError('');
    try {
      const data = {
        ...manualForm,
        departure: Number(manualForm.departure),
        participant_count: Number(manualForm.participant_count),
        full_amount_kes: Number(manualForm.full_amount_kes),
        amount_kes: Number(manualForm.amount_kes),
      };
      if (manualBooking) await api.bookings.editManual(manualBooking.id, data);
      else await api.bookings.createManual(data);
      setManualForm(null);
      setManualBooking(null);
      setMessage(manualBooking ? 'Manual booking updated.' : 'Manual booking recorded.');
      await refresh();
    } catch (requestError) {
      setEditError(requestError.message || 'Could not save manual booking.');
    } finally {
      setSaving(false);
    }
  };

  const toggleDepartureArchive = async departure => {
    const restoring = departure.is_archived;
    const warning = restoring
      ? 'Restore this departure? If it is open and upcoming, travelers will be able to book it again.'
      : 'Archive this departure? It will disappear from the public site, but bookings, receipts and waitlist entries will be kept. Pending payments may still complete.';
    if (!window.confirm(warning)) return;
    setError('');
    setMessage('');
    setLoading(true);
    try {
      await api.departures.partialUpdate(departure.id, { is_archived: !restoring });
      setMessage(restoring ? 'Departure restored.' : 'Departure archived. Booking records were kept.');
      await refresh();
    } catch (requestError) {
      setError(requestError.message || 'Could not update departure.');
      setLoading(false);
    }
  };

  const deleteDeparture = async departure => {
    if (!window.confirm(`Permanently delete the departure for ${departure.safari_title} on ${departure.start_date}? This also deletes its waitlist entries. Departures with bookings cannot be deleted; archive them instead.`)) return;
    setError('');
    setMessage('');
    setLoading(true);
    try {
      await api.departures.delete(departure.id);
      if (selectedDeparture === String(departure.id)) setSelectedDeparture('');
      setMessage('Departure deleted.');
      await refresh();
    } catch (requestError) {
      setError(requestError.message || 'Could not delete departure.');
      setLoading(false);
    }
  };

  const cancelBooking = async (booking) => {
    if (!window.confirm(`Cancel pending booking ${booking.reference}?`)) return;
    setError('');
    try {
      await api.bookings.cancel(booking.id);
      await refresh();
    } catch (requestError) {
      setError(requestError.message || 'Could not cancel booking.');
    }
  };

  const deleteBooking = async (booking) => {
    const pendingPaymentWarning = booking.status === 'pending_payment'
      ? '\n\nA payment prompt may still complete, but its callback can no longer be matched.'
      : '';
    const confirmed = window.confirm(
      `Permanently delete booking ${booking.reference} for ${booking.full_name}?\n\nThis removes its passenger details and M-Pesa receipt reference. It does not issue a refund and cannot be undone.${pendingPaymentWarning}`
    );
    if (!confirmed) return;
    setError('');
    setMessage('');
    try {
      await api.bookings.delete(booking.id);
      window.alert(`Booking ${booking.reference} deleted successfully.`);
      await refresh();
    } catch (requestError) {
      setError(requestError.message || 'Could not delete booking.');
    }
  };

  const exportManifest = (departure) => {
    const departureBookings = bookings.filter(booking =>
      String(booking.departure) === String(departure.id) && booking.status === 'confirmed'
    );
    const rows = [[
      'Booking reference',
      'Trip',
      'Departure date',
      'Passenger name',
      'Booking contact',
      'Email',
      'Phone',
      'Participants',
      'Full amount (KES)',
      'Booking fee paid (KES)',
      'Balance due (KES)',
      'M-Pesa receipt',
    ]];
    departureBookings.forEach(booking => {
      const passengers = booking.passengers?.length
        ? booking.passengers
        : [{ full_name: booking.full_name }];
      passengers.forEach(passenger => rows.push([
        booking.reference,
        booking.safari_title,
        booking.departure_date,
        passenger.full_name,
        booking.full_name,
        booking.email,
        booking.phone,
        booking.participant_count,
        booking.full_amount_kes,
        booking.amount_kes,
        booking.balance_due_kes,
        booking.mpesa_receipt,
      ]));
    });
    downloadCsv(`passenger-manifest-${departure.start_date}.csv`, rows);
  };

  return (
    <div className="booking-admin-view">
      <section className="data-card">
        <div className="data-card-header">
          <div>
            <h3>Trip departures and seat availability</h3>
            <p>Create, edit, archive or delete departures. Archived departures retain their booking records.</p>
          </div>
          <button type="button" className="btn-secondary" onClick={refresh} disabled={loading}>
            <RefreshCw size={17} className={loading ? 'refresh-spin' : undefined} /> {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
        {error && <p className="form-status error" role="alert">{error}</p>}
        {message && <p className="form-status success" role="status">{message}</p>}
        <form className="departure-create-form" onSubmit={createDeparture}>
          <label>Safari
            <select required value={departureForm.safari} onChange={event => setDepartureForm(prev => ({ ...prev, safari: event.target.value }))}>
              <option value="">Select a trip</option>
              {safaris.map(safari => <option key={safari.id} value={safari.id}>{safari.title}</option>)}
            </select>
          </label>
          <label>Start date
            <input type="date" required value={departureForm.start_date} onChange={event => setDepartureForm(prev => ({ ...prev, start_date: event.target.value }))} />
          </label>
          <label>End date
            <input type="date" value={departureForm.end_date} onChange={event => setDepartureForm(prev => ({ ...prev, end_date: event.target.value }))} />
          </label>
          <label>Seat capacity
            <input type="number" min="1" step="1" required value={departureForm.seats_total} onChange={event => setDepartureForm(prev => ({ ...prev, seats_total: event.target.value }))} />
          </label>
          <label>Price per person (KES)
            <input type="number" min="1" step="1" required value={departureForm.price_kes} onChange={event => setDepartureForm(prev => ({ ...prev, price_kes: event.target.value }))} />
          </label>
          <label>Pickup time
            <input value={departureForm.pickup_time} onChange={event => setDepartureForm(prev => ({ ...prev, pickup_time: event.target.value }))} placeholder="e.g. 6:00 AM" />
          </label>
          <label className="departure-pickups">Pickup points (one per line)
            <textarea rows="2" value={departureForm.pickup_points} onChange={event => setDepartureForm(prev => ({ ...prev, pickup_points: event.target.value }))} />
          </label>
          <button type="submit" className="btn-primary" disabled={saving || !safaris.length}>
            <Plus size={18} /> {saving ? 'Saving...' : 'Add departure'}
          </button>
        </form>

        <div className="departure-list">
          <button type="button" className="btn-secondary" onClick={() => setShowArchivedDepartures(value => !value)} aria-pressed={showArchivedDepartures}>
            {showArchivedDepartures ? 'Show current departures' : 'Show archived departures'}
          </button>
          {visibleDepartures.map(departure => (
            <article className="departure-admin-card" key={departure.id}>
              <div>
                <h4>{departure.safari_title}</h4>
                <p><CalendarDays size={15} /> {departure.start_date}{departure.end_date ? ` to ${departure.end_date}` : ''}</p>
                <p>{departure.seats_available} of {departure.seats_total} spots available · Full amount {formatPrice(departure.price_kes)} per person · Booking fee {departure.booking_fee_kes ? formatPrice(departure.booking_fee_kes) : 'not set'} per reservation</p>
                <p>Pickup: {departure.pickup_time || 'not set'} · {departure.is_archived ? 'Archived' : departure.is_open ? 'Open' : 'Closed'}</p>
              </div>
              <div className="campaign-actions">
                <button type="button" className="btn-secondary" onClick={() => openDepartureEditor(departure)}><Edit2 size={17} /> Edit</button>
                <button type="button" className="btn-secondary" onClick={() => exportManifest(departure)}>
                  <Download size={17} /> Passenger manifest
                </button>
                <button type="button" className="btn-secondary" disabled={loading} onClick={() => toggleDepartureArchive(departure)}>{departure.is_archived ? 'Restore' : 'Archive'}</button>
                <button type="button" className="btn-danger" disabled={loading} onClick={() => deleteDeparture(departure)}><Trash2 size={15} /> Delete</button>
              </div>
            </article>
          ))}
          {!loading && visibleDepartures.length === 0 && <p>{showArchivedDepartures ? 'No archived departures.' : 'No current departures.'}</p>}
        </div>
      </section>

      <section className="data-card">
        <div className="data-card-header">
          <h3><TicketCheck size={20} /> Bookings and payment receipts</h3>
          <button type="button" className="btn-primary" onClick={() => openManualBooking(null)}><Plus size={18} /> Add manual booking</button>
          <label className="booking-filter">Filter by departure
            <select value={selectedDeparture} onChange={event => setSelectedDeparture(event.target.value)}>
              <option value="">All departures</option>
              {departures.map(departure => <option key={departure.id} value={departure.id}>{departure.safari_title} · {departure.start_date}</option>)}
            </select>
          </label>
        </div>
        <div className="data-table-wrapper">
          <table className="data-table booking-table">
            <thead><tr><th>Reference</th><th>Trip / date</th><th>Traveler</th><th>Guests</th><th>Full amount</th><th>Booking fee paid</th><th>Balance due</th><th>Status</th><th>M-Pesa receipt</th><th>Action</th></tr></thead>
            <tbody>
              {filteredBookings.map(booking => (
                <tr key={booking.id}>
                  <td>{booking.reference}{booking.is_manual && <><br /><small>Manual</small></>}</td>
                  <td>{booking.safari_title}<br />{booking.departure_date}</td>
                  <td>{booking.full_name}{booking.email && <><br />{booking.email}</>}<br />{booking.phone}{booking.traveler_location && <><br />{booking.traveler_location}</>}</td>
                  <td>{booking.participant_count}</td>
                  <td>{formatPrice(booking.full_amount_kes)}</td>
                  <td>{formatPrice(booking.amount_kes)}</td>
                  <td>{formatPrice(booking.balance_due_kes)}</td>
                  <td><span className={`status-badge ${booking.status === 'confirmed' ? 'active' : 'archived'}`}>{booking.status.replaceAll('_', ' ')}</span></td>
                  <td>{booking.mpesa_receipt || '—'}</td>
                  <td>
                    <div className="table-actions">
                      <button type="button" className="btn-secondary" onClick={() => booking.is_manual ? openManualBooking(booking) : openBookingEditor(booking)}><Edit2 size={15} /> Edit</button>
                      {booking.status === 'pending_payment' && <button type="button" className="btn-danger" onClick={() => cancelBooking(booking)}>Cancel</button>}
                      <button type="button" className="btn-danger" onClick={() => deleteBooking(booking)} title="Permanently delete booking and receipt">
                        <Trash2 size={15} /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filteredBookings.length === 0 && (
                <tr><td colSpan="10">No bookings for this selection yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {manualForm && (
        <div className="modal-overlay show">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="manual-booking-title">
            <div className="modal-header">
              <h3 id="manual-booking-title">{manualBooking ? `Edit manual booking ${manualBooking.reference}` : 'Add manual booking'}</h3>
              <button type="button" className="modal-close" aria-label="Close manual booking" disabled={saving} onClick={() => setManualForm(null)}><X size={20} /></button>
            </div>
            <form onSubmit={saveManualBooking}>
              <div className="modal-body">
                {editError && <p className="form-status error" role="alert">{editError}</p>}
                <p>Record a payment you have checked separately. No payment or refund is processed here. Confirmed bookings reserve seats. Only the booking contact is added to the passenger manifest.</p>
                <div className="form-group">
                  <label htmlFor="manual-departure">Trip and date</label>
                  <select id="manual-departure" required value={manualForm.departure} onChange={event => setManualForm(prev => ({ ...prev, departure: event.target.value }))}>
                    <option value="">Select a departure</option>
                    {departures.filter(item => !item.is_archived || item.id === manualBooking?.departure).map(item => <option key={item.id} value={item.id}>{item.safari_title} · {item.start_date} ({item.seats_available} available)</option>)}
                  </select>
                </div>
                <div className="form-row">
                  <div className="form-group"><label htmlFor="manual-name">Traveler name</label><input id="manual-name" required maxLength="255" value={manualForm.full_name} onChange={event => setManualForm(prev => ({ ...prev, full_name: event.target.value }))} /></div>
                  <div className="form-group"><label htmlFor="manual-phone">Contact number</label><input id="manual-phone" type="tel" required maxLength="30" value={manualForm.phone} onChange={event => setManualForm(prev => ({ ...prev, phone: event.target.value }))} /></div>
                  <div className="form-group"><label htmlFor="manual-location">Traveler location</label><input id="manual-location" required maxLength="255" value={manualForm.traveler_location} onChange={event => setManualForm(prev => ({ ...prev, traveler_location: event.target.value }))} /></div>
                  <div className="form-group"><label htmlFor="manual-email">Email (optional)</label><input id="manual-email" type="email" value={manualForm.email} onChange={event => setManualForm(prev => ({ ...prev, email: event.target.value }))} /></div>
                  <div className="form-group"><label htmlFor="manual-guests">Guests</label><input id="manual-guests" type="number" min="1" max="20" step="1" required value={manualForm.participant_count} onChange={event => setManualForm(prev => ({ ...prev, participant_count: event.target.value }))} /></div>
                  <div className="form-group"><label htmlFor="manual-total">Full amount (KES)</label><input id="manual-total" type="number" min="1" max="2147483647" step="1" required value={manualForm.full_amount_kes} onChange={event => setManualForm(prev => ({ ...prev, full_amount_kes: event.target.value }))} /></div>
                  <div className="form-group"><label htmlFor="manual-paid">Amount received (KES)</label><input id="manual-paid" type="number" min="1" max="2147483647" step="1" required value={manualForm.amount_kes} onChange={event => setManualForm(prev => ({ ...prev, amount_kes: event.target.value }))} /></div>
                  <div className="form-group"><label htmlFor="manual-receipt">M-Pesa reference code</label><input id="manual-receipt" required maxLength="30" value={manualForm.mpesa_receipt} onChange={event => setManualForm(prev => ({ ...prev, mpesa_receipt: event.target.value }))} /></div>
                  <div className="form-group"><label htmlFor="manual-status">Status</label><select id="manual-status" value={manualForm.status} onChange={event => setManualForm(prev => ({ ...prev, status: event.target.value }))}><option value="confirmed">Confirmed</option><option value="refund_required">Refund required</option><option value="cancelled">Cancelled</option></select></div>
                </div>
                <p>Balance due: {manualForm.full_amount_kes && manualForm.amount_kes && Number(manualForm.amount_kes) <= Number(manualForm.full_amount_kes) ? formatPrice(Number(manualForm.full_amount_kes) - Number(manualForm.amount_kes)) : 'Enter valid amounts'}</p>
                <p>The booking reference is generated automatically.</p>
              </div>
              <div className="modal-footer"><button type="button" className="btn-secondary" disabled={saving} onClick={() => setManualForm(null)}>Cancel</button><button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save booking'}</button></div>
            </form>
          </div>
        </div>
      )}

      {editingDeparture && (
        <div className="modal-overlay show">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="edit-departure-title">
            <div className="modal-header">
              <h3 id="edit-departure-title">Edit departure: {editingDeparture.safari_title}</h3>
              <button type="button" className="modal-close" aria-label="Close departure editor" disabled={saving} onClick={() => setEditingDeparture(null)}><X size={20} /></button>
            </div>
            <form onSubmit={saveDeparture}>
              <div className="modal-body">
                {editError && <p className="form-status error" role="alert">{editError}</p>}
                <p>Available seats are added to existing confirmed bookings and active payment holds to calculate capacity. Existing booking prices do not change; travelers are not notified automatically.</p>
                <div className="form-row">
                  <div className="form-group"><label htmlFor="edit-start-date">Start date</label><input id="edit-start-date" type="date" required value={departureEditForm.start_date} onChange={event => setDepartureEditForm(prev => ({ ...prev, start_date: event.target.value }))} /></div>
                  <div className="form-group"><label htmlFor="edit-end-date">End date</label><input id="edit-end-date" type="date" value={departureEditForm.end_date} onChange={event => setDepartureEditForm(prev => ({ ...prev, end_date: event.target.value }))} /></div>
                  <div className="form-group"><label htmlFor="edit-seats-left">Seats left</label><input id="edit-seats-left" type="number" min="0" step="1" required value={departureEditForm.seats_available} onChange={event => setDepartureEditForm(prev => ({ ...prev, seats_available: event.target.value }))} /></div>
                  <div className="form-group"><label htmlFor="edit-departure-price">Price per person (KES)</label><input id="edit-departure-price" type="number" min="1" step="1" required value={departureEditForm.price_kes} onChange={event => setDepartureEditForm(prev => ({ ...prev, price_kes: event.target.value }))} /></div>
                  <div className="form-group"><label htmlFor="edit-pickup-time">Pickup time</label><input id="edit-pickup-time" value={departureEditForm.pickup_time} onChange={event => setDepartureEditForm(prev => ({ ...prev, pickup_time: event.target.value }))} /></div>
                </div>
                <div className="form-group"><label htmlFor="edit-pickup-points">Pickup points (one per line)</label><textarea id="edit-pickup-points" rows="3" value={departureEditForm.pickup_points} onChange={event => setDepartureEditForm(prev => ({ ...prev, pickup_points: event.target.value }))} /></div>
                <label><input type="checkbox" checked={departureEditForm.is_open} onChange={event => setDepartureEditForm(prev => ({ ...prev, is_open: event.target.checked }))} /> Open for bookings</label>
              </div>
              <div className="modal-footer"><button type="button" className="btn-secondary" disabled={saving} onClick={() => setEditingDeparture(null)}>Cancel</button><button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</button></div>
            </form>
          </div>
        </div>
      )}

      {editingBooking && (
        <div className="modal-overlay show">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="edit-booking-title">
            <div className="modal-header">
              <h3 id="edit-booking-title">Edit booking {editingBooking.reference}</h3>
              <button type="button" className="modal-close" aria-label="Close booking editor" disabled={saving} onClick={() => setEditingBooking(null)}><X size={20} /></button>
            </div>
            <form onSubmit={saveBooking}>
              <div className="modal-body">
                {editError && <p className="form-status error" role="alert">{editError}</p>}
                <p>Recorded prices and payments do not change. Arrange any adjustment separately and notify travelers of changes yourself.</p>
                <div className="form-group"><label htmlFor="edit-booking-departure">Departure</label><select id="edit-booking-departure" disabled={bookingTripLocked} value={bookingEditForm.departure} onChange={event => setBookingEditForm(prev => ({ ...prev, departure: event.target.value }))}><option value={editingBooking.departure}>{editingBooking.safari_title} · {editingBooking.departure_date}</option>{departures.filter(item => item.id !== editingBooking.departure && item.is_open && !item.is_archived).map(item => <option key={item.id} value={item.id}>{item.safari_title} · {item.start_date} ({item.seats_available} available)</option>)}</select></div>
                <div className="form-row">
                  <div className="form-group"><label htmlFor="edit-booking-name">Booking contact name</label><input id="edit-booking-name" required maxLength="255" value={bookingEditForm.full_name} onChange={event => setBookingEditForm(prev => ({ ...prev, full_name: event.target.value }))} /></div>
                  <div className="form-group"><label htmlFor="edit-booking-email">Email</label><input id="edit-booking-email" type="email" required value={bookingEditForm.email} onChange={event => setBookingEditForm(prev => ({ ...prev, email: event.target.value }))} /></div>
                  <div className="form-group"><label htmlFor="edit-booking-phone">Phone</label><input id="edit-booking-phone" required maxLength="30" value={bookingEditForm.phone} onChange={event => setBookingEditForm(prev => ({ ...prev, phone: event.target.value }))} /></div>
                </div>
                <h4>Travelers ({bookingEditForm.passengers.length})</h4>
                {bookingEditForm.passengers.map((passenger, index) => (
                  <div key={passenger.id || `new-${index}`} className="form-row">
                    {['full_name', 'phone', 'emergency_contact'].map(field => (
                      <div className="form-group" key={field}><label htmlFor={`traveler-${index}-${field}`}>{field === 'full_name' ? `Traveler ${index + 1} name` : field === 'phone' ? 'Phone' : 'Emergency contact'}</label><input id={`traveler-${index}-${field}`} required={field === 'full_name'} maxLength={field === 'phone' ? 30 : 255} value={passenger[field] || ''} onChange={event => setBookingEditForm(prev => ({ ...prev, passengers: prev.passengers.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: event.target.value } : item) }))} /></div>
                    ))}
                    <button type="button" className="btn-danger" disabled={bookingTripLocked || bookingEditForm.passengers.length === 1} onClick={() => setBookingEditForm(prev => ({ ...prev, passengers: prev.passengers.filter((_, itemIndex) => itemIndex !== index) }))}>Remove traveler</button>
                  </div>
                ))}
                <button type="button" className="btn-secondary" disabled={bookingTripLocked || bookingEditForm.passengers.length >= 20} onClick={() => setBookingEditForm(prev => ({ ...prev, passengers: [...prev.passengers, { full_name: '', phone: '', emergency_contact: '' }] }))}>Add traveler</button>
                {bookingTripLocked && <p>Departure and traveler count cannot be changed while payment may still complete.</p>}
              </div>
              <div className="modal-footer"><button type="button" className="btn-secondary" disabled={saving} onClick={() => setEditingBooking(null)}>Cancel</button><button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
