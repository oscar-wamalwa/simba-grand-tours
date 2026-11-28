import { useEffect, useState } from 'react';
import { Plus, Users } from 'lucide-react';
import api from '../api';
import Select from './Select';
import RefreshButton from './RefreshButton';
import PromoPoolPanel from './PromoPoolPanel';
import { notify } from '../toast';

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

const asLocalDatetime = value => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

export default function CampaignsView({ formatPrice }) {
  const [promos, setPromos] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [waitlist, setWaitlist] = useState([]);
  const [promoForm, setPromoForm] = useState(initialPromo);
  const [announcementForm, setAnnouncementForm] = useState(initialAnnouncement);
  const [editingPromoId, setEditingPromoId] = useState(null);
  const [editingAnnouncementId, setEditingAnnouncementId] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => { if (message) notify(message); }, [message]);
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
      const promoData = {
        ...promoForm,
        value: Number(promoForm.value),
        starts_at: asUtcTimestamp(promoForm.starts_at),
        ends_at: asUtcTimestamp(promoForm.ends_at),
        max_uses: promoForm.max_uses ? Number(promoForm.max_uses) : null,
        min_participants: Number(promoForm.min_participants),
      };
      if (editingPromoId !== null) {
        await api.promoCodes.update(editingPromoId, promoData);
      } else {
        await api.promoCodes.create(promoData);
      }
      setPromoForm(initialPromo);
      setEditingPromoId(null);
      setMessage(editingPromoId !== null ? 'Promo code updated.' : 'Promo code created.');
      await refresh();
    } catch (requestError) {
      setError(requestError.message || 'Could not save promo code.');
    }
  };

  const createAnnouncement = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      const announcementData = {
        ...announcementForm,
        starts_at: asUtcTimestamp(announcementForm.starts_at),
        ends_at: asUtcTimestamp(announcementForm.ends_at),
      };
      if (editingAnnouncementId !== null) {
        await api.announcements.update(editingAnnouncementId, announcementData);
      } else {
        await api.announcements.create(announcementData);
      }
      setAnnouncementForm(initialAnnouncement);
      setEditingAnnouncementId(null);
      setMessage(editingAnnouncementId !== null ? 'Announcement updated.' : 'Announcement published.');
      await refresh();
    } catch (requestError) {
      setError(requestError.message || 'Could not save announcement.');
    }
  };

  const editPromo = promo => {
    setPromoForm({
      code: promo.code || '',
      discount_type: promo.discount_type || 'percent',
      value: String(promo.value ?? ''),
      starts_at: asLocalDatetime(promo.starts_at),
      ends_at: asLocalDatetime(promo.ends_at),
      max_uses: promo.max_uses == null ? '' : String(promo.max_uses),
      min_participants: promo.min_participants ?? 1,
    });
    setEditingPromoId(promo.id);
    setError('');
    setMessage('');
  };

  const editAnnouncement = item => {
    setAnnouncementForm({
      title: item.title || '',
      message: item.message || '',
      image: item.image || '',
      link_url: item.link_url || '',
      starts_at: asLocalDatetime(item.starts_at),
      ends_at: asLocalDatetime(item.ends_at),
    });
    setEditingAnnouncementId(item.id);
    setError('');
    setMessage('');
  };

  const cancelPromoEdit = () => {
    setPromoForm(initialPromo);
    setEditingPromoId(null);
    setError('');
    setMessage('');
  };

  const cancelAnnouncementEdit = () => {
    setAnnouncementForm(initialAnnouncement);
    setEditingAnnouncementId(null);
    setError('');
    setMessage('');
  };

  const deletePromo = async promo => {
    const confirmed = window.confirm(
      `Delete promo code "${promo.code}"? This cannot be undone. Existing bookings will keep their recorded discount but lose their link to this promo code.`,
    );
    if (!confirmed) return;

    setError('');
    setMessage('');
    try {
      await api.promoCodes.delete(promo.id);
      setMessage('Promo code deleted.');
      await refresh();
    } catch (requestError) {
      setError(requestError.message || 'Could not delete promo code.');
    }
  };

  const deleteAnnouncement = async item => {
    if (!window.confirm(`Delete the announcement "${item.title}"? This cannot be undone.`)) return;

    setError('');
    setMessage('');
    try {
      await api.announcements.delete(item.id);
      setMessage('Announcement deleted.');
      await refresh();
    } catch (requestError) {
      setError(requestError.message || 'Could not delete announcement.');
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
          <h3>Promo codes</h3>
          <RefreshButton onClick={refresh} loading={loading} />
        </div>
        <form className="departure-create-form" onSubmit={createPromo}>
          <label>Code<input required maxLength="40" value={promoForm.code} onChange={event => setPromoForm(prev => ({ ...prev, code: event.target.value.toUpperCase() }))} /></label>
          <label>Discount type
            <Select value={promoForm.discount_type} onChange={event => setPromoForm(prev => ({ ...prev, discount_type: event.target.value }))}>
              <option value="percent">Percent</option><option value="fixed_kes">Fixed KES</option>
            </Select>
          </label>
          <label>{promoForm.discount_type === 'percent' ? 'Percent off' : 'KES off'}
            <input type="number" min="1" step={promoForm.discount_type === 'percent' ? '0.01' : '1'} max={promoForm.discount_type === 'percent' ? '100' : undefined} required value={promoForm.value} onChange={event => setPromoForm(prev => ({ ...prev, value: event.target.value }))} />
          </label>
          <label>Valid from<input type="datetime-local" value={promoForm.starts_at} onChange={event => setPromoForm(prev => ({ ...prev, starts_at: event.target.value }))} /></label>
          <label>Valid until<input type="datetime-local" value={promoForm.ends_at} onChange={event => setPromoForm(prev => ({ ...prev, ends_at: event.target.value }))} /></label>
          <label>Maximum uses<input type="number" min="1" step="1" value={promoForm.max_uses} onChange={event => setPromoForm(prev => ({ ...prev, max_uses: event.target.value }))} placeholder="Unlimited" /></label>
          <label>Minimum travelers<input type="number" min="1" step="1" required value={promoForm.min_participants} onChange={event => setPromoForm(prev => ({ ...prev, min_participants: event.target.value }))} /></label>
          <div className="campaign-actions">
            <button type="submit" className="btn-primary">{editingPromoId !== null ? 'Save changes' : <><Plus size={18} /> Add promo</>}</button>
            {editingPromoId !== null && <button type="button" className="btn-secondary" onClick={cancelPromoEdit}>Cancel</button>}
          </div>
        </form>
        <div className="campaign-list">
          {promos.map(promo => (
            <article key={promo.id} className="campaign-row">
              <div><strong>{promo.code}</strong><p>{promo.discount_type === 'percent' ? `${promo.value}% off` : `${formatPrice(promo.value)} off`} · {promo.uses_count}{promo.max_uses ? `/${promo.max_uses}` : ''} uses</p></div>
              <div className="campaign-actions">
                <button type="button" className={`status-badge ${promo.active ? 'active' : 'archived'}`} onClick={() => togglePromo(promo)}>{promo.active ? 'Active' : 'Inactive'}</button>
                <button type="button" className="btn-secondary" onClick={() => editPromo(promo)}>Edit</button>
                <button type="button" className="btn-danger" onClick={() => deletePromo(promo)}>Delete</button>
              </div>
            </article>
          ))}
          {!loading && promos.length === 0 && <p>No promo codes created yet.</p>}
        </div>
      </div>

      <PromoPoolPanel />

      <div className="data-card">
        <div className="data-card-header"><h3>Seasonal announcements</h3></div>
        <form className="departure-create-form" onSubmit={createAnnouncement}>
          <label>Headline<input required maxLength="180" value={announcementForm.title} onChange={event => setAnnouncementForm(prev => ({ ...prev, title: event.target.value }))} /></label>
          <label>Image URL<input type="url" value={announcementForm.image} onChange={event => setAnnouncementForm(prev => ({ ...prev, image: event.target.value }))} /></label>
          <label>Link URL<input type="url" value={announcementForm.link_url} onChange={event => setAnnouncementForm(prev => ({ ...prev, link_url: event.target.value }))} /></label>
          <label>Show from<input type="datetime-local" value={announcementForm.starts_at} onChange={event => setAnnouncementForm(prev => ({ ...prev, starts_at: event.target.value }))} /></label>
          <label>Show until<input type="datetime-local" value={announcementForm.ends_at} onChange={event => setAnnouncementForm(prev => ({ ...prev, ends_at: event.target.value }))} /></label>
          <label className="departure-pickups">Message<textarea required rows="3" value={announcementForm.message} onChange={event => setAnnouncementForm(prev => ({ ...prev, message: event.target.value }))} /></label>
          <div className="campaign-actions">
            <button type="submit" className="btn-primary">{editingAnnouncementId !== null ? 'Save changes' : <><Plus size={18} /> Publish announcement</>}</button>
            {editingAnnouncementId !== null && <button type="button" className="btn-secondary" onClick={cancelAnnouncementEdit}>Cancel</button>}
          </div>
        </form>
        <div className="campaign-list">
          {announcements.map(item => (
            <article key={item.id} className="campaign-row">
              <div><strong>{item.title}</strong><p>{item.message}</p></div>
              <div className="campaign-actions">
                <button type="button" className="btn-secondary" onClick={() => toggleAnnouncement(item)}>{item.active ? 'Hide' : 'Publish'}</button>
                <button type="button" className="btn-secondary" onClick={() => editAnnouncement(item)}>Edit</button>
                <button type="button" className="btn-danger" onClick={() => deleteAnnouncement(item)}>Delete</button>
              </div>
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
