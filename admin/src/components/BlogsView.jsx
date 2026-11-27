import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import api from '../api';
import { Search, Plus, Edit2, Trash2, Eye, Download, FileText, Calendar, Upload, X, BookOpen, CheckCircle } from 'lucide-react';

const MAX_BLOG_IMAGE_DATA_LENGTH = 2_000_000;

const prepareBlogImage = async (file) => {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Choose a JPEG, PNG, or WebP image.');
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('Choose an image smaller than 10 MB.');
  }

  const source = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read the selected image.'));
    reader.readAsDataURL(file);
  });
  const image = new Image();
  image.src = source;
  await image.decode();

  const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not prepare the selected image.');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
  if (dataUrl.length > MAX_BLOG_IMAGE_DATA_LENGTH) {
    throw new Error('The image is too large after compression. Choose a smaller image.');
  }
  return dataUrl;
};

const renderParagraphs = (content) => {
  const paragraphs = String(content || '').trim().split(/\r?\n\s*\r?\n/).filter(paragraph => paragraph.trim());
  return paragraphs.length
    ? paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)
    : <p>No content provided.</p>;
};

// Hide icon component
const HideIcon = ({ size = 16, style = {} }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={style}>
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

export default function BlogsView({ onRefresh }) {
  const [blogs, setBlogs] = useState([]);
  const [blogsLoading, setBlogsLoading] = useState(true);
  const [blogsError, setBlogsError] = useState('');
  const [comments, setComments] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedBlog, setSelectedBlog] = useState(null);
  const [commentError, setCommentError] = useState('');
  const [commentFilter, setCommentFilter] = useState('all');
  const [deletingCommentId, setDeletingCommentId] = useState(null);

  const categories = ['Safari Story', 'Travel Tips', 'Wildlife Update', 'Conservation', 'Guest Post'];

  useEffect(() => {
    fetchBlogs();
    fetchComments();
  }, []);

  const fetchBlogs = async () => {
    setBlogsLoading(true);
    setBlogsError('');
    try {
      const data = await api.blogs.getAll();
      setBlogs(data.map(d => ({ id: d.id, ...d })));
    } catch (e) {
      console.error('Error fetching blogs:', e);
      setBlogsError('Could not load blog posts. Please try again.');
    } finally {
      setBlogsLoading(false);
    }
  };

  const fetchComments = async () => {
    try {
      const data = await api.blogComments.getAll();
      setComments(data);
      setCommentError('');
    } catch (error) {
      console.error('Error fetching blog replies:', error);
      setCommentError('Could not load reader replies. Please refresh and try again.');
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
      setSelectedBlog(current => current?.id === blog.id ? { ...current, status: newStatus } : current);
      onRefresh && onRefresh();
    } catch (e) {
      console.error('Error updating blog status:', e);
      alert(e.message || 'Could not update the blog status. Please try again.');
    }
  };

  const moderateComment = async (comment, status) => {
    try {
      await api.blogComments.partialUpdate(comment.id, { status });
      await fetchComments();
    } catch (error) {
      console.error('Error moderating blog reply:', error);
      alert(error.message || 'Could not update the reply. Please try again.');
    }
  };

  const deleteComment = async (comment) => {
    if (!window.confirm('Permanently delete this reply? It will be removed from the public blog and cannot be restored.')) {
      return;
    }

    setDeletingCommentId(comment.id);
    try {
      await api.blogComments.delete(comment.id);
      await fetchComments();
    } catch (error) {
      console.error('Error deleting blog reply:', error);
      alert(error.message || 'Could not delete the reply. Please try again.');
    } finally {
      setDeletingCommentId(null);
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
  const filteredComments = comments.filter(comment => (
    commentFilter === 'all' || comment.status === commentFilter
  ));
  const commentCounts = comments.reduce((counts, comment) => {
    counts[comment.status] = (counts[comment.status] || 0) + 1;
    return counts;
  }, {});

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
                <th>Title</th>
                <th>Category</th>
                <th>Author</th>
                <th>Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {blogsError ? (
                <tr>
                  <td colSpan="6" className="blog-table-message error" role="alert">
                    <p>{blogsError}</p>
                    <button className="btn-secondary" type="button" onClick={fetchBlogs}>Retry</button>
                  </td>
                </tr>
              ) : blogsLoading ? (
                <tr>
                  <td colSpan="6" className="blog-table-message">Loading blog posts...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="6" className="blog-table-message">
                    <FileText size={48} style={{ marginBottom: '15px', opacity: 0.5 }} />
                    <p>No blog posts found. Create your first blog post!</p>
                  </td>
                </tr>
              ) : (
                filtered.map(blog => (
                  <tr key={blog.id}>
                    <td>
                      <button
                        className="blog-title-link"
                        type="button"
                        onClick={() => setSelectedBlog(blog)}
                        aria-label={`Read blog post: ${blog.title}`}
                      >
                        {blog.title}
                      </button>
                    </td>
                    <td><span className="blog-category-badge">{blog.category || 'Uncategorized'}</span></td>
                    <td><p className="safari-location">{blog.author || 'Anonymous'}</p></td>
                    <td><p style={{ fontSize: '0.9rem', color: 'var(--gray-dark)' }}>{formatDate(blog.created_at)}</p></td>
                    <td>
                      <span className={`status-badge ${blog.status === 'published' ? 'active' : 'archived'}`}>
                        {blog.status === 'published'
                          ? 'Published'
                          : blog.status === 'pending_review' ? 'Pending review' : 'Draft'}
                      </span>
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          className="action-btn blog-read-btn"
                          type="button"
                          onClick={() => setSelectedBlog(blog)}
                          aria-label={`Read blog post: ${blog.title}`}
                        >
                          <BookOpen size={16} />
                          <span>Read</span>
                        </button>
                        <button className="action-btn" onClick={() => toggleStatus(blog)} title={
                          blog.status === 'published'
                            ? 'Unpublish'
                            : blog.status === 'pending_review' ? 'Approve and publish' : 'Publish'
                        }>
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

      <div className="data-card blog-comments-moderation">
        <div className="data-card-header blog-comments-header">
          <div>
            <h3>Reader Replies</h3>
            <p>Review, hide, or permanently delete replies.</p>
          </div>
          <label className="blog-comment-filter">
            Show
            <select value={commentFilter} onChange={event => setCommentFilter(event.target.value)}>
              <option value="all">All replies ({comments.length})</option>
              <option value="pending_review">Pending ({commentCounts.pending_review || 0})</option>
              <option value="approved">Published ({commentCounts.approved || 0})</option>
              <option value="rejected">Hidden ({commentCounts.rejected || 0})</option>
            </select>
          </label>
        </div>
        {commentError && <p className="contact-reply-feedback error" role="alert">{commentError}</p>}
        {!commentError && filteredComments.length === 0 ? (
          <p className="blog-comments-empty">No replies match this filter.</p>
        ) : (
          <div className="blog-comments-list">
            {filteredComments.map(comment => {
              const blog = blogs.find(item => String(item.id) === String(comment.blog));
              return (
                <article className="blog-comment-review" key={comment.id}>
                  <div>
                    <strong>{comment.name}</strong>
                    <span> on </span>
                    <strong>{blog?.title || 'Blog post'}</strong>
                    <span className={`status-badge blog-comment-status ${comment.status}`}>
                      {comment.status === 'pending_review'
                        ? 'Pending'
                        : comment.status === 'approved' ? 'Published' : 'Hidden'}
                    </span>
                    <small>{formatDate(comment.created_at)}</small>
                  </div>
                  <p>{comment.content}</p>
                  {comment.email && <small>Contact: {comment.email}</small>}
                  <div className="blog-comment-review-actions">
                    {comment.status === 'pending_review' ? (
                      <>
                        <button className="btn-primary" type="button" onClick={() => moderateComment(comment, 'approved')}>
                          <CheckCircle size={16} /> Approve
                        </button>
                        <button className="btn-secondary" type="button" onClick={() => moderateComment(comment, 'rejected')}>
                          <X size={16} /> Reject
                        </button>
                      </>
                    ) : comment.status === 'approved' ? (
                      <button className="btn-secondary" type="button" onClick={() => moderateComment(comment, 'rejected')}>
                        <X size={16} /> Hide
                      </button>
                    ) : (
                      <button className="btn-primary" type="button" onClick={() => moderateComment(comment, 'approved')}>
                        <CheckCircle size={16} /> Restore
                      </button>
                    )}
                    <button
                      className="btn-danger"
                      type="button"
                      disabled={deletingCommentId === comment.id}
                      onClick={() => deleteComment(comment)}
                    >
                      <Trash2 size={16} /> {deletingCommentId === comment.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {selectedBlog && createPortal(
        <div className="modal-overlay show" onClick={() => setSelectedBlog(null)}>
          <div className="modal blog-reading-modal" onClick={event => event.stopPropagation()}>
            <div className="modal-header">
              <h3>Read Blog Post</h3>
              <button className="modal-close" onClick={() => setSelectedBlog(null)} aria-label="Close blog post">
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <h2>{selectedBlog.title}</h2>
              <p className="blog-reading-meta">
                {selectedBlog.author || 'Anonymous'} · {selectedBlog.category || 'Uncategorized'} · {formatDate(selectedBlog.created_at)}
              </p>
              {selectedBlog.image && (
                <img className="blog-reading-image" src={selectedBlog.image} alt={`Featured image for ${selectedBlog.title}`} />
              )}
              {selectedBlog.status === 'pending_review' && (
                <p className="blog-review-note">
                  Review the post and any submitted image. You can replace or remove the image before publishing.
                </p>
              )}
              <div className="blog-reading-content">{renderParagraphs(selectedBlog.content)}</div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setSelectedBlog(null)}>Close</button>
              <button
                className="btn-secondary"
                onClick={() => {
                  setEditing(selectedBlog);
                  setSelectedBlog(null);
                  setShowEditor(true);
                }}
              >
                <Edit2 size={16} /> Edit
              </button>
              {selectedBlog.status === 'pending_review' && (
                <button className="btn-primary" onClick={() => toggleStatus(selectedBlog)}>
                  <CheckCircle size={16} /> Approve and publish
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

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
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      setUploading(true);
      const image = await prepareBlogImage(file);
      setForm(prev => ({ ...prev, image }));
      setPreviewImage(image);
    } catch (error) {
      console.error('Error uploading image:', error);
      alert(error.message || 'Error preparing the image. Please try again.');
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
              <label>Featured Image (optional)</label>
              {blog?.status === 'pending_review' && (
                <p className="blog-review-note">Review this client-submitted image before publishing. You can replace or remove it.</p>
              )}
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
                  accept="image/jpeg,image/png,image/webp"
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
                  <button type="button" onClick={() => insertFormatting('\n\n')} title="Start a new paragraph">Paragraph</button>
                  <span className="toolbar-divider"></span>
                  <span className="toolbar-hint">Leave a blank line between paragraphs for clear spacing.</span>
                </div>
                <textarea
                  id="blog-content"
                  value={form.content}
                  onChange={e => setForm(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="Write your blog content here. Leave a blank line between paragraphs."
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
                {form.status === 'pending_review' && (
                  <button type="button" className="status-toggle-btn active" disabled>
                    Pending review
                  </button>
                )}
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

