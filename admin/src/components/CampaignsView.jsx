import { useEffect, useState } from 'react';
import { Megaphone, Plus, RefreshCw, TicketPercent, Users } from 'lucide-react';
import api from '../api';
import { formatKes } from '../currency';

const initialPromo = {
  code: '',
  discount_type: 'percent',
  value: '',
  starts_at: '',
  ends_at: '',
  max_uses: '',
  min_participants: 1,
};

const initialAnnouncement = {
  title: '',
  message: '',
  image: '',
  link_url: '',
  starts_at: '',
  ends_at: '',
};

const asUtcTimestamp = value => value ? new Date(value).toISOString() : null;

export default function CampaignsView() {
  const [promos, setPromos] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [waitlist, setWaitlist] = useState([]);
  const [promoForm, setPromoForm] = useState(initialPromo);
  const [announcementForm, setAnnouncementForm] = useState(initialAnnouncement);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      const [promoData, announcementData, waitlistData] = await Promise.all([
        api.promoCodes.getAll(),
        api.announcements.getAll(),
        api.waitlist.getAll(),
      ]);
      setPromos(promoData);
      setAnnouncements(announcementData);
      setWaitlist(waitlistData);
    } catch (requestError) {
      console.error('Could not load campaign data:', requestError);
      setError('Could not load promo codes, announcements, or waitlist.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const createPromo = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      await api.promoCodes.create({
        ...promoForm,
        value: Number(promoForm.value),
        starts_at: asUtcTimestamp(promoForm.starts_at),
        ends_at: asUtcTimestamp(promoForm.ends_at),
        max_uses: promoForm.max_uses ? Number(promoForm.max_uses) : null,
        min_participants: Number(promoForm.min_participants),
      });
      setPromoForm(initialPromo);
      setMessage('Promo code created.');
      await refresh();
    } catch (requestError) {
      setError(requestError.message || 'Could not create promo code.');
    }
  };

  const createAnnouncement = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      await api.announcements.create({
        ...announcementForm,
        starts_at: asUtcTimestamp(announcementForm.starts_at),
        ends_at: asUtcTimestamp(announcementForm.ends_at),
      });
      setAnnouncementForm(initialAnnouncement);
      setMessage('Announcement published.');
      await refresh();
    } catch (requestError) {
      setError(requestError.message || 'Could not publish announcement.');
    }
  };

  const updateWaitlistStatus = async (entry, nextStatus) => {
    setError('');
    try {
      await api.waitlist.update(entry.id, { status: nextStatus });
      await refresh();
    } catch (requestError) {
      setError(requestError.message || 'Could not update waitlist entry.');
    }
  };

  const toggleAnnouncement = async (item) => {
    setError('');
    try {
      await api.announcements.update(item.id, { active: !item.active });
      await refresh();
    } catch (requestError) {
      setError(requestError.message || 'Could not update announcement.');
    }
  };

  const togglePromo = async (promo) => {
    setError('');
    try {
      await api.promoCodes.update(promo.id, { active: !promo.active });
      await refresh();
    } catch (requestError) {
      setError(requestError.message || 'Could not update promo code.');
    }
  };

  return (
    <div className="campaigns-admin-view">
      {error && <p className="form-status error" role="alert">{error}</p>}
      {message && <p className="form-status success" role="status">{message}</p>}
      <div className="data-card">
        <div className="data-card-header">
          <h3><TicketPercent size={20} /> Promo codes</h3>
          <button type="button" className="btn-secondary" onClick={refresh} disabled={loading}><RefreshCw size={17} /> Refresh</button>
        </div>
        <form className="departure-create-form" onSubmit={createPromo}>
          <label>Code<input required maxLength="40" value={promoForm.code} onChange={event => setPromoForm(prev => ({ ...prev, code: event.target.value.toUpperCase() }))} /></label>
          <label>Discount type
            <select value={promoForm.discount_type} onChange={event => setPromoForm(prev => ({ ...prev, discount_type: event.target.value }))}>
              <option value="percent">Percent</option><option value="fixed_kes">Fixed KES</option>
            </select>
          </label>
          <label>{promoForm.discount_type === 'percent' ? 'Percent off' : 'KES off'}
            <input type="number" min="1" step={promoForm.discount_type === 'percent' ? '0.01' : '1'} max={promoForm.discount_type === 'percent' ? '100' : undefined} required value={promoForm.value} onChange={event => setPromoForm(prev => ({ ...prev, value: event.target.value }))} />
          </label>
          <label>Valid from<input type="datetime-local" value={promoForm.starts_at} onChange={event => setPromoForm(prev => ({ ...prev, starts_at: event.target.value }))} /></label>
          <label>Valid until<input type="datetime-local" value={promoForm.ends_at} onChange={event => setPromoForm(prev => ({ ...prev, ends_at: event.target.value }))} /></label>
          <label>Maximum uses<input type="number" min="1" step="1" value={promoForm.max_uses} onChange={event => setPromoForm(prev => ({ ...prev, max_uses: event.target.value }))} placeholder="Unlimited" /></label>
          <label>Minimum travelers<input type="number" min="1" step="1" required value={promoForm.min_participants} onChange={event => setPromoForm(prev => ({ ...prev, min_participants: event.target.value }))} /></label>
          <button type="submit" className="btn-primary"><Plus size={18} /> Add promo</button>
        </form>
        <div className="campaign-list">
          {promos.map(promo => (
            <article key={promo.id} className="campaign-row">
              <div><strong>{promo.code}</strong><p>{promo.discount_type === 'percent' ? `${promo.value}% off` : `${formatKes(promo.value)} off`} · {promo.uses_count}{promo.max_uses ? `/${promo.max_uses}` : ''} uses</p></div>
              <button type="button" className={`status-badge ${promo.active ? 'active' : 'archived'}`} onClick={() => togglePromo(promo)}>{promo.active ? 'Active' : 'Inactive'}</button>
            </article>
          ))}
          {!loading && promos.length === 0 && <p>No promo codes created yet.</p>}
        </div>
      </div>

      <div className="data-card">
        <div className="data-card-header"><h3><Megaphone size={20} /> Seasonal announcements</h3></div>
        <form className="departure-create-form" onSubmit={createAnnouncement}>
          <label>Headline<input required maxLength="180" value={announcementForm.title} onChange={event => setAnnouncementForm(prev => ({ ...prev, title: event.target.value }))} /></label>
          <label>Image URL<input type="url" value={announcementForm.image} onChange={event => setAnnouncementForm(prev => ({ ...prev, image: event.target.value }))} /></label>
          <label>Link URL<input type="url" value={announcementForm.link_url} onChange={event => setAnnouncementForm(prev => ({ ...prev, link_url: event.target.value }))} /></label>
          <label>Show from<input type="datetime-local" value={announcementForm.starts_at} onChange={event => setAnnouncementForm(prev => ({ ...prev, starts_at: event.target.value }))} /></label>
          <label>Show until<input type="datetime-local" value={announcementForm.ends_at} onChange={event => setAnnouncementForm(prev => ({ ...prev, ends_at: event.target.value }))} /></label>
          <label className="departure-pickups">Message<textarea required rows="3" value={announcementForm.message} onChange={event => setAnnouncementForm(prev => ({ ...prev, message: event.target.value }))} /></label>
          <button type="submit" className="btn-primary"><Plus size={18} /> Publish announcement</button>
        </form>
        <div className="campaign-list">
          {announcements.map(item => (
            <article key={item.id} className="campaign-row">
              <div><strong>{item.title}</strong><p>{item.message}</p></div>
              <button type="button" className="btn-secondary" onClick={() => toggleAnnouncement(item)}>{item.active ? 'Hide' : 'Publish'}</button>
            </article>
          ))}
          {!loading && announcements.length === 0 && <p>No announcements created yet.</p>}
        </div>
      </div>

      <div className="data-card">
        <div className="data-card-header"><h3><Users size={20} /> Waitlist</h3></div>
        <div className="campaign-list">
          {waitlist.map(entry => (
            <article key={entry.id} className="campaign-row">
              <div><strong>{entry.full_name} · {entry.safari_title}</strong><p>{entry.departure_date} · {entry.participant_count} traveler(s) · {entry.email} · {entry.phone}</p></div>
              <div className="campaign-actions">
                <span className={`status-badge ${entry.status === 'waiting' ? 'active' : 'archived'}`}>{entry.status}</span>
                {entry.status !== 'booked' && entry.status !== 'cancelled' && (
                  <button type="button" className="btn-secondary" onClick={() => updateWaitlistStatus(entry, 'booked')}>Mark booked</button>
                )}
              </div>
            </article>
          ))}
          {!loading && waitlist.length === 0 && <p>No waitlist entries yet.</p>}
        </div>
      </div>
    </div>
  );
}
