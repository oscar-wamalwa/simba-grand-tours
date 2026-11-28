import { Settings, Clock, Award, Shield, Heart, BedDouble, MessageCircle } from 'lucide-react';

const aboutBg = '/images/diani.jpg';

function AboutPage({ onNavigate }) {
  const features = [
    { icon: <Settings size={28} />, title: "Tailored Itineraries", desc: "Hand-crafted trips, private or group, planned around your pace and interests." },
    { icon: <Clock size={28} />, title: "Dependable Support", desc: "Our team is on hand Monday to Saturday, from planning to the day you return." },
    { icon: <Award size={28} />, title: "Expert Local Guides", desc: "Knowledgeable, certified guides who know the land and its wildlife." },
    { icon: <Shield size={28} />, title: "Safe Travel", desc: "Well-maintained 4x4 vehicles, experienced drivers and comprehensive insurance." },
    { icon: <BedDouble size={28} />, title: "Trusted Accommodation", desc: "Carefully chosen lodges, camps and hotels that are comfortable, clean and welcoming." },
    { icon: <MessageCircle size={28} />, title: "Easy Booking", desc: "Reserve by phone call, WhatsApp or our contact form, with clear communication throughout." }
  ];

  return (
    <div className="about-page fade-in">
      <header className="hero hero-about" style={{ backgroundImage: `url(${aboutBg})` }}>
        <div className="hero-overlay"></div>
        <div className="hero-content">
          <h1>Beyond the Horizon, Beside the Wild</h1>
          <p>We don't just show you Africa; we help you find your place within it.</p>
        </div>
      </header>

      <section className="about-section">
        <div className="container">
          <div className="about-header">
            <h2>A Legacy Written in the Dust and Sky</h2>
          </div>
          <div className="about-content">
            <p className="about-lead">Our story is written in the dust of the savanna and the golden light of the East African sky. Born from a lifelong love for the wild, Simba Grand Tours was established in Nairobi to prove that a journey should be more than a gallery of photos, but should be a change of soul.</p>
          </div>
        </div>
      </section>

      <section className="about-section philosophy-section">
        <div className="container">
          <div className="about-header">
            <h2>The Wild, Refined</h2>
          </div>
          <div className="philosophy-grid">
            <div className="philosophy-card">
              <div className="philosophy-icon"><Award size={40} /></div>
              <h3>Roughing it in Luxury</h3>
              <p>Experience the raw adrenaline of a game drive followed by world-class lodge comfort.</p>
            </div>
            <div className="philosophy-card">
              <div className="philosophy-icon"><Heart size={40} /></div>
              <h3>Sustainability First</h3>
              <p>We partner with conservancies that prioritize anti-poaching and eco-friendly tourism.</p>
            </div>
            <div className="philosophy-card">
              <div className="philosophy-icon"><Users size={40} /></div>
              <h3>Local Soul</h3>
              <p>Our guides are storytellers born and raised on this land.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="about-section">
        <div className="container">
          <div className="about-header">
            <h2>Why Choose Us?</h2>
          </div>
          <div className="features-grid">
            {features.map((f, i) => (
              <div key={i} className="feature-card">
                <div className="feature-icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="about-cta">
        <div className="container">
          <div className="about-cta-content">
            <h2>Your Seat in the Land Cruiser is Waiting</h2>
            <p>The migration is moving. The sun is setting over the Mara. All that's missing is you.</p>
            <button className="btn-gold btn-large" onClick={() => onNavigate('safaris')}>Start Your Journey</button>
          </div>
        </div>
      </section>
    </div>
  );
}

// Additional icons needed
const Users = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
    <circle cx="9" cy="7" r="4"></circle>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
  </svg>
);

export default AboutPage;

