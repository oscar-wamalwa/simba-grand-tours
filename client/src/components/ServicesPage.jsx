import { 
  Mountain, Map, Users, Tent, Coffee, Compass, 
  Landmark, Binoculars, Droplets, User, 
  Backpack, GraduationCap, Sun, Heart
} from 'lucide-react';

const servicesBg = '/images/okavango.jpg';

function ServicesPage() {
  const services = [
    { title: "Hiking and Nature Walks", icon: <Mountain size={32} />, desc: "Explore Africa's breathtaking landscapes on foot." },
    { title: "Road Trips and Getaways", icon: <Map size={32} />, desc: "Scenic drives across East Africa." },
    { title: "Team Building Activities", icon: <Users size={32} />, desc: "Corporate retreats with wildlife experiences." },
    { title: "Camping Expeditions", icon: <Tent size={32} />, desc: "Authentic wilderness camping under the stars." },
    { title: "Retreats", icon: <Coffee size={32} />, desc: "Wellness retreats in serene natural settings." },
    { title: "Adventure Challenges", icon: <Compass size={32} />, desc: "Thrilling expeditions and extreme adventures." },
    { title: "Cultural Tours", icon: <Landmark size={32} />, desc: "Immerse in local traditions and cultures." },
    { title: "Wildlife and Game Drives", icon: <Binoculars size={32} />, desc: "Expert-guided wildlife encounters." },
    { title: "Water Adventures", icon: <Droplets size={32} />, desc: "Kayaking, boat safaris and water activities." },
    { title: "Guided Tours", icon: <Backpack size={32} />, desc: "Comprehensive guided experiences." },
    { title: "Solo Traveller Support", icon: <User size={32} />, desc: "Safe adventures for independent travelers." },
    { title: "Corporate Excursions", icon: <GraduationCap size={32} />, desc: "Educational trips for groups." },
    { title: "Holiday Packages", icon: <Sun size={32} />, desc: "All-inclusive holiday combinations." },
    { title: "Romantic Trips", icon: <Heart size={32} />, desc: "Specialized itineraries for couples." },
  ];

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
        <div className="services-grid">
          {services.map((s, i) => (
            <div key={i} className="service-card">
              <div className="service-icon">{s.icon}</div>
              <h3 className="service-title">{s.title}</h3>
              <p className="service-description">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ServicesPage;

