import { CheckCircle, Star } from 'lucide-react';
import { formatKes } from '../currency';

const homeBg = '/images/background.jpg';

function HomeSection({ safaris, testimonials, onSelect, onShowReviewForm }) {
  const signatureSafaris = safaris.filter(s => s.isSignature === true);
  const featuredSafaris = safaris.filter(s => s.is_featured || s.isFeatured);
  const displaySafaris = featuredSafaris.length > 0
    ? featuredSafaris.slice(0, 3)
    : signatureSafaris.length > 0 ? signatureSafaris.slice(0, 3) : safaris.slice(0, 3);
  const displayTestimonials = testimonials && testimonials.length > 0 ? testimonials : [];

  return (
    <div className="fade-in">
      <header className="hero hero-home" style={{ backgroundImage: `url(${homeBg})` }}>
        <div className="hero-overlay"></div>
        <div className="hero-content">
          <h1>Embark on an Unforgettable African Safari Adventure</h1>
          <p>Discover the wild heart of Africa with Simba Grand Tours. Experience luxurious lodges, expert guides, and breathtaking wildlife encounters designed just for you.</p>
          <button className="btn-gold btn-large" onClick={() => onSelect('safaris')}>Plan My Safari</button>
        </div>
      </header>

      <section className="container section-padding text-center">
        <h2 className="display-title">Your Journey into the Wild Begins Here</h2>
        <p className="intro-text">At Simba Grand Tours, we believe every safari should be a masterpiece. We craft bespoke adventures that immerse you in the beauty and rich cultures of Africa.</p>
        
        <h3 className="section-subtitle">Our Signature Safari Experiences</h3>
        
        {displaySafaris.length === 0 ? (
          <div className="no-results">
            <p>No safari experiences available at the moment. Please check back soon!</p>
          </div>
        ) : (
          <div className="signature-grid">
            {displaySafaris.map(safari => (
              <div key={safari.id} className="sig-card" onClick={() => onSelect('safaris', safari)}>
                <div className="sig-card-image">
                  <img 
                    src={safari.images?.[0] || safari.image || '/images/simbagrandtours.jpg'} 
                    alt={safari.title}
                    loading="lazy"
                    width="400"
                    height="220"
                  />
                </div>
                <div className="sig-body">
                  <h3>{safari.title}</h3>
                  <div className="sig-meta">
                    <span className="gold-text">{formatKes(safari.price)}</span>
                    <span className="duration">{safari.duration || '7 Days'}</span>
                  </div>
                  <button className="btn-outline-full">Learn More</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <TestimonialsSection testimonials={displayTestimonials} onShowReviewForm={onShowReviewForm} />
    </div>
  );
}

function TestimonialsSection({ testimonials, onShowReviewForm }) {
  return (
    <section className="testimonials-section">
      <div className="container">
        <div className="testimonials-header text-center">
          <h2 className="display-title">What Our Travellers Say</h2>
          <p className="intro-text">Real stories from our valued guests who experienced the magic of Africa with us</p>
        </div>
        <div className="testimonials-grid">
          {testimonials.length === 0 ? (
            <div className="no-results">
              <p>No testimonials available at the moment.</p>
            </div>
          ) : (
            testimonials.map((t) => (
              <div key={t?.id} className="testimonial-card">
                <div className="testimonial-rating">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={16} fill={i < (t?.rating || 5) ? "currentColor" : "none"} />
                  ))}
                </div>
                <p className="testimonial-comment">"{t?.message || 'An amazing experience! The wildlife encounters were breathtaking and the guides were incredibly knowledgeable.'}"</p>
                <div className="testimonial-author">
                  <div className="testimonial-avatar">{t?.full_name?.charAt(0) || t?.fullName?.charAt(0) || 'S'}</div>
                  <div className="testimonial-info">
                    <h4>{t?.full_name || t?.fullName || 'Satisfied Traveler'}</h4>
                    <p>{t?.location || 'Kenya'}</p>
                    {t?.safari && <span className="testimonial-safari">{t.safari}</span>}
                    {t?.is_verified && <span className="verified-traveler"><CheckCircle size={14} /> Verified traveler</span>}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="testimonials-cta text-center">
          <button className="btn-gold btn-large" onClick={onShowReviewForm}>
            <Star size={18} style={{ marginRight: '8px' }} />Share Your Experience
          </button>
        </div>
      </div>
    </section>
  );
}

export default HomeSection;

