import React, { useState, useEffect } from 'react';
import api from '../api';
import { MessageCircle, Star, Download, Trash2, X, MapPin, CheckCircle } from 'lucide-react';

export default function TestimoniesView() {
  const [testimonials, setTestimonials] = useState([]);
  const [featuredTestimonials, setFeaturedTestimonials] = useState([]);
  const [deleteModal, setDeleteModal] = useState(null); // Stores testimonial to delete

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
      if (featuredTestimonials.length >= 3) {
        alert('You can only feature up to 3 testimonials. Please unselect one first.');
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
    }
  };

  const verifyTestimonial = async (testimonialId) => {
    try {
      await api.testimonials.partialUpdate(testimonialId, { is_verified: true });
      await fetchTestimonials();
    } catch (error) {
      console.error('Error verifying testimonial:', error);
      alert(error.message || 'Could not verify testimonial. Please try again.');
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
          <span style={{ background: featuredTestimonials.length >= 3 ? 'var(--gold-majesty)' : 'var(--gray-light)', padding: '4px 12px', borderRadius: '20px', fontSize: '0.85rem', marginLeft: '10px' }}>
            {featuredTestimonials.length}/3 Selected
          </span>
        </h3>
        <div className="data-actions">
          <button className="btn-secondary" onClick={downloadCSV} style={{ padding: '10px 16px' }}>
            <Download size={18} /> Download CSV
          </button>
        </div>
      </div>

      <p style={{ color: 'var(--text-light)', fontSize: '0.9rem', marginBottom: '20px', padding: '0 20px' }}>
        Verify submissions before featuring them. Select up to 3 verified testimonials to display on the homepage.
      </p>

      {testimonials.length === 0 ? (
        <div className="empty-state" style={{ padding: '60px 20px', textAlign: 'center' }}>
          <MessageCircle size={60} />
          <h3>No Testimonials</h3>
        </div>
      ) : (
        <div className="message-list">
          {testimonials.map(t => (
            <div key={t.id} className={`message-item ${featuredTestimonials.includes(t.id) ? 'featured' : ''}`} style={{ cursor: 'pointer' }}>
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
                  {t.is_verified ? (
                    <span className="status-badge active" style={{ marginLeft: '8px' }}>Verified</span>
                  ) : (
                    <span className="status-badge archived" style={{ marginLeft: '8px' }}>Unverified</span>
                  )}
                </div>
                <p className="message-preview">{t.message?.substring(0, 80)}...</p>
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
                {!t.is_verified && (
                  <button
                    className="action-btn"
                    onClick={(e) => { e.stopPropagation(); verifyTestimonial(t.id); }}
                    title="Mark testimonial as verified"
                    aria-label={`Verify testimonial from ${t.fullName || t.full_name || 'Anonymous'}`}
                  >
                    <CheckCircle size={16} />
                  </button>
                )}
                <button
                  className="action-btn"
                  onClick={(e) => { e.stopPropagation(); toggleFeatured(t.id); }}
                  disabled={!t.is_verified}
                  style={{ color: featuredTestimonials.includes(t.id) ? 'var(--gold-majesty)' : 'var(--gray-dark)' }}
                  title={!t.is_verified ? 'Verify before featuring' : featuredTestimonials.includes(t.id) ? 'Remove from featured' : 'Mark as featured'}
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

