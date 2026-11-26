import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Download, Plus, RefreshCw, TicketCheck, Trash2 } from 'lucide-react';
import api from '../api';
import { formatKes } from '../currency';

const initialDeparture = {
  safari: '',
  start_date: '',
  end_date: '',
  seats_total: '',
  price_kes: '',
  pickup_time: '',
  pickup_points: '',
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

export default function BookingsView() {
  const [safaris, setSafaris] = useState([]);
  const [departures, setDepartures] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [departureForm, setDepartureForm] = useState(initialDeparture);
  const [selectedDeparture, setSelectedDeparture] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const filteredBookings = useMemo(
    () => bookings.filter(booking => !selectedDeparture || String(booking.departure) === selectedDeparture),
    [bookings, selectedDeparture],
  );

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
            <p>Create dated departures with KES pricing and seat capacity.</p>
          </div>
          <button type="button" className="btn-secondary" onClick={refresh} disabled={loading}>
            <RefreshCw size={17} /> Refresh
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
          {departures.map(departure => (
            <article className="departure-admin-card" key={departure.id}>
              <div>
                <h4>{departure.safari_title}</h4>
                <p><CalendarDays size={15} /> {departure.start_date}{departure.end_date ? ` to ${departure.end_date}` : ''}</p>
                <p>{departure.seats_available} of {departure.seats_total} spots available · Full amount {formatKes(departure.price_kes)} per person · Booking fee {departure.booking_fee_kes ? formatKes(departure.booking_fee_kes) : 'not set'} per reservation</p>
              </div>
              <button type="button" className="btn-secondary" onClick={() => exportManifest(departure)}>
                <Download size={17} /> Passenger manifest
              </button>
            </article>
          ))}
          {!loading && departures.length === 0 && <p>No departures have been scheduled.</p>}
        </div>
      </section>

      <section className="data-card">
        <div className="data-card-header">
          <h3><TicketCheck size={20} /> Bookings and payment receipts</h3>
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
                  <td>{booking.reference}</td>
                  <td>{booking.safari_title}<br />{booking.departure_date}</td>
                  <td>{booking.full_name}<br />{booking.email}<br />{booking.phone}</td>
                  <td>{booking.participant_count}</td>
                  <td>{formatKes(booking.full_amount_kes)}</td>
                  <td>{formatKes(booking.amount_kes)}</td>
                  <td>{formatKes(booking.balance_due_kes)}</td>
                  <td><span className={`status-badge ${booking.status === 'confirmed' ? 'active' : 'archived'}`}>{booking.status.replaceAll('_', ' ')}</span></td>
                  <td>{booking.mpesa_receipt || '—'}</td>
                  <td>
                    <div className="table-actions">
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
    </div>
  );
}
