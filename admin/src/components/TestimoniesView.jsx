import React, { useState, useEffect } from 'react';
import api from '../api';
import { MessageCircle, Star, Download, Trash2, X, MapPin, CheckCircle, Edit2 } from 'lucide-react';

const MAX_FEATURED_TESTIMONIALS = 6;

export default function TestimoniesView() {
  const [testimonials, setTestimonials] = useState([]);
  const [featuredTestimonials, setFeaturedTestimonials] = useState([]);
  const [selectedTestimonial, setSelectedTestimonial] = useState(null);
  const [deleteModal, setDeleteModal] = useState(null); // Stores testimonial to delete
  const [editForm, setEditForm] = useState(null);
  const [editError, setEditError] = useState('');
  const [saving, setSaving] = useState(false);

  const startEdit = (testimonial) => {
    setEditError('');
    setEditForm({
      id: testimonial.id,
      full_name: testimonial.full_name || testimonial.fullName || '',
      location: testimonial.location || '',
      safari: testimonial.safari || '',
      rating: testimonial.rating || 5,
      message: testimonial.message || '',
    });
  };

  const saveEdit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setEditError('');
    try {
      const { id, ...fields } = editForm;
      const updated = await api.testimonials.partialUpdate(id, { ...fields, rating: Number(fields.rating) });
      setTestimonials(current => current.map(item => item.id === id ? { ...item, ...updated } : item));
      setSelectedTestimonial(current => current && current.id === id ? { ...current, ...updated } : current);
      setEditForm(null);
    } catch (error) {
      setEditError(error.message || 'Could not save the testimonial. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => { fetchTestimonials(); }, []);

  const fetchTestimonials = async () => {
    try {
      const data = await api.testimonials.getAll();
      setTestimonials(data.map(d => ({ id: d.id, ...d })));

      // Fetch featured testimonials
      try {
        const featuredData = await api.testimonials.getFeatured();
        setFeaturedTestimonials(featuredData.map(t => t.id));
      } catch (e) {
        console.log('Could not fetch featured testimonials');
      }
    } catch (error) {
      console.error('Error fetching testimonials:', error);
    }
  };

  const toggleFeatured = async (testimonialId) => {
    const isFeatured = featuredTestimonials.includes(testimonialId);
    let newFeatured;

    if (isFeatured) {
      newFeatured = featuredTestimonials.filter(id => id !== testimonialId);
    } else {
      if (featuredTestimonials.length >= MAX_FEATURED_TESTIMONIALS) {
        alert(`You can only feature up to ${MAX_FEATURED_TESTIMONIALS} testimonials. Please unselect one first.`);
        return;
      }
      newFeatured = [...featuredTestimonials, testimonialId];
    }

    try {
      await api.testimonials.partialUpdate(testimonialId, { is_featured: !isFeatured });
      setFeaturedTestimonials(newFeatured);
      // Refetch testimonials to ensure UI is in sync with server
      await fetchTestimonials();
    } catch (e) {
      console.error('Error updating featured testimonial:', e);
      alert(e.message || 'Could not update featured testimonial. Please try again.');
    }
  };

  const toggleVerification = async (testimonial) => {
    const verified = Boolean(testimonial.is_verified);
    try {
      await api.testimonials.partialUpdate(testimonial.id, { is_verified: !verified });
      await fetchTestimonials();
    } catch (error) {
      console.error('Error updating traveller verification:', error);
      alert(error.message || 'Could not update traveller verification. Please try again.');
    }
  };

  const downloadCSV = () => {
    const headers = ['Name', 'Email', 'Location', 'Safari', 'Rating', 'Message', 'Submitted At', 'Verified', 'Featured'];
    const rows = testimonials.map(t => [
      t.full_name || t.fullName || 'Anonymous',
      t.email || '',
      t.location || '',
      t.safari || '',
      t.rating || 5,
      t.message || '',
      t.created_at ? new Date(t.created_at).toLocaleString() : t.createdAt ? new Date(t.createdAt).toLocaleString() : 'N/A',
      t.is_verified ? 'Yes' : 'No',
      featuredTestimonials.includes(t.id) ? 'Yes' : 'No'
    ]);

    const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `testimonials_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const handleDeleteClick = (t) => {
    setDeleteModal(t);
  };

  const confirmDelete = async () => {
    if (!deleteModal) return;

    try {
      await api.testimonials.delete(deleteModal.id);
      // Remove from testimonials list
      setTestimonials(testimonials.filter(t => t.id !== deleteModal.id));
      // Remove from featured if present
      if (featuredTestimonials.includes(deleteModal.id)) {
        const newFeatured = featuredTestimonials.filter(id => id !== deleteModal.id);
        setFeaturedTestimonials(newFeatured);
      }
      setDeleteModal(null);
    } catch (error) {
      console.error('Error deleting testimonial:', error);
      alert('Failed to delete testimonial. Please try again.');
    }
  };

  return (
    <div className="data-card fade-in">
      <div className="data-card-header">
        <h3>
          Testimonials Management{' '}
          <span style={{ background: featuredTestimonials.length >= MAX_FEATURED_TESTIMONIALS ? 'var(--gold-majesty)' : 'var(--gray-light)', padding: '4px 12px', borderRadius: '20px', fontSize: '0.85rem', marginLeft: '10px' }}>
            {featuredTestimonials.length}/{MAX_FEATURED_TESTIMONIALS} Selected
          </span>
        </h3>
        <div className="data-actions">
          <button className="btn-secondary" onClick={downloadCSV} style={{ padding: '10px 16px' }}>
            <Download size={18} /> Download CSV
          </button>
        </div>
      </div>

      <p style={{ color: 'var(--text-light)', fontSize: '0.9rem', marginBottom: '20px', padding: '0 20px' }}>
        Select up to 6 testimonials to display on the homepage. New reviews stay hidden until you feature them, and you can edit the wording (typos, name, rating) before publishing. Verification is optional and can be changed independently.
      </p>

      {testimonials.length === 0 ? (
        <div className="empty-state" style={{ padding: '60px 20px', textAlign: 'center' }}>
          <MessageCircle size={60} />
          <h3>No Testimonials</h3>
        </div>
      ) : (
        <div className="message-list">
          {testimonials.map(t => (
            <div
              key={t.id}
              className={`message-item ${featuredTestimonials.includes(t.id) ? 'featured' : ''}`}
              onClick={() => setSelectedTestimonial(t)}
              style={{ cursor: 'pointer' }}
            >
              <div className="message-avatar">{t.fullName ? t.fullName.charAt(0).toUpperCase() : '?'}</div>
              <div className="message-content">
                <div className="message-header">
                  <span className="message-name">{t.fullName || t.full_name || 'Anonymous'}</span>
                  <span className="message-time">{t.created_at ? new Date(t.created_at).toLocaleDateString() : t.createdAt ? new Date(t.createdAt).toLocaleDateString() : 'N/A'}</span>
                  {featuredTestimonials.includes(t.id) && (
                    <span className="signature-badge" style={{ marginLeft: '10px' }}>
                      <Star size={12} /> Featured
                    </span>
                  )}
                  {t.is_verified && (
                    <span className="status-badge active" style={{ marginLeft: '8px' }}>Verified</span>
                  )}
                </div>
                <p className="message-preview" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                  {t.message || 'No message provided.'}
                </p>
                <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <Star
                      key={star}
                      size={12}
                      fill={star <= (t.rating || 5) ? "#c49a6c" : "none"}
                      stroke={star <= (t.rating || 5) ? "#c49a6c" : "#ccc"}
                    />
                  ))}
                  {t.location && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: 'var(--gray-dark)', marginLeft: '8px' }}><MapPin size={14} aria-hidden="true" /> {t.location}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="action-btn"
                  onClick={(e) => { e.stopPropagation(); setSelectedTestimonial(t); startEdit(t); }}
                  title="Edit testimonial"
                  aria-label={`Edit testimonial by ${t.fullName || t.full_name || 'Anonymous'}`}
                >
                  <Edit2 size={16} />
                </button>
                <button
                  className="action-btn"
                  onClick={(e) => { e.stopPropagation(); toggleVerification(t); }}
                  title={t.is_verified ? 'Mark traveller as unverified' : 'Verify traveller'}
                  aria-label={`${t.is_verified ? 'Unverify' : 'Verify'} traveller ${t.fullName || t.full_name || 'Anonymous'}`}
                  style={{ color: t.is_verified ? 'var(--success)' : 'var(--gray-dark)' }}
                >
                  <CheckCircle size={16} />
                </button>
                <button
                  className="action-btn"
                  onClick={(e) => { e.stopPropagation(); toggleFeatured(t.id); }}
                  style={{ color: featuredTestimonials.includes(t.id) ? 'var(--gold-majesty)' : 'var(--gray-dark)' }}
                  title={featuredTestimonials.includes(t.id) ? 'Remove from featured' : 'Mark as featured'}
                  aria-label={`${featuredTestimonials.includes(t.id) ? 'Remove from featured' : 'Feature'} testimonial by ${t.fullName || t.full_name || 'Anonymous'}`}
                >
                  <Star size={16} fill={featuredTestimonials.includes(t.id) ? 'currentColor' : 'none'} />
                </button>
                <button
                  className="action-btn"
                  onClick={(e) => { e.stopPropagation(); handleDeleteClick(t); }}
                  style={{ color: 'var(--danger)' }}
                  title="Delete testimonial"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedTestimonial && (
        <div className="modal-overlay show" onClick={() => { setSelectedTestimonial(null); setEditForm(null); }}>
          <div className="modal" onClick={event => event.stopPropagation()}>
            <div className="modal-header">
              <h3>Testimonial Details</h3>
              <button className="modal-close" onClick={() => { setSelectedTestimonial(null); setEditForm(null); }} aria-label="Close testimonial details">
                <X size={20} />
              </button>
            </div>
            {editForm ? (
              <form className="modal-body" onSubmit={saveEdit}>
                <div className="form-group"><label>Name<input value={editForm.full_name} onChange={e => setEditForm({ ...editForm, full_name: e.target.value })} /></label></div>
                <div className="form-group"><label>Location<input value={editForm.location} onChange={e => setEditForm({ ...editForm, location: e.target.value })} /></label></div>
                <div className="form-group"><label>Safari<input value={editForm.safari} onChange={e => setEditForm({ ...editForm, safari: e.target.value })} /></label></div>
                <div className="form-group">
                  <label>Rating
                    <select value={editForm.rating} onChange={e => setEditForm({ ...editForm, rating: e.target.value })}>
                      {[5, 4, 3, 2, 1].map(value => <option key={value} value={value}>{value} / 5</option>)}
                    </select>
                  </label>
                </div>
                <div className="form-group"><label>Review text<textarea rows="6" value={editForm.message} onChange={e => setEditForm({ ...editForm, message: e.target.value })} /></label></div>
                {editError && <p className="form-status error" role="alert">{editError}</p>}
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn-secondary" onClick={() => setEditForm(null)} disabled={saving}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</button>
                </div>
              </form>
            ) : (
            <div className="modal-body">
              <button type="button" className="btn-secondary" onClick={() => startEdit(selectedTestimonial)} style={{ float: 'right' }}><Edit2 size={14} /> Edit</button>
              <h4>{selectedTestimonial.fullName || selectedTestimonial.full_name || 'Anonymous'}</h4>
              <p>
                Submitted {selectedTestimonial.created_at ? new Date(selectedTestimonial.created_at).toLocaleString() : 'date unavailable'}
                {' | '}
                {selectedTestimonial.is_verified ? 'Verified' : 'Unverified'}
              </p>
              {selectedTestimonial.email && <p>Email: {selectedTestimonial.email}</p>}
              {selectedTestimonial.location && <p>Location: {selectedTestimonial.location}</p>}
              {selectedTestimonial.safari && <p>Safari: {selectedTestimonial.safari}</p>}
              <p>Rating: {selectedTestimonial.rating || 5}/5</p>
              <div className="testimonial-detail-message">
                {selectedTestimonial.message || 'No message provided.'}
              </div>
            </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="modal-content" style={{ background: 'white', padding: '24px', borderRadius: '8px', maxWidth: '400px', width: '90%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Trash2 size={20} style={{ color: 'var(--danger)' }} />
                Delete Testimonial
              </h3>
              <button onClick={() => setDeleteModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <p style={{ marginBottom: '24px', color: 'var(--text-light)' }}>
              Are you sure you want to delete this testimonial from <strong>{deleteModal.fullName || deleteModal.full_name}</strong>? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDeleteModal(null)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="btn-danger"
                style={{ background: 'var(--danger)', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer' }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

