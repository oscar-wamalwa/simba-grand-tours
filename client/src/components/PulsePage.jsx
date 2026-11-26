import { MapPin } from 'lucide-react';
import api from '../api';

const PulsePage = () => {
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedBlog, setExpandedBlog] = useState(null);

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
        <div className="blogs-grid">
          {blogs.length === 0 ? (
            <div className="no-results">
              <p>No stories yet. Be the first to share your adventure!</p>
            </div>
          ) : (
            blogs.map(blog => (
              <div key={blog.id} className="blog-card">
                <div className="blog-card-image">
                  <img 
                    src={blog.image || '/images/simbagrandtours.jpg'} 
                    alt={blog.title}
                    loading="lazy"
                    width="400"
                    height="200"
                  />
                  <span className="blog-category">{blog.category || 'Safari Story'}</span>
                </div>
                <div className="blog-card-body">
                  <div className="blog-meta">
                    <span className="blog-author">{blog.author}</span>
                    <span className="blog-location"><MapPin size={14} aria-hidden="true" /> {blog.location}</span>
                  </div>
                  <div className="blog-date" style={{ marginBottom: '10px' }}>{formatDate(blog.createdAt)}</div>
                  <h3 className="blog-title">{blog.title}</h3>
                  <p className="blog-excerpt">
                    {expandedBlog === blog.id ? blog.content : `${blog.content?.substring(0, 150)}...`}
                  </p>
                  {blog.content?.length > 150 && (
                    <button className="btn-outline-full" onClick={() => setExpandedBlog(expandedBlog === blog.id ? null : blog.id)}>
                      {expandedBlog === blog.id ? 'Show Less' : 'Read More'}
                    </button>
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

import { useEffect, useState } from 'react';
