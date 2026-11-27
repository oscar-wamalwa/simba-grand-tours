import React, { useState, useEffect } from 'react';
import api from '../api';
import { Mail, Phone, MapPin, Globe, Instagram, Facebook, Music2 } from 'lucide-react';

// WhatsApp icon component
const WhatsAppIcon = ({ size = 18, style = {} }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={style}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

export default function SettingsView() {
  const [settings, setSettings] = useState({
    siteName: 'Simba Grand Tours',
    siteEmail: 'simbagrandtours@gmail.com',
    sitePhone: '+254 707 984 287',
    address: 'Platinumz Plaza, Tom Mboya Street, Nairobi CBD',
    website: 'https://www.simbagrandtours.com',
    instagram: 'https://instagram.com/simba.grand.tours',
    facebook: 'https://web.facebook.com/simbagrandtours',
    tiktok: 'https://www.tiktok.com/@simba.grand.tours',
    whatsapp: '+254707984287'
  });
  const [saving, setSaving] = useState(false);
  const [savingLegal, setSavingLegal] = useState(false);
  const [legalSettings, setLegalSettings] = useState({
    privacyPolicy: '',
    termsConditions: ''
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const data = await api.settings.get();
      if (data) {
        setSettings(prev => ({
          ...prev,
          siteName: data.site_name || prev.siteName,
          siteEmail: data.site_email || prev.siteEmail,
          sitePhone: data.site_phone || prev.sitePhone,
          address: data.address || prev.address,
          website: data.website || prev.website,
          instagram: data.instagram || prev.instagram,
          facebook: data.facebook || prev.facebook,
          tiktok: data.tiktok || prev.tiktok,
          whatsapp: data.whatsapp || prev.whatsapp
        }));
        setLegalSettings({
          privacyPolicy: data.privacy_policy || '',
          termsConditions: data.terms_conditions || ''
        });
      }
    } catch (e) {
      console.error('Error fetching settings:', e);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const settingsData = {
        site_name: settings.siteName,
        site_email: settings.siteEmail,
        site_phone: settings.sitePhone,
        address: settings.address,
        website: settings.website,
        instagram: settings.instagram,
        facebook: settings.facebook,
        tiktok: settings.tiktok,
        whatsapp: settings.whatsapp
      };
      
      await api.settings.update(settingsData);
      alert('Settings saved successfully!');
    } catch (e) {
      console.error('Error saving settings:', e);
      alert(e.message || 'Error saving settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveLegal = async () => {
    setSavingLegal(true);
    try {
      await api.settings.update({
        privacy_policy: legalSettings.privacyPolicy,
        terms_conditions: legalSettings.termsConditions
      });
      alert('Legal pages saved successfully!');
    } catch (e) {
      console.error('Error saving legal pages:', e);
      alert(e.message || 'Error saving legal pages. Please try again.');
    } finally {
      setSavingLegal(false);
    }
  };

  const handleChange = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleLegalChange = (field, value) => {
    setLegalSettings(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="settings-view fade-in">
      {/* General Settings */}
      <div className="settings-section">
        <div className="settings-header">
          <h3>General Settings</h3>
          <p>Manage your website's basic information</p>
        </div>
        <div className="settings-form">
          <div className="form-group">
            <label>Website Name</label>
            <input 
              type="text" 
              value={settings.siteName} 
              onChange={e => handleChange('siteName', e.target.value)} 
              placeholder="Your company name"
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label><Mail size={16} style={{ marginRight: '8px' }} />Contact Email</label>
              <input 
                type="email" 
                value={settings.siteEmail} 
                onChange={e => handleChange('siteEmail', e.target.value)} 
                placeholder="contact@yourcompany.com"
              />
            </div>
            <div className="form-group">
              <label><Phone size={16} style={{ marginRight: '8px' }} />Phone Number</label>
              <input 
                type="tel" 
                value={settings.sitePhone} 
                onChange={e => handleChange('sitePhone', e.target.value)} 
                placeholder="+254 700 000 000"
              />
            </div>
          </div>
          <div className="form-group">
            <label><MapPin size={16} style={{ marginRight: '8px' }} />Physical Address</label>
            <input 
              type="text" 
              value={settings.address} 
              onChange={e => handleChange('address', e.target.value)} 
              placeholder="Your office address"
            />
          </div>
          <div className="form-group">
            <label><Globe size={16} style={{ marginRight: '8px' }} />Website URL</label>
            <input 
              type="text" 
              value={settings.website} 
              onChange={e => handleChange('website', e.target.value)} 
              placeholder="www.yourwebsite.com"
            />
          </div>
        </div>
      </div>

      {/* Social Media Settings */}
      <div className="settings-section">
        <div className="settings-header">
          <h3>Social Media Links</h3>
          <p>Manage your social media profile URLs</p>
        </div>
        <div className="settings-form">
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Instagram size={18} style={{ color: '#E1306C' }} /> Instagram
            </label>
            <input 
              type="text" 
              value={settings.instagram} 
              onChange={e => handleChange('instagram', e.target.value)} 
              placeholder="https://instagram.com/yourprofile"
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Facebook size={18} style={{ color: '#1877F2' }} /> Facebook
              </label>
              <input 
                type="text" 
                value={settings.facebook} 
                onChange={e => handleChange('facebook', e.target.value)} 
                placeholder="https://facebook.com/yourprofile"
              />
            </div>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Music2 size={18} style={{ color: '#000000' }} /> TikTok
              </label>
              <input 
                type="text" 
                value={settings.tiktok}
                onChange={e => handleChange('tiktok', e.target.value)}
                placeholder="https://www.tiktok.com/@yourprofile"
              />
            </div>
          </div>
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <WhatsAppIcon size={18} style={{ color: '#25D366' }} /> WhatsApp Number
            </label>
            <input 
              type="text" 
              value={settings.whatsapp} 
              onChange={e => handleChange('whatsapp', e.target.value)} 
              placeholder="+254700000000"
            />
            <p style={{ fontSize: '0.8rem', color: 'var(--gray-dark)', marginTop: '5px' }}>
              Include country code without the + symbol (e.g., 254707984287)
            </p>
          </div>
        </div>
        <div className="settings-actions">
          <button 
            className="btn-primary" 
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
      <div className="settings-section">
        <div className="settings-header">
          <h3>Privacy Policy and Terms and Conditions</h3>
          <p>Update the legal pages shown to visitors. Use ## before section headings and leave a blank line between paragraphs.</p>
        </div>
        <div className="settings-form">
          <div className="form-group">
            <label htmlFor="privacy-policy">Privacy Policy</label>
            <textarea
              id="privacy-policy"
              rows={16}
              value={legalSettings.privacyPolicy}
              onChange={e => handleLegalChange('privacyPolicy', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="terms-conditions">Terms and Conditions</label>
            <textarea
              id="terms-conditions"
              rows={16}
              value={legalSettings.termsConditions}
              onChange={e => handleLegalChange('termsConditions', e.target.value)}
            />
          </div>
        </div>
        <div className="settings-actions">
          <button
            className="btn-primary"
            onClick={handleSaveLegal}
            disabled={savingLegal}
          >
            {savingLegal ? 'Saving...' : 'Save Legal Pages'}
          </button>
        </div>
      </div>
    </div>
  );
}

