import React, { useState, useEffect } from 'react';
import api from '../api';
import { Mail, Clock, Trash2, Download, CheckCircle, Eye, X } from 'lucide-react';

export default function MessagesView() {
  const [messages, setMessages] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => { fetchMessages(); }, []);

  const fetchMessages = async () => {
    try {
      const data = await api.messages.getAll();
      setMessages(data.map(d => ({ id: d.id, ...d })));
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const markRead = async (id) => { 
    try {
      await api.messages.partialUpdate(id, { read: true });
      fetchMessages(); 
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  };
  
  const handleDelete = async (id) => { 
    if (confirm('Delete message?')) {
      try {
        await api.messages.delete(id);
        setSelected(null); 
        fetchMessages(); 
      } catch (error) {
        console.error('Error deleting message:', error);
        alert('Error deleting message. Please try again.');
      }
    } 
  };

  const unreadCount = messages.filter(m => !m.read).length;

  const downloadCSV = () => {
    const headers = ['Name', 'Email', 'Phone', 'Subject', 'Message', 'Submitted At', 'Status'];
    const rows = messages.map(msg => [
      msg.full_name || msg.fullName || 'Anonymous',
      msg.email || '',
      msg.phone || '',
      msg.subject || '',
      msg.message || '',
      msg.submitted_at ? new Date(msg.submitted_at).toLocaleString() : msg.submittedAt ? new Date(msg.submittedAt).toLocaleString() : 'N/A',
      msg.read ? 'Read' : 'Unread'
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `messages_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="fade-in">
      <div className="data-card">
        <div className="data-card-header">
          <h3>Contact Messages {unreadCount > 0 && <span style={{ marginLeft: '10px', fontSize: '0.8rem', background: 'var(--gold-majesty)', padding: '2px 8px', borderRadius: '10px' }}>{unreadCount} unread</span>}</h3>
          <div className="data-actions">
            <button className="btn-secondary" onClick={downloadCSV} style={{ padding: '10px 16px' }}>
              <Download size={18} /> Download CSV
            </button>
          </div>
        </div>
  
  {messages.length === 0 ? (
    <div className="empty-state" style={{ padding: '60px 20px', textAlign: 'center' }}><Mail size={60} /><h3>No Messages</h3></div>
  ) : (
    <div className="message-list">
      {messages.map(msg => (
        <div key={msg.id} className={`message-item ${!msg.read ? 'unread' : ''}`} onClick={() => setSelected(msg)} style={{ cursor: 'pointer' }}>
          <div className="message-avatar">{msg.fullName ? msg.fullName.charAt(0).toUpperCase() : '?'}</div>
          <div className="message-content">
            <div className="message-header"><span className="message-name">{msg.fullName}</span><span className="message-time">{msg.submitted_at ? new Date(msg.submitted_at).toLocaleDateString() : msg.submittedAt ? new Date(msg.submittedAt).toLocaleDateString() : 'N/A'}</span></div>
            <p className="message-preview">{msg.message?.substring(0, 80)}...</p>
          </div>
        </div>
      ))}
    </div>
  )}
  </div>

  {selected && (
    <div className="modal-overlay show" onClick={() => setSelected(null)}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header"><h3>Message Details</h3><button className="modal-close" onClick={() => setSelected(null)} aria-label="Close message details"><X size={20} /></button></div>
        <div className="modal-body">
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ fontSize: '1.2rem', marginBottom: '5px' }}>{selected.fullName}</h4>
            <p style={{ color: 'var(--gray-dark)', fontSize: '0.9rem' }}>{selected.read ? <span style={{ color: 'var(--success)' }}><CheckCircle size={14} style={{ marginRight: '4px' }} />Read</span> : <span style={{ color: 'var(--warning)' }}>Unread</span>}</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '25px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--gray-dark)' }}><Mail size={16} /><a href={`mailto:${selected.email}`} style={{ color: 'var(--gold-majesty)' }}>{selected.email}</a></div>
            {selected.phone && <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--gray-dark)' }}><Clock size={16} />{selected.phone}</div>}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--gray-dark)' }}><Clock size={16} />{selected.submitted_at ? new Date(selected.submitted_at).toLocaleString() : selected.submittedAt ? new Date(selected.submittedAt).toLocaleString() : 'N/A'}</div>
            <div style={{ background: 'var(--gray-light)', padding: '20px', borderRadius: '12px', marginBottom: '20px' }}>
              <p style={{ fontWeight: '600', marginBottom: '10px' }}>{selected.subject || 'No Subject'}</p>
              <p style={{ color: 'var(--gray-dark)', lineHeight: '1.7', whiteSpace: 'pre-wrap' }}>{selected.message}</p>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {!selected.read && <button className="btn-success" onClick={() => markRead(selected.id)} style={{ background: 'var(--success)', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}><CheckCircle size={16} /> Mark as Read</button>}
              <a href={`mailto:${selected.email}`} className="btn-primary" style={{ textDecoration: 'none' }}><Mail size={16} /> Reply</a>
              <button className="btn-danger" onClick={() => handleDelete(selected.id)}><Trash2 size={16} /> Delete</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )}
  </div>
  );
}

