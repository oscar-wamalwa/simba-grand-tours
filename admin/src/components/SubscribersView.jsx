import React, { useState, useEffect } from 'react';
import api from '../api';
import { Search, Mail, Clock, Trash2, Download, Send, Smartphone, Edit2, X } from 'lucide-react';

export default function SubscribersView() {
  const [subscribers, setSubscribers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [channel, setChannel] = useState('email');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [campaignNotice, setCampaignNotice] = useState(null);
  const [editingSubscriber, setEditingSubscriber] = useState(null);
  const [phoneDraft, setPhoneDraft] = useState('');
  const [smsConsentDraft, setSmsConsentDraft] = useState(false);
  const [subscriberSaveError, setSubscriberSaveError] = useState('');

  useEffect(() => {
    fetchSubscribers();
  }, []);

  const fetchSubscribers = async () => {
    try {
      const data = await api.subscribers.getAll();
      setSubscribers(data.map(d => ({ id: d.id, ...d })));
    } catch (error) {
      console.error('Error fetching subscribers:', error);
    }
  };

  const handleDelete = async (id) => {
    if (confirm('Delete subscriber?')) {
      try {
        await api.subscribers.delete(id);
        fetchSubscribers();
      } catch (error) {
        console.error('Error deleting subscriber:', error);
        alert('Error deleting subscriber. Please try again.');
      }
    }
  };

  const filtered = subscribers.filter(s => 
    s.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.phone?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const optedInForSms = subscribers.filter(subscriber => subscriber.sms_opt_in && subscriber.phone);

  const editSubscriber = (subscriber) => {
    setEditingSubscriber(subscriber);
    setPhoneDraft(subscriber.phone || '');
    setSmsConsentDraft(Boolean(subscriber.sms_opt_in));
    setSubscriberSaveError('');
  };

  const saveSubscriberContact = async (event) => {
    event.preventDefault();
    setSubscriberSaveError('');
    try {
      await api.subscribers.partialUpdate(editingSubscriber.id, {
        phone: phoneDraft.trim(),
        sms_opt_in: smsConsentDraft,
      });
      setEditingSubscriber(null);
      await fetchSubscribers();
    } catch (error) {
      setSubscriberSaveError(error.message || 'Could not update subscriber contact preferences.');
    }
  };

  const sendUpdate = async (event) => {
    event.preventDefault();
    setCampaignNotice(null);
    const emailCount = subscribers.filter(subscriber => subscriber.email).length;
    const smsCount = optedInForSms.length;
    const channels = channel === 'both' ? 'email and SMS' : channel.toUpperCase();
    const recipientCount = channel === 'email' ? emailCount : channel === 'sms' ? smsCount : emailCount + smsCount;
    if (!recipientCount || ((channel === 'email' || channel === 'both') && !emailCount)) {
      setCampaignNotice({ type: 'error', text: 'There are no eligible subscribers for the selected channel.' });
      return;
    }
    if ((channel === 'sms' || channel === 'both') && !smsCount) {
      setCampaignNotice({ type: 'error', text: 'No subscribers have opted in to SMS updates.' });
      return;
    }
    if (!window.confirm(`Send this ${channels} update to eligible subscribers? Email: ${emailCount}. SMS opted in: ${smsCount}.`)) return;

    setSending(true);
    try {
      const result = await api.subscribers.sendUpdate({ channel, subject, message });
      const channelSummary = Object.entries(result.results || {})
        .map(([name, counts]) => {
          const errors = counts.errors?.length ? ` (${counts.errors.join(' ')})` : '';
          return `${name.toUpperCase()}: ${counts.sent} sent, ${counts.failed} failed${errors}`;
        })
        .join(' · ');
      const hasFailures = Object.values(result.results || {}).some(counts => counts.failed > 0);
      setCampaignNotice({
        type: hasFailures ? 'error' : 'success',
        text: channelSummary || result.detail || 'Update dispatch completed.',
      });
      if (!hasFailures) {
        setSubject('');
        setMessage('');
      }
    } catch (error) {
      setCampaignNotice({ type: 'error', text: error.message || 'Could not send subscriber update.' });
    } finally {
      setSending(false);
    }
  };

  const downloadCSV = () => {
    const headers = ['Name', 'Email', 'Phone', 'SMS Opt-in', 'SMS Opt-in Date', 'Subscribed At'];
    const rows = filtered.map(sub => [
      sub.name || 'Anonymous',
      sub.email || '',
      sub.phone || '',
      sub.sms_opt_in ? 'Yes' : 'No',
      sub.sms_opt_in_at ? new Date(sub.sms_opt_in_at).toLocaleDateString() : '',
      sub.subscribed_at ? new Date(sub.subscribed_at).toLocaleDateString() : sub.subscribedAt ? new Date(sub.subscribedAt).toLocaleDateString() : 'N/A'
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `subscribers_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="data-card fade-in">
      <div className="data-card-header">
        <h3>Newsletter Subscribers</h3>
        <div className="data-actions">
          <div className="search-box"><Search size={18} /><input type="text" placeholder="Search subscribers..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
          <button className="btn-secondary" onClick={downloadCSV} style={{ padding: '10px 16px' }}>
            <Download size={18} /> Download CSV
          </button>
        </div>
      </div>
      <form className="subscriber-campaign-form" onSubmit={sendUpdate}>
        <h4><Send size={18} /> Share an update with subscribers</h4>
        <p>SMS is sent only to people who explicitly opted in. Longer SMS messages may cost more than one SMS per recipient.</p>
        <label>Send by
          <select value={channel} onChange={event => setChannel(event.target.value)} disabled={sending}>
            <option value="email">Email</option>
            <option value="sms">SMS</option>
            <option value="both">Email and SMS</option>
          </select>
        </label>
        {(channel === 'email' || channel === 'both') && (
          <label>Email subject
            <input maxLength="180" required value={subject} onChange={event => setSubject(event.target.value)} disabled={sending} />
          </label>
        )}
        <label>Message
          <textarea maxLength={channel === 'email' ? 5000 : 1600} rows="5" required value={message} onChange={event => setMessage(event.target.value)} disabled={sending} />
        </label>
        {(channel === 'sms' || channel === 'both') && (
          <span className="subscriber-sms-count"><Smartphone size={15} /> {optedInForSms.length} subscriber(s) opted in to SMS</span>
        )}
        {campaignNotice && <p className={`form-status ${campaignNotice.type}`} role={campaignNotice.type === 'error' ? 'alert' : 'status'}>{campaignNotice.text}</p>}
        <button type="submit" className="btn-primary" disabled={sending}>
          <Send size={17} /> {sending ? 'Sending update...' : 'Send update'}
        </button>
      </form>
      {filtered.length === 0 ? (
        <div className="empty-state" style={{ padding: '60px 20px', textAlign: 'center' }}><Mail size={60} /><h3>No Subscribers</h3></div>
      ) : (
        <div className="subscribers-list">
          {filtered.map(sub => (
            <div key={sub.id} className="subscriber-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 30px', borderBottom: '1px solid var(--gray-light)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <div style={{ width: '40px', height: '40px', background: 'var(--sky-sand)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '600', color: 'var(--deep-bronze)' }}>{sub.name ? sub.name.charAt(0).toUpperCase() : <Mail size={20} />}</div>
                <div>
                  <h4 style={{ fontSize: '0.95rem', marginBottom: '2px' }}>{sub.name || 'Anonymous'}</h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--gray-dark)' }}>{sub.email}</p>
                  {sub.phone && <p style={{ fontSize: '0.85rem', color: 'var(--gray-dark)' }}>{sub.phone} · SMS {sub.sms_opt_in ? 'opted in' : 'not opted in'}</p>}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--gray-dark)' }}><Clock size={14} style={{ marginRight: '4px' }} />{sub.subscribed_at ? new Date(sub.subscribed_at).toLocaleDateString() : sub.subscribedAt ? new Date(sub.subscribedAt).toLocaleDateString() : 'N/A'}</span>
                <button className="action-btn" onClick={() => editSubscriber(sub)} aria-label={`Edit ${sub.email} phone and SMS consent`}><Edit2 size={16} /></button>
                <button className="action-btn delete" onClick={() => handleDelete(sub.id)}><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
      {editingSubscriber && (
        <div className="modal-overlay show" onClick={() => setEditingSubscriber(null)}>
          <div className="modal subscriber-edit-modal" onClick={event => event.stopPropagation()}>
            <div className="modal-header">
              <h3>Subscriber contact preferences</h3>
              <button type="button" className="modal-close" onClick={() => setEditingSubscriber(null)} aria-label="Close subscriber editor"><X size={20} /></button>
            </div>
            <form onSubmit={saveSubscriberContact}>
              <div className="modal-body">
                <p>{editingSubscriber.email}</p>
                <label className="subscriber-edit-label">Phone number
                  <input type="tel" value={phoneDraft} onChange={event => setPhoneDraft(event.target.value)} placeholder="e.g. 0712 345 678" />
                </label>
                <label className="subscriber-sms-consent-admin">
                  <input type="checkbox" checked={smsConsentDraft} onChange={event => setSmsConsentDraft(event.target.checked)} />
                  Subscriber explicitly agreed to receive SMS updates
                </label>
                {subscriberSaveError && <p className="form-status error" role="alert">{subscriberSaveError}</p>}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setEditingSubscriber(null)}>Cancel</button>
                <button type="submit" className="btn-primary">Save preferences</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

