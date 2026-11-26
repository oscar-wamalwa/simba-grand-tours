import React, { useState, useEffect } from 'react';
import api from '../api';
import { Search, Plus, Edit2, Trash2, Eye, Download, FileText, Image, Calendar, Upload, X } from 'lucide-react';

// Hide icon component
const HideIcon = ({ size = 16, style = {} }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={style}>
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

export default function BlogsView({ onRefresh }) {
  const [blogs, setBlogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const [editing, setEditing] = useState(null);

  const categories = ['Safari Story', 'Travel Tips', 'Wildlife Update', 'Conservation', 'Guest Post'];

  useEffect(() => { fetchBlogs(); }, []);

  const fetchBlogs = async () => {
    try {
      const data = await api.blogs.getAll();
      setBlogs(data.map(d => ({ id: d.id, ...d })));
    } catch (e) {
      console.error('Error fetching blogs:', e);
    }
  };

  const handleDelete = async (id) => {
    if (confirm('Delete this blog post? This action cannot be undone.')) {
      try {
        await api.blogs.delete(id);
        fetchBlogs();
        onRefresh && onRefresh();
      } catch (e) {
        console.error('Error deleting blog:', e);
        alert('Error deleting blog. Please try again.');
      }
    }
  };

  const toggleStatus = async (blog) => {
    try {
      const newStatus = blog.status === 'published' ? 'draft' : 'published';
      await api.blogs.partialUpdate(blog.id, { status: newStatus });
      fetchBlogs();
      onRefresh && onRefresh();
    } catch (e) {
      console.error('Error updating blog status:', e);
    }
  };

  const editBlog = (blog) => {
    setEditing(blog);
    setShowEditor(true);
  };

  const createNewBlog = () => {
    setEditing(null);
    setShowEditor(true);
  };

  const filtered = blogs.filter(b => 
    b.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.author?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (date) => {
    if (!date) return 'N/A';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const downloadCSV = () => {
    const headers = ['Title', 'Category', 'Author', 'Location', 'Read Time', 'Publish Date', 'Status', 'Created At'];
    const rows = filtered.map(blog => [
      blog.title || '',
      blog.category || '',
      blog.author || '',
      blog.location || '',
      blog.read_time || '',
      blog.publish_date || '',
      blog.status === 'published' ? 'Published' : 'Draft',
      formatDate(blog.created_at)
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `blogs_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="fade-in">
      <div className="data-card">
        <div className="data-card-header">
          <h3>Blog Posts Management</h3>
          <div className="data-actions">
            <div className="search-box"><Search size={18} /><input type="text" placeholder="Search blogs..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
            <button className="btn-secondary" onClick={downloadCSV} style={{ padding: '10px 16px' }}>
              <Download size={18} /> Download CSV
            </button>
            <button className="btn-primary" onClick={createNewBlog}>
              <Plus size={18} /> Add New Blog
            </button>
          </div>
        </div>

        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Image</th>
                <th>Title</th>
                <th>Category</th>
                <th>Author</th>
                <th>Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--gray-dark)' }}>
                    <FileText size={48} style={{ marginBottom: '15px', opacity: 0.5 }} />
                    <p>No blog posts found. Create your first blog post!</p>
                  </td>
                </tr>
              ) : (
                filtered.map(blog => (
                  <tr key={blog.id}>
                    <td>
                      {blog.image ? (
                        <img src={blog.image} alt={blog.title} className="safari-thumb" />
                      ) : (
                        <div className="safari-thumb-placeholder" style={{ background: 'var(--gray-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Image size={20} color="var(--gray-dark)" />
                        </div>
                      )}
                    </td>
                    <td>
                      <p className="safari-title" style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {blog.title}
                      </p>
                    </td>
                    <td><span className="blog-category-badge">{blog.category || 'Uncategorized'}</span></td>
                    <td><p className="safari-location">{blog.author || 'Anonymous'}</p></td>
                    <td><p style={{ fontSize: '0.9rem', color: 'var(--gray-dark)' }}>{formatDate(blog.created_at)}</p></td>
                    <td>
                      <span className={`status-badge ${blog.status === 'published' ? 'active' : 'archived'}`}>
                        {blog.status === 'published' ? 'Published' : 'Draft'}
                      </span>
                    </td>
                    <td>
                      <div className="table-actions">
                        <button className="action-btn" onClick={() => toggleStatus(blog)} title={blog.status === 'published' ? 'Unpublish' : 'Publish'}>
                          {blog.status === 'published' ? <HideIcon size={16} /> : <Eye size={16} />}
                        </button>
                        <button className="action-btn" onClick={() => editBlog(blog)}><Edit2 size={16} /></button>
                        <button className="action-btn delete" onClick={() => handleDelete(blog.id)}><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showEditor && (
        <BlogEditorModal
          blog={editing}
          categories={categories}
          onClose={() => { setShowEditor(false); setEditing(null); }}
          onSave={() => { fetchBlogs(); onRefresh && onRefresh(); setShowEditor(false); setEditing(null); }}
        />
      )}
    </div>
  );
}

// Blog Editor Modal Component
function BlogEditorModal({ blog, categories, onClose, onSave }) {
  const [form, setForm] = useState({
    title: '',
    category: 'Safari Story',
    author: '',
    location: '',
    content: '',
    readTime: '',
    publishDate: new Date().toISOString().split('T')[0],
    status: 'draft',
    image: ''
  });
  const [uploading, setUploading] = useState(false);
  const [previewImage, setPreviewImage] = useState('');

  useEffect(() => {
    if (blog) {
      setForm({
        title: blog.title || '',
        category: blog.category || 'Safari Story',
        author: blog.author || '',
        location: blog.location || '',
        content: blog.content || '',
        readTime: blog.read_time || '',
        publishDate: blog.publish_date ? blog.publish_date.split('T')[0] : new Date().toISOString().split('T')[0],
        status: blog.status || 'draft',
        image: blog.image || ''
      });
      setPreviewImage(blog.image || '');
    }
  }, [blog]);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setUploading(true);
      
      // Convert file to base64 for API upload
      const reader = new FileReader();
      const base64Data = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      
      setForm(prev => ({ ...prev, image: base64Data }));
      setPreviewImage(base64Data);
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Error uploading image. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!form.title.trim()) {
      alert('Please enter a blog title');
      return;
    }
    
    if (!form.content.trim()) {
      alert('Please enter blog content');
      return;
    }

    try {
      const blogData = {
        title: form.title.trim(),
        category: form.category,
        author: form.author.trim() || 'Simba Grand Tours',
        location: form.location.trim() || 'Kenya',
        content: form.content,
        read_time: form.readTime || '5 min read',
        publish_date: form.publishDate,
        status: form.status,
        image: form.image
      };

      if (blog) {
        await api.blogs.update(blog.id, blogData);
      } else {
        await api.blogs.create(blogData);
      }

      onSave();
    } catch (error) {
      console.error('Error saving blog:', error);
      alert('Error saving blog. Please try again.');
    }
  };

  const insertFormatting = (before, after = '') => {
    const textarea = document.getElementById('blog-content');
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = form.content.substring(start, end);
    const newText = form.content.substring(0, start) + before + selectedText + after + form.content.substring(end);
    setForm(prev => ({ ...prev, content: newText }));
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, end + before.length);
    }, 0);
  };

  // X icon component for the editor
  const X = ({ size = 16, style = {} }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={style}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );

  return (
    <div className="modal-overlay show" onClick={onClose}>
      <div className="modal blog-editor-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '900px' }}>
        <div className="modal-header">
          <h3>{blog ? 'Edit Blog Post' : 'Create New Blog Post'}</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close blog editor"><X size={20} /></button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            {/* Featured Image Upload */}
            <div className="form-group">
              <label>Featured Image</label>
              <div className="image-upload-area">
                {previewImage ? (
                  <div className="image-preview-container">
                    <img src={previewImage} alt="Preview" className="image-preview" />
                    <button type="button" className="remove-image-btn" onClick={() => { setForm(prev => ({ ...prev, image: '' })); setPreviewImage(''); }}>
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="upload-placeholder">
                    <Upload size={40} color="var(--gray-dark)" />
                    <p>Click or drag to upload featured image</p>
                    <span>Recommended: 1200 x 600px</span>
                  </div>
                )}
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleImageUpload} 
                  className="file-input" 
                  disabled={uploading}
                />
              </div>
              {uploading && <p style={{ color: 'var(--gold-majesty)', marginTop: '10px' }}>Uploading image...</p>}
            </div>

            {/* Title */}
            <div className="form-group">
              <label>Blog Title *</label>
              <input 
                type="text" 
                value={form.title} 
                onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter an engaging title for your blog post..."
                required
              />
            </div>

            {/* Category and Author Row */}
            <div className="form-row">
              <div className="form-group">
                <label>Category</label>
                <select 
                  value={form.category} 
                  onChange={e => setForm(prev => ({ ...prev, category: e.target.value }))}
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Author</label>
                <input 
                  type="text" 
                  value={form.author} 
                  onChange={e => setForm(prev => ({ ...prev, author: e.target.value }))}
                  placeholder="Author name"
                />
              </div>
            </div>

            {/* Location and Read Time Row */}
            <div className="form-row">
              <div className="form-group">
                <label>Location</label>
                <input 
                  type="text" 
                  value={form.location} 
                  onChange={e => setForm(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="e.g., Serengeti, Tanzania"
                />
              </div>
              <div className="form-group">
                <label>Read Time</label>
                <input 
                  type="text" 
                  value={form.readTime} 
                  onChange={e => setForm(prev => ({ ...prev, readTime: e.target.value }))}
                  placeholder="e.g., 5 min read"
                />
              </div>
            </div>

            {/* Publish Date */}
            <div className="form-group">
              <label><Calendar size={16} style={{ marginRight: '8px' }} />Publish Date</label>
              <input 
                type="date" 
                value={form.publishDate} 
                onChange={e => setForm(prev => ({ ...prev, publishDate: e.target.value }))}
              />
            </div>

            {/* Rich Text Editor */}
            <div className="form-group">
              <label>Content *</label>
              <div className="rich-text-editor">
                <div className="editor-toolbar">
                  <button type="button" onClick={() => insertFormatting('<b>', '</b>')} title="Bold"><b>B</b></button>
                  <button type="button" onClick={() => insertFormatting('<i>', '</i>')} title="Italic"><i>I</i></button>
                  <button type="button" onClick={() => insertFormatting('<h3>', '</h3>')} title="Heading"><b>H</b></button>
                  <button type="button" onClick={() => insertFormatting('<li>', '</li>')} title="List">•</button>
                  <span className="toolbar-divider"></span>
                  <span className="toolbar-hint">Use {'<b>'} for bold, {'<h3>'} for headings, {'<li>'} for lists</span>
                </div>
                <textarea
                  id="blog-content"
                  value={form.content}
                  onChange={e => setForm(prev => ({ ...prev, content: e.target.value }))}
                  placeholder={"Write your blog content here... Use formatting tags like <b> for bold, <h3> for headings, and <li> for lists."}
                  rows={15}
                  required
                />
              </div>
            </div>

            {/* Status */}
            <div className="form-group">
              <label>Status</label>
              <div className="status-toggle-group">
                <button
                  type="button"
                  className={`status-toggle-btn ${form.status === 'draft' ? 'active' : ''}`}
                  onClick={() => setForm(prev => ({ ...prev, status: 'draft' }))}
                >
                  <FileText size={16} /> Draft
                </button>
                <button
                  type="button"
                  className={`status-toggle-btn ${form.status === 'published' ? 'active' : ''}`}
                  onClick={() => setForm(prev => ({ ...prev, status: 'published' }))}
                >
                  <Eye size={16} /> Published
                </button>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary">
              {blog ? 'Save Changes' : 'Create Blog Post'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

