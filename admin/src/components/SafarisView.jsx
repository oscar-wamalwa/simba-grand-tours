import React, { useState, useEffect } from 'react';
import api from '../api';
import LineListField from './LineListField';
import { prepareImage } from '../imageUpload';
import { Search, Plus, Edit2, Trash2, Eye, EyeOff, Download, Star, Upload, X } from 'lucide-react';
import Select from './Select';
import { TRIP_TYPES, DURATION_CATEGORIES, durationCategory } from '../tripCategories';

const normalizeSafari = (safari) => ({
  ...safari,
  isSignature: safari.is_signature ?? safari.isSignature ?? false
});

export default function SafarisView({ onRefresh }) {
  const [safaris, setSafaris] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [form, setForm] = useState({ 
    title: '', 
    description: '', 
    location: '', 
    price: '', 
    booking_fee_kes: '',
    booking_terms: '',
    duration: '', 
    difficulty: 'Moderate', 
    trip_type: '',
    trip_mode: 'either',
    county: '',
    images: [], 
    videos: [],
    highlights: [], 
    inclusions: [],
    exclusions: [],
    itinerary: [],
    pickup_points: [],
    packing_checklist: [],
    visible: true, 
    is_open: true,
    isSignature: false,
  });

  useEffect(() => { fetchSafaris(); }, []);

  const fetchSafaris = async () => {
    try {
      const data = await api.safaris.getAll();
      setSafaris(data.map(d => normalizeSafari({ id: d.id, ...d })));
    } catch (error) {
      console.error('Error fetching safaris:', error);
      setActionError('Could not load safaris. Check the API connection and try again.');
    }
  };

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    try {
      setUploading(true);
      console.log('Starting image upload, files:', files.length);
      console.log('File sizes:', files.map(f => `${f.name}: ${(f.size / 1024 / 1024).toFixed(2)}MB`));
      
      const uploadPromises = files.map(async (file, index) => {
        try {
          console.log(`Processing file ${index + 1}:`, file.name);
          
          const base64Data = await prepareImage(file);
          
          console.log('Image prepared for upload');
          return base64Data;
        } catch (uploadError) {
          console.error(`Error processing ${file.name}:`, uploadError);
          return null;
        }
      });

      const uploadedUrls = await Promise.all(uploadPromises);
      const validUrls = uploadedUrls.filter(url => url !== null);
      console.log('Valid uploaded URLs:', validUrls.length);
      
      if (validUrls.length > 0) {
        setForm(prev => ({ ...prev, images: [...prev.images, ...validUrls] }));
      } else {
        alert('Failed to process images. Please try again.');
      }
    } catch (error) {
      console.error('Error uploading images:', error);
      alert('Error uploading images. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const removeImage = async (index) => {
    const newImages = form.images.filter((_, i) => i !== index);
    setForm(prev => ({ ...prev, images: newImages }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = { 
        ...form, 
        price: parseFloat(form.price), 
        booking_fee_kes: form.booking_fee_kes === '' ? null : Number(form.booking_fee_kes),
        highlights: form.highlights,
        inclusions: form.inclusions,
        exclusions: form.exclusions,
        itinerary: form.itinerary,
        pickup_points: form.pickup_points,
        packing_checklist: form.packing_checklist,
        isSignature: form.isSignature
      };
      
      if (editing) {
        await api.safaris.update(editing.id, data);
      } else {
        await api.safaris.create(data);
      }
      
      setShowModal(false);
      setEditing(null);
      setForm({ title: '', description: '', location: '', price: '', booking_fee_kes: '', booking_terms: '', duration: '', difficulty: 'Moderate', trip_type: '', trip_mode: 'either', county: '', images: [], videos: [], highlights: [], inclusions: [], exclusions: [], itinerary: [], pickup_points: [], packing_checklist: [], visible: true, is_open: true, isSignature: false });
      fetchSafaris();
      onRefresh && onRefresh();
    } catch (error) { 
      console.error('Error saving safari:', error); 
      alert('Error saving safari. Please try again.');
    }
  };

  const handleDelete = async (safari) => {
    if (confirm(`Permanently delete ${safari.title}? Its departures without bookings and their waitlist entries will also be deleted. Departures with bookings must be deleted separately first. This cannot be undone.`)) {
      try {
        await api.safaris.delete(safari.id);
        fetchSafaris();
        onRefresh && onRefresh();
      } catch (error) {
        console.error('Error deleting safari:', error);
        alert(error.message || 'Error deleting safari. Please try again.');
      }
    }
  };

  const toggleVisibility = async (safari) => {
    setActionError('');
    try {
      const updated = await api.safaris.partialUpdate(safari.id, { visible: !safari.visible });
      setSafaris(current => current.map(item => item.id === safari.id
        ? normalizeSafari(updated)
        : item));
      onRefresh?.();
    } catch (error) {
      console.error('Error updating visibility:', error);
      setActionError('Could not update safari visibility. Please try again.');
    }
  };

  const toggleOpen = async (safari) => {
    setActionError('');
    try {
      const updated = await api.safaris.partialUpdate(safari.id, { is_open: safari.is_open === false });
      setSafaris(current => current.map(item => item.id === safari.id ? normalizeSafari(updated) : item));
      onRefresh?.();
    } catch (error) {
      console.error('Error updating open status:', error);
      setActionError('Could not update the open/closed status. Please try again.');
    }
  };

  const toggleSignature = async (safari) => {
    setActionError('');
    try {
      const updated = await api.safaris.partialUpdate(safari.id, { isSignature: !safari.isSignature });
      setSafaris(current => current.map(item => item.id === safari.id
        ? normalizeSafari(updated)
        : item));
    } catch (error) {
      console.error('Error updating signature status:', error);
      setActionError('Could not update signature status. Please try again.');
    }
  };

  const editSafari = async (summary) => {
    let s = summary;
    try {
      s = normalizeSafari(await api.safaris.getById(summary.id));
    } catch (error) {
      console.error('Error loading safari:', error);
      setActionError('Could not load this safari. Please try again.');
      return;
    }
    setEditing(s);
    setForm({ 
      title: s.title, 
      description: s.description, 
      location: s.location, 
      price: s.price, 
      booking_fee_kes: s.booking_fee_kes ?? '',
      booking_terms: s.booking_terms || '',
      duration: durationCategory(s.duration) || s.duration, 
      difficulty: s.difficulty, 
      trip_type: s.trip_type || '',
      trip_mode: s.trip_mode || 'either',
      county: s.county || '',
      images: s.images || [], 
      videos: s.videos || [],
      highlights: s.highlights || [], 
      inclusions: s.inclusions || [],
      exclusions: s.exclusions || [],
      itinerary: s.itinerary || [],
      pickup_points: s.pickup_points || [],
      packing_checklist: s.packing_checklist || [],
      visible: s.visible, 
      is_open: s.is_open !== false,
      isSignature: s.isSignature ?? s.is_signature ?? false,
    });
    setShowModal(true);
  };

  const filtered = safaris.filter(s => 
    s.title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.location?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const downloadCSV = () => {
    const headers = ['Title', 'Location', 'Duration', 'Difficulty', 'Status', 'Signature', 'Created At'];
    const rows = filtered.map(safari => [
      safari.title || '',
      safari.location || '',
      safari.duration || '',
      safari.difficulty || '',
      safari.visible !== false ? 'Active' : 'Hidden',
      safari.isSignature ? 'Yes' : 'No',
      safari.created_at ? new Date(safari.created_at).toLocaleDateString() : ''
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `safaris_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="data-card fade-in">
      <div className="data-card-header">
        <h3>Safari Packages Management</h3>
        <div className="data-actions">
          <div className="search-box"><Search size={18} /><input type="text" placeholder="Search safaris..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
          <button className="btn-secondary" onClick={downloadCSV} style={{ padding: '10px 16px' }}>
            <Download size={18} /> Download CSV
          </button>
          <button className="btn-primary" onClick={() => { setEditing(null); setForm({ title: '', description: '', location: '', price: '', booking_fee_kes: '', booking_terms: '', duration: '', difficulty: 'Moderate', trip_type: '', trip_mode: 'either', county: '', images: [], videos: [], highlights: [], inclusions: [], exclusions: [], itinerary: [], pickup_points: [], packing_checklist: [], visible: true, is_open: true, isSignature: false }); setShowModal(true); }}>
            <Plus size={18} /> Add New Safari
          </button>
        </div>
      </div>

      {actionError && <p className="form-status error" role="alert">{actionError}</p>}

      <div className="data-table-wrapper">
        <table className="data-table">
          <thead><tr><th>Title</th><th>Location</th><th>Status</th><th>Bookings</th><th>Signature</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.map(safari => (
              <tr key={safari.id}>
                <td><p className="safari-title">{safari.title}</p></td>
                <td><p className="safari-location">{safari.location}</p></td>
                <td><span className={`status-badge ${safari.visible !== false ? 'active' : 'archived'}`}>{safari.visible !== false ? 'Active' : 'Hidden'}</span></td>
                <td>
                  <span className={`status-badge ${safari.is_open === false ? 'archived' : 'active'}`}>{safari.is_open === false ? 'Closed' : 'Open'}</span>
                  <button className="action-btn" style={{ display: 'block', marginTop: '8px' }} onClick={() => toggleOpen(safari)}>{safari.is_open === false ? 'Open trip' : 'Close trip'}</button>
                </td>
                <td>{safari.isSignature ? <span className="signature-badge"><Star size={14} /> Signature</span> : <span className="signature-badge inactive">Not Signature</span>}</td>
                <td>
                  <div className="table-actions">
                    <button className="action-btn" onClick={() => toggleVisibility(safari)} title={safari.visible ? 'Hide' : 'Show'}>{safari.visible ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                    <button className="action-btn signature-btn" onClick={() => toggleSignature(safari)} style={{ color: safari.isSignature ? 'var(--gold-majesty)' : 'var(--gray-dark)' }}>
                      <Star size={16} fill={safari.isSignature ? 'currentColor' : 'none'} />
                    </button>
                    <button className="action-btn" onClick={() => editSafari(safari)}><Edit2 size={16} /></button>
                    <button className="action-btn delete" aria-label={`Delete ${safari.title}`} onClick={() => handleDelete(safari)}><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay show" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editing ? 'Edit Safari' : 'Add New Safari'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)} aria-label="Close safari form"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group"><label>Title *</label><input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required /></div>
                <div className="form-group"><label>Description *</label><textarea rows="4" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} required /></div>
                <div className="form-row">
                  <div className="form-group"><label>Destination *</label><input type="text" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} required /></div>
                  <div className="form-group"><label>Full Amount (KES) *</label><input type="number" min="1" step="1" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} required /></div>
                  <div className="form-group"><label>Booking Fee (KES)</label><input type="number" min="1" step="1" value={form.booking_fee_kes} onChange={e => setForm({ ...form, booking_fee_kes: e.target.value })} /></div>
                </div>
                <div className="form-group">
                  <label>Booking Terms / Notes</label>
                  <textarea rows="3" value={form.booking_terms} onChange={e => setForm({ ...form, booking_terms: e.target.value })} placeholder="e.g. Booking fee is non-refundable" />
                </div>
                <div className="form-row">
                  <div className="form-group"><label>County</label><input type="text" value={form.county} onChange={e => setForm({ ...form, county: e.target.value })} /></div>
                  <div className="form-group"><label>Safari type</label><Select value={form.trip_type} onChange={e => setForm({ ...form, trip_type: e.target.value })}>
                    <option value="">Choose a safari type</option>
                    {form.trip_type && !TRIP_TYPES.includes(form.trip_type) && <option value={form.trip_type}>{form.trip_type}</option>}
                    {TRIP_TYPES.map(item => <option key={item} value={item}>{item}</option>)}
                  </Select></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label>Duration</label><Select value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })}>
                    <option value="">Choose a duration</option>
                    {form.duration && !DURATION_CATEGORIES.includes(form.duration) && <option value={form.duration}>{form.duration}</option>}
                    {DURATION_CATEGORIES.map(item => <option key={item} value={item}>{item}</option>)}
                  </Select></div>
                  <div className="form-group"><label>Trip style</label>
                    <Select value={form.trip_mode} onChange={e => setForm({ ...form, trip_mode: e.target.value })}>
                      <option value="either">Group or private</option><option value="group">Group</option><option value="private">Private</option>
                    </Select>
                  </div>
                  <div className="form-group"><label>Difficulty</label>
                    <Select value={form.difficulty} onChange={e => setForm({ ...form, difficulty: e.target.value })}>
                      <option value="Easy">Easy</option><option value="Moderate">Moderate</option><option value="Challenging">Challenging</option>
                    </Select>
                  </div>
                </div>
                <div className="form-group">
                  <label>Highlights (one per line)</label>
                  <LineListField rows="3" value={(form.highlights || []).join('\n')} onChange={items => setForm(prev => ({ ...prev, highlights: items }))} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Included (one per line)</label>
                    <LineListField rows="4" value={(form.inclusions || []).join('\n')} onChange={items => setForm(prev => ({ ...prev, inclusions: items }))} />
                  </div>
                  <div className="form-group">
                    <label>Excluded (one per line)</label>
                    <LineListField rows="4" value={(form.exclusions || []).join('\n')} onChange={items => setForm(prev => ({ ...prev, exclusions: items }))} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Itinerary (one day or stop per line)</label>
                  <LineListField rows="5" value={(form.itinerary || []).join('\n')} onChange={items => setForm(prev => ({ ...prev, itinerary: items }))} placeholder={'Day 1 - Arrival and lodge transfer\nDay 2 - Morning and evening game drives'} />
                </div>
                <div className="form-group">
                  <label>Pickup points (one per line; add times after a dash)</label>
                  <LineListField rows="3" value={(form.pickup_points || []).map(item => typeof item === 'string' ? item : `${item.name}${item.time ? ` - ${item.time}` : ''}`).join('\n')} onChange={items => setForm(prev => ({ ...prev, pickup_points: items }))} placeholder="Nairobi CBD - 6:00 AM" />
                </div>
                <div className="form-group">
                  <label>Packing checklist (one item per line)</label>
                  <LineListField rows="3" value={(form.packing_checklist || []).join('\n')} onChange={items => setForm(prev => ({ ...prev, packing_checklist: items }))} placeholder="Comfortable walking shoes" />
                </div>
                <div className="form-group">
                  <label>Video URLs (one per line)</label>
                  <LineListField rows="3" value={(form.videos || []).join('\n')} onChange={items => setForm(prev => ({ ...prev, videos: items }))} placeholder="https://example.com/safari-video.mp4" />
                </div>
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input type="checkbox" checked={form.isSignature} onChange={e => setForm({ ...form, isSignature: e.target.checked })} style={{ width: 'auto' }} />
                    Mark as Signature Safari
                  </label>
                </div>
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input type="checkbox" checked={form.visible} onChange={e => setForm({ ...form, visible: e.target.checked })} style={{ width: 'auto' }} />
                    Visible on website
                  </label>
                </div>
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input type="checkbox" checked={form.is_open !== false} onChange={e => setForm({ ...form, is_open: e.target.checked })} style={{ width: 'auto' }} />
                    Open for bookings (untick to show "Closed" and disable the trip card)
                  </label>
                </div>
                {/* Image Upload Section */}
                <div className="form-group">
                  <label>Images</label>
                  <div className="safari-images-upload">
                    {form.images.length > 0 && (
                      <div className="image-previews-grid">
                        {form.images.map((url, index) => (
                          <div key={index} className="image-preview-item">
                            <img src={url} alt={`Safari image ${index + 1}`} className="safari-image-preview" />
                            <button 
                              type="button" 
                              className="remove-image-btn" 
                              onClick={() => removeImage(index)}
                              title="Remove image"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="image-upload-area">
                      {uploading ? (
                        <div className="upload-loading">
                          <div className="spinner"></div>
                          <p>Uploading images...</p>
                        </div>
                      ) : (
                        <>
                          <Upload size={40} color="var(--gray-dark)" />
                          <p>Click or drag to upload safari images</p>
                          <span>Recommended: 1200 x 600px (Max 5MB each)</span>
                        </>
                      )}
                      <input 
                        type="file" 
                        accept="image/*" 
                        multiple
                        onChange={handleImageUpload} 
                        className="file-input" 
                        disabled={uploading}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary">{editing ? 'Save Changes' : 'Add Safari'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

