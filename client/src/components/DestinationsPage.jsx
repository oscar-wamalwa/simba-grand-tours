import DestinationCard from './DestinationCard';

const categoryOrder = [
  ['iconic_safaris', 'Iconic Safaris'],
  ['beach_coastal_escapes', 'Beach and Coastal Escapes'],
  ['rift_valley_weekenders', 'Rift Valley Weekenders'],
  ['hidden_gems_road_trips', 'Hidden Gems and Road Trips'],
];

export default function DestinationsPage({ destinations, onExplore }) {
  return (
    <main className="destinations-page fade-in">
      <header className="destinations-hero" style={{ backgroundImage: "url('/images/lakenakuru.jpg')" }}>
        <div className="destinations-hero-overlay" />
        <div className="destinations-hero-content">
          <p className="gold-text">Discover Kenya</p>
          <h1>Find Your Grand Escape</h1>
          <p>From iconic wildlife encounters to quiet coastal hideaways, choose the journey that feels like yours.</p>
        </div>
      </header>

      <div className="container destinations-content">
        {categoryOrder.map(([category, label]) => {
          const categoryDestinations = destinations.filter(destination => destination.category === category);
          if (!categoryDestinations.length) return null;

          return (
            <section className="destination-category" key={category}>
              <div className="destination-category-heading">
                <p className="gold-text">Explore by experience</p>
                <h2>{label}</h2>
              </div>
              <div className="destination-grid">
                {categoryDestinations.map(destination => (
                  <DestinationCard
                    key={destination.id}
                    destination={destination}
                    onExplore={onExplore}
                  />
                ))}
              </div>
            </section>
          );
        })}
        {destinations.length === 0 && (
          <div className="no-results">
            <p>Our destinations are being updated. Please check back soon.</p>
          </div>
        )}
      </div>
    </main>
  );
}
