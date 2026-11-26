import React, { useState, useEffect } from 'react';
import api from '../api';
import { Search, Mail, Clock, Trash2, Download } from 'lucide-react';

export default function SubscribersView() {
  const [subscribers, setSubscribers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

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
    s.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const downloadCSV = () => {
    const headers = ['Name', 'Email', 'Subscribed At'];
    const rows = filtered.map(sub => [
      sub.name || 'Anonymous',
      sub.email || '',
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
      {filtered.length === 0 ? (
        <div className="empty-state" style={{ padding: '60px 20px', textAlign: 'center' }}><Mail size={60} /><h3>No Subscribers</h3></div>
      ) : (
        <div className="subscribers-list">
          {filtered.map(sub => (
            <div key={sub.id} className="subscriber-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 30px', borderBottom: '1px solid var(--gray-light)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <div style={{ width: '40px', height: '40px', background: 'var(--sky-sand)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '600', color: 'var(--deep-bronze)' }}>{sub.name ? sub.name.charAt(0).toUpperCase() : <Mail size={20} />}</div>
                <div><h4 style={{ fontSize: '0.95rem', marginBottom: '2px' }}>{sub.name || 'Anonymous'}</h4><p style={{ fontSize: '0.85rem', color: 'var(--gray-dark)' }}>{sub.email}</p></div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--gray-dark)' }}><Clock size={14} style={{ marginRight: '4px' }} />{sub.subscribed_at ? new Date(sub.subscribed_at).toLocaleDateString() : sub.subscribedAt ? new Date(sub.subscribedAt).toLocaleDateString() : 'N/A'}</span>
                <button className="action-btn delete" onClick={() => handleDelete(sub.id)}><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

