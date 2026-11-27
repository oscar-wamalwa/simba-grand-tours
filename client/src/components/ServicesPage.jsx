import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Mountain, Map, Users, Tent, Coffee, Compass, Landmark, Binoculars, Droplets,
  User, Backpack, GraduationCap, Sun, Heart, ArrowRight, MessageCircle, X,
} from 'lucide-react';

const servicesBg = '/images/okavango.jpg';

function ServicesPage({ onNavigate, onRequestCustomSafari }) {
  const [selectedService, setSelectedService] = useState(null);
  const services = [
    {
      title: 'Hiking and Nature Walks',
      icon: <Mountain size={32} />,
      desc: "Explore Africa's breathtaking landscapes on foot.",
      description: 'Explore walking trails with a knowledgeable guide, at a pace suited to your group. Trips can include scenic viewpoints and introductions to local plants and wildlife. We confirm route difficulty and safety details with you before your walk.',
    },
    {
      title: 'Road Trips and Getaways',
      icon: <Map size={32} />,
      desc: 'Scenic drives across East Africa.',
      description: 'Plan a scenic journey with transport, overnight stops and places of interest arranged around your available time. We can help shape the route and recommend stops that suit your group and travel style.',
    },
    {
      title: 'Team Building Activities',
      icon: <Users size={32} />,
      desc: 'Corporate retreats with wildlife experiences.',
      description: 'Bring your team together with outdoor activities, shared challenges and optional safari experiences. We tailor the itinerary to your group size, goals, schedule and accessibility needs.',
    },
    {
      title: 'Camping Expeditions',
      icon: <Tent size={32} />,
      desc: 'Authentic wilderness camping under the stars.',
      description: 'Spend time outdoors at selected campsites or wilderness locations, with the travel plan and practical arrangements discussed in advance. Camp options depend on the destination, availability and local safety requirements.',
    },
    {
      title: 'Retreats',
      icon: <Coffee size={32} />,
      desc: 'Wellness retreats in serene natural settings.',
      description: 'Take time to reset with a nature-based getaway that can combine a peaceful stay, gentle walks and optional activities. We can help you choose a setting and schedule that fit your group.',
    },
    {
      title: 'Adventure Challenges',
      icon: <Compass size={32} />,
      desc: 'Thrilling expeditions and extreme adventures.',
      description: 'Choose an active itinerary with hikes, challenging terrain or other outdoor activities. We discuss experience levels, route conditions and preparation so the plan is appropriate for your group.',
    },
    {
      title: 'Cultural Tours',
      icon: <Landmark size={32} />,
      desc: 'Immerse in local traditions and cultures.',
      description: 'Learn about local heritage, food, crafts and traditions through respectful visits and, where available, local guides. Experiences are planned with consideration for host communities and their availability.',
    },
    {
      title: 'Wildlife and Game Drives',
      icon: <Binoculars size={32} />,
      desc: 'Expert-guided wildlife encounters.',
      description: 'Explore parks and reserves on guided game drives, with routes and timing planned around your destination and travel dates. Wildlife sightings vary with nature and cannot be guaranteed.',
    },
    {
      title: 'Water Adventures',
      icon: <Droplets size={32} />,
      desc: 'Kayaking, boat safaris and water activities.',
      description: 'Add a boat excursion, kayaking or another water activity where it is available. The final plan depends on destination, weather, water conditions and the safety requirements of local operators.',
    },
    {
      title: 'Guided Tours',
      icon: <Backpack size={32} />,
      desc: 'Comprehensive guided experiences.',
      description: 'Have a guide help you explore attractions and local highlights, with transport and timing coordinated for your itinerary. Tell us what interests you and we can suggest a suitable plan.',
    },
    {
      title: 'Solo Traveller Support',
      icon: <User size={32} />,
      desc: 'Safe adventures for independent travelers.',
      description: 'Get help planning an independent trip, including itinerary options and travel logistics. Depending on your destination and dates, we can discuss joining a group or arranging a private experience.',
    },
    {
      title: 'Corporate Excursions',
      icon: <GraduationCap size={32} />,
      desc: 'Educational trips for groups.',
      description: 'Arrange a company outing or educational excursion with activities and logistics planned around your group size, schedule and objectives. Accommodation and transport options can be discussed as part of your request.',
    },
    {
      title: 'Holiday Packages',
      icon: <Sun size={32} />,
      desc: 'All-inclusive holiday combinations.',
      description: 'Combine accommodation, transport, safari experiences and other activities in one itinerary. We can adjust the trip length and options around your dates, interests and budget.',
    },
    {
      title: 'Romantic Trips',
      icon: <Heart size={32} />,
      desc: 'Specialized itineraries for couples.',
      description: 'Plan a getaway for two with a stay and activities selected around your occasion and preferred pace. Private experiences and special arrangements depend on destination and availability.',
    },
  ];

  const requestCustomSafari = () => {
    setSelectedService(null);
    onRequestCustomSafari();
  };

  const askAboutService = () => {
    setSelectedService(null);
    onNavigate('contact');
  };

  return (
    <div className="services-page fade-in">
      <header className="hero hero-services" style={{ backgroundImage: `url(${servicesBg})` }}>
        <div className="hero-overlay"></div>
        <div className="hero-content">
          <h1>Our Premier Services</h1>
          <p>Discover tailored experiences that don't just show you the world, but change how you see it.</p>
        </div>
      </header>

      <div className="container section-padding">
        <p className="services-intro">Select a service to learn what it includes and choose how to plan your trip.</p>
        <div className="services-grid">
          {services.map(service => (
            <button
              key={service.title}
              type="button"
              className="service-card"
              onClick={() => setSelectedService(service)}
              aria-haspopup="dialog"
              aria-label={`View details for ${service.title}`}
            >
              <span className="service-icon" aria-hidden="true">{service.icon}</span>
              <span className="service-title" role="heading" aria-level="2">{service.title}</span>
              <span className="service-description">{service.desc}</span>
              <span className="service-card-cue">View details <ArrowRight size={15} aria-hidden="true" /></span>
            </button>
          ))}
        </div>
      </div>

      {selectedService && createPortal(
        <div className="service-detail-overlay" onClick={() => setSelectedService(null)}>
          <section
            className="service-detail-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="service-detail-title"
            onClick={event => event.stopPropagation()}
          >
            <button
              type="button"
              className="service-detail-close"
              onClick={() => setSelectedService(null)}
              aria-label="Close service details"
            >
              <X size={22} />
            </button>
            <div className="service-detail-icon" aria-hidden="true">{selectedService.icon}</div>
            <p className="gold-text">Our services</p>
            <h2 id="service-detail-title">{selectedService.title}</h2>
            <p className="service-detail-description">{selectedService.description}</p>
            <div className="service-detail-actions">
              <button type="button" className="btn-gold btn-large" onClick={requestCustomSafari}>
                Request custom safari
              </button>
              <button type="button" className="service-inquiry-btn" onClick={askAboutService}>
                <MessageCircle size={18} aria-hidden="true" /> Make an inquiry
              </button>
            </div>
          </section>
        </div>,
        document.body
      )}
    </div>
  );
}

export default ServicesPage;
