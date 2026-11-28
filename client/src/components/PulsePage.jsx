import { useEffect, useState } from 'react';
import { MapPin, PenLine, Send, X } from 'lucide-react';
import api from '../api';

const MAX_BLOG_IMAGE_DATA_LENGTH = 2_000_000;

const getBlogParagraphs = (content) => String(content || '')
  .trim()
  .split(/\r?\n\s*\r?\n/)
  .filter(paragraph => paragraph.trim());

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

const PulsePage = () => {
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedBlog, setExpandedBlog] = useState(null);
  const [commentsOpenBlog, setCommentsOpenBlog] = useState(null);
  const [commentsByBlog, setCommentsByBlog] = useState({});
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentForm, setCommentForm] = useState({ name: '', email: '', content: '' });
  const [commentError, setCommentError] = useState('');
  const [commentSuccess, setCommentSuccess] = useState('');
  const [showSubmissionForm, setShowSubmissionForm] = useState(false);
  const [submission, setSubmission] = useState({
    title: '',
    author: '',
    location: '',
    category: 'Safari Story',
    content: '',
    image: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState('');
  const [submissionSuccess, setSubmissionSuccess] = useState('');

  const handleImageChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setSubmissionError('');
    try {
      const image = await prepareBlogImage(file);
      setSubmission(prev => ({ ...prev, image }));
    } catch (error) {
      setSubmissionError(error.message || 'Could not prepare the selected image.');
    }
  };

  const loadComments = async (blogId) => {
    setCommentsLoading(true);
    setCommentError('');
    try {
      const comments = await api.blogComments.getAll({ blog: blogId });
      setCommentsByBlog(prev => ({ ...prev, [blogId]: comments }));
    } catch (error) {
      setCommentError(error.message || 'Could not load comments. Please try again.');
    } finally {
      setCommentsLoading(false);
    }
  };

  const toggleComments = (blogId) => {
    if (commentsOpenBlog === blogId) {
      setCommentsOpenBlog(null);
      setCommentError('');
      setCommentSuccess('');
      return;
    }
    setCommentsOpenBlog(blogId);
    setCommentForm({ name: '', email: '', content: '' });
    setCommentError('');
    setCommentSuccess('');
    loadComments(blogId);
  };

  const submitComment = async (event, blogId) => {
    event.preventDefault();
    setCommentSubmitting(true);
    setCommentError('');
    setCommentSuccess('');
    try {
      await api.blogComments.create({
        blog: blogId,
        name: commentForm.name.trim(),
        email: commentForm.email.trim(),
        content: commentForm.content.trim(),
      });
      setCommentForm({ name: '', email: '', content: '' });
      setCommentSuccess('Your comment was sent for review and will appear after approval.');
    } catch (error) {
      setCommentError(error.message || 'Could not submit your comment. Please try again.');
    } finally {
      setCommentSubmitting(false);
    }
  };

  useEffect(() => {
    const fetchBlogs = async () => {
      try {
        const data = await api.blogs.getAll({ status: 'published' });
        // Sort by created_at (newest first) - handle both timestamp and date string
        data.sort((a, b) => {
          const dateA = a.created_at ? new Date(a.created_at) : new Date();
          const dateB = b.created_at ? new Date(b.created_at) : new Date();
          return dateB - dateA;
        });
        setBlogs(data);
      } catch (err) {
        console.error("Error fetching blogs:", err);
        // Demo data as fallback
        setBlogs([
          {
            id: '1',
            title: 'The Great Migration: A Witness to Nature\'s Greatest Show',
            author: 'Simba Grand Tours Team',
            location: 'Nairobi, Kenya',
            category: 'Safari Story',
            content: 'Every year, over 2 million wildebeest, zebra, and gazelle migrate across the Serengeti-Mara ecosystem in a circular journey...',
            created_at: new Date().toISOString(),
            image: '/images/greatmigration.jpg'
          },
          {
            id: '2',
            title: 'Top 10 Photography Tips for Safari',
            author: 'John Photographer',
            location: 'London, UK',
            category: 'Travel Tips',
            content: 'Capturing the perfect moment on safari requires patience and preparation. Here are our top tips...',
            created_at: new Date(Date.now() - 86400000).toISOString(),
            image: '/images/amboseli.jpg'
          }
        ]);
      } finally {
        setLoading(false);
      }
    };
    fetchBlogs();
  }, []);

  const formatDate = (date) => {
    if (!date) return '';
    // Handle both created_at (API) and createdAt (mapped) formats
    const dateStr = date.created_at || date.createdAt || date;
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const submitStory = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setSubmissionError('');
    setSubmissionSuccess('');
    try {
      await api.blogs.create(submission);
      setSubmission({
        title: '',
        author: '',
        location: '',
        category: 'Safari Story',
        content: '',
        image: '',
      });
      setShowSubmissionForm(false);
      setSubmissionSuccess('Thank you! Your story has been submitted for review before publication.');
    } catch (error) {
      setSubmissionError(error.message || 'Could not submit your story. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="pulse-page">
        <header className="hero hero-pulse">
          <div className="hero-overlay"></div>
          <div className="hero-content">
            <h1>The Simba Pulse</h1>
            <p>Stories, insights, and adventures from the heart of Africa.</p>
          </div>
        </header>
        <div className="container section-padding text-center">
          <p>Loading stories...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pulse-page fade-in">
      <header className="hero hero-pulse">
        <div className="hero-overlay"></div>
        <div className="hero-content">
          <h1>The Simba Pulse</h1>
          <p>Stories, insights, and adventures from the heart of Africa.</p>
        </div>
      </header>

      <div className="container section-padding">
        <section className="story-submission">
          <div className="story-submission-heading">
            <div>
              <h2>Share your story</h2>
              <p>Have a safari story or travel tip to share? Send it to our team for review.</p>
            </div>
            <button
              type="button"
              className="story-action-btn story-action-btn-write"
              onClick={() => {
                setShowSubmissionForm(open => !open);
                setSubmissionError('');
                setSubmissionSuccess('');
              }}
            >
              {showSubmissionForm ? <><PenLine size={18} /> Close form</> : <><PenLine size={18} /> Write a story</>}
            </button>
          </div>
          {submissionSuccess && <p className="story-submission-feedback success" role="status">{submissionSuccess}</p>}
          {showSubmissionForm && (
            <form className="story-submission-form" onSubmit={submitStory}>
              <p className="story-submission-note">Stories are reviewed by Simba Grand Tours before they appear publicly. Please don’t include private information.</p>
              <div className="form-row">
                <label>
                  Story title
                  <input
                    value={submission.title}
                    onChange={event => setSubmission(prev => ({ ...prev, title: event.target.value }))}
                    maxLength={255}
                    required
                  />
                </label>
                <label>
                  Your name
                  <input
                    value={submission.author}
                    onChange={event => setSubmission(prev => ({ ...prev, author: event.target.value }))}
                    maxLength={255}
                    required
                  />
                </label>
              </div>
              <div className="form-row">
                <label>
                  Location
                  <input
                    value={submission.location}
                    onChange={event => setSubmission(prev => ({ ...prev, location: event.target.value }))}
                    maxLength={255}
                    placeholder="e.g. Maasai Mara, Kenya"
                  />
                </label>
                <label>
                  Category
                  <select
                    value={submission.category}
                    onChange={event => setSubmission(prev => ({ ...prev, category: event.target.value }))}
                  >
                    <option>Safari Story</option>
                    <option>Travel Tips</option>
                    <option>Wildlife Update</option>
                    <option>Conservation</option>
                    <option>Guest Post</option>
                  </select>
                </label>
              </div>
              <label>
                Your story
                <textarea
                  value={submission.content}
                  onChange={event => setSubmission(prev => ({ ...prev, content: event.target.value }))}
                  rows={8}
                  maxLength={20000}
                  placeholder="Write your story. Leave a blank line between paragraphs."
                  required
                />
              </label>
              <div className="story-image-field">
                <label htmlFor="story-image-upload">Optional story image</label>
                <input
                  id="story-image-upload"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageChange}
                />
                <small>Your image will be reviewed by our team before the story is published.</small>
                {submission.image && (
                  <div className="story-image-preview">
                    <img src={submission.image} alt="Selected story preview" />
                    <button
                      type="button"
                      className="story-image-remove"
                      onClick={() => setSubmission(prev => ({ ...prev, image: '' }))}
                      aria-label="Remove selected story image"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
              </div>
              {submissionError && <p className="story-submission-feedback error" role="alert">{submissionError}</p>}
              <button type="submit" className="story-action-btn story-action-btn-submit" disabled={submitting}>
                <Send size={17} />
                {submitting ? 'Submitting...' : 'Submit for review'}
              </button>
            </form>
          )}
        </section>

        <div className="blogs-grid">
          {blogs.length === 0 ? (
            <div className="no-results">
              <p>No stories yet. Be the first to share your adventure!</p>
            </div>
          ) : (
            blogs.map(blog => (
              <div key={blog.id} className="blog-card">
                {blog.image && (
                  <div className="blog-card-image">
                    <img
                      src={blog.image}
                      alt={blog.title}
                      loading="lazy"
                      width="400"
                      height="200"
                    />
                    <span className="blog-category">{blog.category || 'Safari Story'}</span>
                  </div>
                )}
                <div className="blog-card-body">
                  {!blog.image && <span className="blog-category blog-category-inline">{blog.category || 'Safari Story'}</span>}
                  <div className="blog-meta">
                    <span className="blog-author">{blog.author}</span>
                    <span className="blog-location"><MapPin size={14} aria-hidden="true" /> {blog.location}</span>
                  </div>
                  <div className="blog-date" style={{ marginBottom: '10px' }}>{formatDate(blog)}</div>
                  <h3 className="blog-title">{blog.title}</h3>
                  {expandedBlog === blog.id ? (
                    <div className="blog-excerpt blog-paragraphs">
                      {getBlogParagraphs(blog.content).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
                    </div>
                  ) : (
                    <p className="blog-excerpt" style={{ whiteSpace: 'pre-wrap' }}>
                      {`${blog.content?.substring(0, 150)}...`}
                    </p>
                  )}
                  {blog.content?.length > 150 && (
                    <button className="btn-outline-full" onClick={() => setExpandedBlog(expandedBlog === blog.id ? null : blog.id)}>
                      {expandedBlog === blog.id ? 'Show Less' : 'Read More'}
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn-outline-full blog-replies-toggle"
                    onClick={() => toggleComments(blog.id)}
                  >
                    {commentsOpenBlog === blog.id ? 'Close comments' : 'Read or leave a comment'}
                  </button>
                  {commentsOpenBlog === blog.id && (
                    <section className="blog-replies" aria-label={`Comments on ${blog.title}`}>
                      {commentsLoading ? (
                        <p>Loading approved comments...</p>
                      ) : commentsByBlog[blog.id]?.length ? (
                        commentsByBlog[blog.id].map(comment => (
                          <article className="blog-reply" key={comment.id}>
                            <strong>{comment.name}</strong>
                            <p>{comment.content}</p>
                            <small>{formatDate(comment.created_at)}</small>
                          </article>
                        ))
                      ) : (
                        <p>No approved comments yet.</p>
                      )}
                      <form onSubmit={event => submitComment(event, blog.id)} className="blog-reply-form">
                        <h4>Leave a comment</h4>
                        <label>
                          Your name
                          <input
                            value={commentForm.name}
                            onChange={event => setCommentForm(prev => ({ ...prev, name: event.target.value }))}
                            maxLength={120}
                            required
                          />
                        </label>
                        <label>
                          Email (optional, not shown publicly)
                          <input
                            type="email"
                            value={commentForm.email}
                            onChange={event => setCommentForm(prev => ({ ...prev, email: event.target.value }))}
                          />
                        </label>
                        <label>
                          Your comment
                          <textarea
                            value={commentForm.content}
                            onChange={event => setCommentForm(prev => ({ ...prev, content: event.target.value }))}
                            maxLength={5000}
                            rows={4}
                            required
                          />
                        </label>
                        {commentError && <p className="story-submission-feedback error" role="alert">{commentError}</p>}
                        {commentSuccess && <p className="story-submission-feedback success" role="status">{commentSuccess}</p>}
                        <button className="story-action-btn story-action-btn-submit" type="submit" disabled={commentSubmitting}>
                          <Send size={17} />
                          {commentSubmitting ? 'Submitting...' : 'Submit comment for review'}
                        </button>
                      </form>
                    </section>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default PulsePage;
