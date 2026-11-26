import { useState } from 'react';
import { Star, Send, CheckCircle, X } from 'lucide-react';
import api from '../api';

function ReviewModal({ onClose }) {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    bookingReference: '',
    location: '',
    safari: '',
    rating: 5,
    message: ''
  });
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const ratingLabels = {
    1: 'Poor',
    2: 'Fair',
    3: 'Good',
    4: 'Very Good',
    5: 'Excellent'
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const data = {
        full_name: formData.fullName,
        email: formData.email,
        booking_reference: formData.bookingReference,
        location: formData.location,
        safari: formData.safari || '',
        rating: formData.rating,
        message: formData.message
      };

      await api.testimonials.create(data);

      setSubmitted(true);
      setTimeout(() => {
        onClose();
        setSubmitted(false);
        setFormData({ fullName: '', email: '', bookingReference: '', location: '', safari: '', rating: 5, message: '' });
      }, 2000);
    } catch (err) {
      console.error('Error submitting review:', err);
      // Provide more specific error messages
      if (err.message && err.message.includes('Failed to fetch')) {
        setError('Cannot connect to server. Please check your internet connection or try again later.');
      } else if (err.message) {
        setError(`Failed to submit review: ${err.message}`);
      } else {
        setError('Failed to submit review. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close review form"><X size={20} /></button>
        {submitted ? (
          <div className="modal-success">
            <CheckCircle size={64} color="#c49a6c" />
            <h2>Thank You!</h2>
            <p>Your verified review has been submitted successfully.</p>
          </div>
        ) : (
          <>
            <h2>Share Your Experience</h2>
            <p className="modal-subtitle">Reviews are available to travelers with a confirmed booking.</p>
            <form onSubmit={handleSubmit} className="review-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Full Name *</label>
                  <input
                    type="text"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleChange}
                    required
                    placeholder="Enter your name"
                  />
                </div>
              </div>
              <div className="form-row two-col">
                <div className="form-group">
                  <label>Booking email *</label>
                  <input type="email" name="email" value={formData.email} onChange={handleChange} required />
                </div>
                <div className="form-group">
                  <label>Booking reference *</label>
                  <input name="bookingReference" value={formData.bookingReference} onChange={handleChange} required placeholder="SGT-..." />
                </div>
              </div>
              <div className="form-row two-col">
                <div className="form-group">
                  <label>Location *</label>
                  <input
                    type="text"
                    name="location"
                    value={formData.location}
                    onChange={handleChange}
                    required
                    placeholder="Country/City"
                  />
                </div>
                <div className="form-group">
                  <label>Safari Experience</label>
                  <input
                    type="text"
                    name="safari"
                    value={formData.safari}
                    onChange={handleChange}
                    placeholder="e.g., Great Migration Safari"
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Rating</label>
                  <div className="rating-stars">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        size={28}
                        fill={star <= formData.rating ? "#c49a6c" : "none"}
                        stroke={star <= formData.rating ? "#c49a6c" : "#ccc"}
                        style={{ cursor: 'pointer' }}
                        onClick={() => setFormData(prev => ({ ...prev, rating: star }))}
                      />
                    ))}
                    <span className="rating-label">{ratingLabels[formData.rating]}</span>
                  </div>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Your Review *</label>
                  <textarea
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    required
                    rows="4"
                    placeholder="Share your experience with us..."
                  ></textarea>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div style={{ color: 'var(--error)', marginBottom: '15px', textAlign: 'center' }}>
                  {error}
                </div>
              )}

              <div className="form-row" style={{ marginTop: '20px' }}>
                <button type="submit" className="btn-gold btn-large" style={{ width: '100%' }} disabled={isSubmitting}>
                  <Send size={18} style={{ marginRight: '8px' }} />
                  {isSubmitting ? 'Submitting...' : 'Submit Review'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default ReviewModal;
