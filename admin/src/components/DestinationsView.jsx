import { useEffect, useState } from 'react';
import { Edit2, Eye, EyeOff, MapPin, Plus, Trash2, X } from 'lucide-react';
import api from '../api';
import { formatKes } from '../currency';

const categories = [
  ['iconic_safaris', 'Iconic Safaris'],
  ['beach_coastal_escapes', 'Beach & Coastal Escapes'],
  ['rift_valley_weekenders', 'Rift Valley Weekenders'],
  ['hidden_gems_road_trips', 'Hidden Gems & Road Trips'],
];

const emptyForm = {
  name: '',
  slug: '',
  category: 'iconic_safaris',
  badge: '',
  duration: '',
  hook: '',
  highlights: [],
  cta_label: '',
  starting_price: '',
  images: [],
  package_ids: [],
  visible: true,
  featured_on_home: false,
  sort_order: 0,
};

const makeSlug = (value) => value
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

export default function DestinationsView() {
  const [destinations, setDestinations] = useState([]);
  const [safaris, setSafaris] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    loadContent();
  }, []);

  const loadContent = async () => {
    setActionError('');
    try {
      const [destinationData, safariData] = await Promise.all([
        api.destinations.getAll(),
        api.safaris.getAll(),
      ]);
      setDestinations(destinationData);
      setSafaris(safariData);
    } catch (error) {
      console.error('Could not load destinations:', error);
      setActionError('Could not load destinations or safari packages. Please try again.');
    }
  };

  const openNewDestination = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setImagePreviews([]);
    setActionError('');
    setShowModal(true);
  };

  const editDestination = (destination) => {
    setEditing(destination);
    setForm({
      ...emptyForm,
      ...destination,
      starting_price: destination.starting_price ?? '',
      highlights: destination.highlights || [],
      images: destination.images || [],
      package_ids: (destination.package_ids || []).map(String),
    });
    setImagePreviews((destination.images || []).map(url => ({ url })));
    setActionError('');
    setShowModal(true);
  };

  const handleImageUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;

    setUploading(true);
    setActionError('');
    try {
      const urls = await Promise.all(files.map(file => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
        reader.readAsDataURL(file);
      })));
      setForm(current => ({ ...current, images: [...current.images, ...urls] }));
      setImagePreviews(current => [...current, ...urls.map(url => ({ url }))]);
    } catch (error) {
      console.error('Could not process destination photos:', error);
      setActionError(error.message || 'Could not process the selected photos.');
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (index) => {
    setForm(current => ({
      ...current,
      images: current.images.filter((_, imageIndex) => imageIndex !== index),
    }));
    setImagePreviews(current => current.filter((_, imageIndex) => imageIndex !== index));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setActionError('');
    const data = {
      ...form,
      slug: form.slug.trim() || makeSlug(form.name),
      starting_price: form.starting_price === '' ? null : Number(form.starting_price),
      sort_order: Number(form.sort_order) || 0,
      highlights: form.highlights,
      package_ids: form.package_ids.map(Number),
    };

    try {
      if (editing) {
        await api.destinations.update(editing.id, data);
      } else {
        await api.destinations.create(data);
      }
      setShowModal(false);
      setEditing(null);
      setForm({ ...emptyForm });
      setImagePreviews([]);
      await loadContent();
    } catch (error) {
      console.error('Could not save destination:', error);
      setActionError(error.message || 'Could not save destination. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const toggleVisibility = async (destination) => {
    setActionError('');
    try {
      await api.destinations.partialUpdate(destination.id, { visible: !destination.visible });
      await loadContent();
    } catch (error) {
      console.error('Could not update destination visibility:', error);
      setActionError('Could not update destination visibility. Please try again.');
    }
  };

  const deleteDestination = async (destination) => {
    if (!window.confirm(`Delete ${destination.name}?`)) return;
    setActionError('');
    try {
      await api.destinations.delete(destination.id);
      await loadContent();
    } catch (error) {
      console.error('Could not delete destination:', error);
      setActionError('Could not delete destination. Please try again.');
    }
  };

  return (
    <div className="data-card fade-in">
      <div className="data-card-header">
        <div>
          <h3>Destination Catalog</h3>
          <p>Manage destination cards, starting prices, photos, and linked safari packages.</p>
        </div>
        <button className="btn-primary" onClick={openNewDestination}>
          <Plus size={18} /> Add Destination
        </button>
      </div>

      {actionError && <p className="form-status error" role="alert">{actionError}</p>}

      <div className="data-table-wrapper">
        <table className="data-table">
          <thead>
            <tr><th>Destination</th><th>Category</th><th>Starting From</th><th>Visibility</th><th>Home</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {destinations.map(destination => (
              <tr key={destination.id}>
                <td>{destination.name}</td>
                <td>{destination.category_label}</td>
                <td>{destination.starting_price ? formatKes(destination.starting_price) : 'Price on request'}</td>
                <td><span className={`status-badge ${destination.visible ? 'active' : 'archived'}`}>{destination.visible ? 'Visible' : 'Hidden'}</span></td>
                <td>{destination.featured_on_home ? 'Featured' : '—'}</td>
                <td>
                  <div className="table-actions">
                    <button className="action-btn" onClick={() => toggleVisibility(destination)} title={destination.visible ? 'Hide' : 'Show'}>
                      {destination.visible ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                    <button className="action-btn" onClick={() => editDestination(destination)} title="Edit destination">
                      <Edit2 size={16} />
                    </button>
                    <button className="action-btn delete" onClick={() => deleteDestination(destination)} title="Delete destination">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {destinations.length === 0 && (
              <tr><td colSpan="6">No destinations yet. Add one to start building the catalog.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay show" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={event => event.stopPropagation()}>
            <div className="modal-header">
              <h3>{editing ? 'Edit Destination' : 'Add Destination'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)} aria-label="Close destination form"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {actionError && <p className="form-status error" role="alert">{actionError}</p>}
                <div className="form-group">
                  <label htmlFor="destination-name">Destination name *</label>
                  <input id="destination-name" value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} required />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="destination-slug">URL slug *</label>
                    <input id="destination-slug" value={form.slug} onChange={event => setForm(current => ({ ...current, slug: makeSlug(event.target.value) }))} placeholder={makeSlug(form.name) || 'destination-name'} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="destination-category">Category *</label>
                    <select id="destination-category" value={form.category} onChange={event => setForm(current => ({ ...current, category: event.target.value }))}>
                      {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="destination-badge">Card badge</label>
                    <input id="destination-badge" value={form.badge} onChange={event => setForm(current => ({ ...current, badge: event.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="destination-duration">Duration</label>
                    <input id="destination-duration" value={form.duration} onChange={event => setForm(current => ({ ...current, duration: event.target.value }))} />
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="destination-hook">Emotional hook *</label>
                  <textarea id="destination-hook" rows="3" value={form.hook} onChange={event => setForm(current => ({ ...current, hook: event.target.value }))} required />
                </div>
                <div className="form-group">
                  <label htmlFor="destination-highlights">Signature highlights (one per line) *</label>
                  <textarea id="destination-highlights" rows="3" value={form.highlights.join('\n')} onChange={event => setForm(current => ({ ...current, highlights: event.target.value.split('\n').map(item => item.trim()).filter(Boolean) }))} required />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="destination-price">Starting From (KES)</label>
                    <input id="destination-price" type="number" min="0" step="1" value={form.starting_price} onChange={event => setForm(current => ({ ...current, starting_price: event.target.value }))} placeholder="Leave blank to show price on request" />
                  </div>
                  <div className="form-group">
                    <label htmlFor="destination-cta">Button label</label>
                    <input id="destination-cta" value={form.cta_label} onChange={event => setForm(current => ({ ...current, cta_label: event.target.value }))} />
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="destination-packages">Safari packages for this destination</label>
                  <select
                    id="destination-packages"
                    multiple
                    value={form.package_ids}
                    onChange={event => setForm(current => ({
                      ...current,
                      package_ids: Array.from(event.target.selectedOptions, option => option.value),
                    }))}
                  >
                    {safaris.map(safari => (
                      <option key={safari.id} value={safari.id}>{safari.title} - {safari.location}</option>
                    ))}
                  </select>
                  <small>Use Ctrl (Windows) or Command (Mac) to select multiple packages.</small>
                </div>
                <div className="form-row">
                  <label className="destination-checkbox">
                    <input type="checkbox" checked={form.visible} onChange={event => setForm(current => ({ ...current, visible: event.target.checked }))} />
                    Visible on website
                  </label>
                  <label className="destination-checkbox">
                    <input type="checkbox" checked={form.featured_on_home} onChange={event => setForm(current => ({ ...current, featured_on_home: event.target.checked }))} />
                    Show in Our Grand Safaris
                  </label>
                </div>
                <div className="form-group">
                  <label htmlFor="destination-sort">Display order</label>
                  <input id="destination-sort" type="number" min="0" value={form.sort_order} onChange={event => setForm(current => ({ ...current, sort_order: event.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Destination photos</label>
                  <div className="safari-images-upload">
                    {imagePreviews.length > 0 && (
                      <div className="image-previews-grid">
                        {imagePreviews.map((preview, index) => (
                          <div key={`${preview.url}-${index}`} className="image-preview-item">
                            <img src={preview.url} alt={`${form.name || 'Destination'} photo ${index + 1}`} className="safari-image-preview" />
                            <button type="button" className="remove-image-btn" onClick={() => removeImage(index)} title="Remove photo">
                              <X size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="image-upload-area">
                      {uploading ? (
                        <div className="upload-loading"><div className="spinner" /><p>Processing photos...</p></div>
                      ) : (
                        <>
                          <MapPin size={36} color="var(--gray-dark)" />
                          <p>Click or drag to add destination photos</p>
                          <span>Use landscape photos (1200 × 600px recommended)</span>
                        </>
                      )}
                      <input type="file" accept="image/*" multiple onChange={handleImageUpload} className="file-input" disabled={uploading} />
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving || uploading}>{saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Destination'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
