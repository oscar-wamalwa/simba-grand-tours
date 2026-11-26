import { Instagram, Facebook, MessageCircle } from 'lucide-react';
import api from '../api';

// X icon component since it's not in lucide-react
const XIcon = ({ size = 20, style = {} }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    style={style}
  >
    <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"/>
  </svg>
);

function FooterSection({ onNavigate, settings = {} }) {
  const [email, setEmail] = useState('');
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
    
    if (!email) {
      setMessage({ type: 'error', text: 'Please enter your email address' });
      return;
    }
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setMessage({ type: 'error', text: 'Please enter a valid email address' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      await api.subscribers.create({ email });
      setMessage({ type: 'success', text: 'Thank you for subscribing! Check your inbox for confirmation.' });
      setEmail('');
    } catch (error) {
      console.error('Subscription error:', error);
      setMessage({
        type: 'error',
        text: error.message?.toLowerCase().includes('email') ? 'This email is already subscribed.' : 'Connection error. Please check your internet and try again.'
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
            <form onSubmit={handleSubscribe} style={{ display: 'flex', gap: '10px', width: '100%', maxWidth: '400px' }}>
              <input 
                type="email" 
                placeholder="Your email address" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                style={{ flex: 1, padding: '12px 16px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
              <button 
                type="submit" 
                className="btn-gold"
                disabled={loading}
              >
                {loading ? '...' : 'Subscribe'}
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
            <p>Your premier gateway to the African continent since 2024.</p>
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
              <a href={settings.twitter || 'https://x.com/simba_tours'} target="_blank" rel="noopener noreferrer" className="social-icon">
                <XIcon size={20} />
              </a>
            </div>
          </div>
          <div className="footer-column">
            <h4>Quick Links</h4>
            <button className="footer-link" onClick={() => onNavigate('home')}>Home</button>
            <button className="footer-link" onClick={() => onNavigate('safaris')}>Safaris</button>
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
          </div>
        </div>
        
        <div className="footer-bottom">
          <p>© 2026 {settings.siteName || 'Simba Grand Tours'}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

export default FooterSection;
import { useState } from 'react';
