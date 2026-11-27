import { ArrowRight, CheckCircle, Star } from 'lucide-react';
import DestinationCard from './DestinationCard';

const homeBg = '/images/background.jpg';

function HomeSection({ destinations, testimonials, formatPrice, onSelect, onExploreDestination, onShowReviewForm }) {
  const featuredDestinations = destinations.filter(destination => destination.featured_on_home);
  const displayDestinations = featuredDestinations.length > 0
    ? featuredDestinations
    : destinations.slice(0, 3);
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
        
        <h3 className="section-subtitle">Our Grand Safaris</h3>
        
        {displayDestinations.length === 0 ? (
          <div className="no-results">
            <p>Our destination experiences are being updated. Please check back soon.</p>
          </div>
        ) : (
          <div className="destination-grid destination-grid-home">
            {displayDestinations.map(destination => (
              <DestinationCard
                key={destination.id}
                destination={destination}
                formatPrice={formatPrice}
                onExplore={onExploreDestination}
                compact
              />
            ))}
          </div>
        )}
        <button className="btn-gold btn-large destinations-browse-button" onClick={() => onSelect('destinations')}>
          Browse all destinations <ArrowRight size={18} />
        </button>
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
                    {t?.is_verified && <span className="verified-traveler"><CheckCircle size={14} /> Verified</span>}
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

