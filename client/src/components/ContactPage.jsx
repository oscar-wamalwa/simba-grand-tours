import { useState } from 'react';
import { MapPin, Phone, Mail, Send, Check, X, MessageCircle, Clock } from 'lucide-react';
import api from '../api';

const contactBg = '/images/vicfalls.jpg';

function ContactPage({ settings = {} }) {
  const phone = String(settings.sitePhone || '+254 707 984 287');
  const email = String(settings.siteEmail || 'simbagrandtours@gmail.com');
  const address = String(settings.address || 'Platinumz Plaza, Tom Mboya Street, Nairobi CBD');
  const phoneHref = phone.replace(/[^\d+]/g, '');
  const whatsappNumber = String(settings.whatsapp || phone).replace(/\D/g, '');
  const [formData, setFormData] = useState({ fullName: '', email: '', phone: '', subject: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus(null);

    try {
      // Map camelCase to snake_case for API
      const data = {
        full_name: formData.fullName,
        email: formData.email,
        phone: formData.phone || '',
        subject: formData.subject || '',
        message: formData.message
      };

      await api.messages.create(data);
      
      setSubmitStatus({ type: 'success', message: 'Thank you for your message! We will get back to you soon.' });
      setFormData({ fullName: '', email: '', phone: '', subject: '', message: '' });
    } catch (error) {
      console.error('Error sending message:', error);
      setSubmitStatus({ type: 'error', message: 'Failed to send message. Please try again or contact us directly.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="contact-page fade-in">
      <header className="hero hero-contact" style={{ backgroundImage: `url(${contactBg})` }}>
        <div className="hero-overlay"></div>
        <div className="hero-content">
          <h1>Contact Simba Grand Tours</h1>
          <p>Have questions or ready to book your next adventure?</p>
        </div>
      </header>

      <div className="container section-padding">
        <div className="contact-layout">
          <aside className="contact-sidebar">
            <h2>Our Contact Details</h2>
            <div className="contact-info-card">
              <h3>Headquarters</h3>
              <div className="contact-item">
                <MapPin size={20} />
                <span>{address}</span>
              </div>
            </div>
            <div className="contact-info-card">
              <h3>Email Us</h3>
              <a className="contact-item contact-action" href={`mailto:${email}`}>
                <Mail size={20} />
                <span>{email}</span>
              </a>
            </div>
            <div className="contact-info-card">
              <h3>Working Hours</h3>
              <div className="contact-item">
                <Clock size={20} aria-hidden="true" />
                <span>Monday to Friday: 8:00 am to 6:00 pm<br />Saturday: 9:00 am to 3:00 pm</span>
              </div>
            </div>
          </aside>

          <main className="contact-main">
            <div className="contact-form-container">
              <h2>Contact Us</h2>
              <p className="contact-subintro">Choose a direct contact option, or send us a message using the form.</p>
              <div className="contact-direct-options" aria-label="Direct contact options">
                <a className="contact-channel" href={`tel:${phoneHref}`}>
                  <Phone size={22} aria-hidden="true" />
                  <span>
                    <strong>Phone call</strong>
                    <small>{phone}</small>
                  </span>
                </a>
                <a
                  className="contact-channel"
                  href={`https://wa.me/${whatsappNumber}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle size={22} aria-hidden="true" />
                  <span>
                    <strong>WhatsApp</strong>
                    <small>Message us on WhatsApp</small>
                  </span>
                </a>
              </div>
              <p className="contact-intro">Or send us a message</p>
              <form onSubmit={handleSubmit} className="contact-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>Full Name *</label>
                    <input 
                      type="text" 
                      name="fullName" 
                      value={formData.fullName} 
                      onChange={handleChange} 
                      required 
                      placeholder="Enter your full name" 
                    />
                  </div>
                </div>
                <div className="form-row two-col">
                  <div className="form-group">
                    <label>Email *</label>
                    <input 
                      type="email" 
                      name="email" 
                      value={formData.email} 
                      onChange={handleChange} 
                      required 
                      placeholder="your@email.com" 
                    />
                  </div>
                  <div className="form-group">
                    <label>Phone</label>
                    <input 
                      type="tel" 
                      name="phone" 
                      value={formData.phone} 
                      onChange={handleChange} 
                      placeholder="+254 700 000 000" 
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Subject</label>
                    <input 
                      type="text" 
                      name="subject" 
                      value={formData.subject} 
                      onChange={handleChange} 
                      placeholder="What is this regarding?" 
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Message *</label>
                    <textarea 
                      name="message" 
                      value={formData.message} 
                      onChange={handleChange} 
                      required 
                      rows="5" 
                      placeholder="Tell us about your dream safari..."
                    ></textarea>
                  </div>
                </div>
                
                {/* Status Message */}
                {submitStatus && (
                  <div className={`form-status ${submitStatus.type}`}>
                    {submitStatus.type === 'success' ? (
                      <span style={{ color: 'var(--success)' }}><Check size={16} aria-hidden="true" /> {submitStatus.message}</span>
                    ) : (
                      <span style={{ color: 'var(--error)' }}><X size={16} aria-hidden="true" /> {submitStatus.message}</span>
                    )}
                  </div>
                )}
                
                <button type="submit" className="btn-gold btn-large" disabled={isSubmitting}>
                  <Send size={18} style={{ marginRight: '8px' }} />
                  {isSubmitting ? 'Sending...' : 'Send Message'}
                </button>
              </form>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

export default ContactPage;
