import { useState } from 'react';
import { Instagram, Facebook, MessageCircle, Music2 } from 'lucide-react';
import api from '../api';

function FooterSection({ onNavigate, settings = {} }) {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [smsOptIn, setSmsOptIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const formatPhone = (phone) => {
    const digits = (phone || '').replace(/\D/g, '');
    return digits;
  };
  
  const whatsappNumber = formatPhone((settings?.whatsapp) || '+254707984287');
  const displayPhone = settings.sitePhone || '+254 707 984 287';
  const displayEmail = settings.siteEmail || 'simbagrandtours@gmail.com';
  const displayAddress = settings.address || 'Platinumz Plaza, Tom Mboya Street, Nairobi CBD';
  const phoneLink = displayPhone.replace(/[^\d+]/g, '');
  const addressLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(displayAddress)}`;

  const handleSubscribe = async (e) => {
    e.preventDefault();
    
    if (!email.trim()) {
      setMessage({ type: 'error', text: 'Please enter your email address' });
      return;
    }
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setMessage({ type: 'error', text: 'Please enter a valid email address' });
      return;
    }
    if (smsOptIn && !phone.trim()) {
      setMessage({ type: 'error', text: 'Enter a phone number to opt in to SMS updates.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      await api.subscribers.create({
        email,
        phone: phone.trim(),
        sms_opt_in: smsOptIn,
      });
      setMessage({
        type: 'success',
        text: smsOptIn
          ? 'Thank you for subscribing to email and SMS updates.'
          : 'Thank you for subscribing! You will receive email updates.',
      });
      setEmail('');
      setPhone('');
      setSmsOptIn(false);
    } catch (error) {
      console.error('Subscription error:', error);
      setMessage({
        type: 'error',
        text: error.message?.toLowerCase().includes('already subscribed')
          ? 'This email is already subscribed.'
          : error.message || 'Connection error. Please check your internet and try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-cta">
          <h2>Ready for Your African Adventure?</h2>
          <p>Subscribe to our newsletter for exclusive offers and safari tips</p>
          <div className="newsletter-box">
            <form onSubmit={handleSubscribe} className="newsletter-subscribe-form">
              <input 
                type="email" 
                required
                placeholder="Your email address" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
              <input
                type="tel"
                placeholder="Phone number (optional, e.g. 0712 345 678)"
                value={phone}
                onChange={event => setPhone(event.target.value)}
                disabled={loading}
                aria-label="Phone number for optional SMS updates"
              />
              <label className="newsletter-sms-consent">
                <input
                  type="checkbox"
                  checked={smsOptIn}
                  onChange={event => setSmsOptIn(event.target.checked)}
                  disabled={loading}
                />
                <span>I agree to receive occasional SMS updates. SMS charges may apply. I can opt out by contacting Simba Grand Tours.</span>
              </label>
              <button 
                type="submit" 
                className="btn-gold"
                disabled={loading}
              >
                {loading ? 'Subscribing...' : 'Subscribe'}
              </button>
            </form>
          </div>
          {message && (
            <p style={{ 
              marginTop: '10px', 
              color: message.type === 'error' ? '#e74c3c' : '#27ae60',
              fontSize: '14px'
            }}>
              {message.text}
            </p>
          )}
        </div>
        
        <div className="footer-links">
          <div className="footer-column">
            <h4>{settings.siteName || 'Simba Grand Tours'}</h4>
            <p>Your premier gateway to the African continent since 2026.</p>
            <div className="social-icons">
              <a href={settings.instagram || 'https://instagram.com/simba.grand.tours'} target="_blank" rel="noopener noreferrer" className="social-icon">
                <Instagram size={20} />
              </a>
              <a href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noopener noreferrer" className="social-icon">
                <MessageCircle size={20} />
              </a>
              <a href={settings.facebook || 'https://web.facebook.com/simbagrandtours'} target="_blank" rel="noopener noreferrer" className="social-icon">
                <Facebook size={20} />
              </a>
              <a href={settings.tiktok || 'https://www.tiktok.com/@simba.grand.tours'} target="_blank" rel="noopener noreferrer" className="social-icon" aria-label="TikTok">
                <Music2 size={20} />
              </a>
            </div>
          </div>
          <div className="footer-column">
            <h4>Quick Links</h4>
            <button className="footer-link" onClick={() => onNavigate('home')}>Home</button>
            <button className="footer-link" onClick={() => onNavigate('safaris')}>Safaris</button>
            <button className="footer-link" onClick={() => onNavigate('destinations')}>Destinations</button>
            <button className="footer-link" onClick={() => onNavigate('pulse')}>The Simba Pulse</button>
            <button className="footer-link" onClick={() => onNavigate('services')}>Services</button>
            <button className="footer-link" onClick={() => onNavigate('about')}>About Us</button>
            <button className="footer-link" onClick={() => onNavigate('contact')}>Contact</button>
          </div>
          <div className="footer-column">
            <h4>Contact</h4>
            <a className="footer-contact-link" href={`tel:${phoneLink}`}>{displayPhone}</a>
            <a className="footer-contact-link" href={`mailto:${displayEmail}`}>{displayEmail}</a>
            <a className="footer-contact-link" href={addressLink} target="_blank" rel="noopener noreferrer">{displayAddress}</a>
            <div className="footer-working-hours">
              <h4>Working Hours</h4>
              <p>Monday to Friday: 8:00 am to 6:00 pm<br />Saturday: 9:00 am to 3:00 pm</p>
            </div>
          </div>
        </div>
        
        <div className="footer-bottom">
          <p>© 2026 {settings.siteName || 'Simba Grand Tours'}. All rights reserved.</p>
          <div className="footer-legal-links">
            <button type="button" onClick={() => onNavigate('privacy')}>Privacy Policy</button>
            <button type="button" onClick={() => onNavigate('terms')}>Terms and Conditions</button>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default FooterSection;
