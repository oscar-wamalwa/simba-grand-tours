import { ArrowLeft, CheckCircle, MapPin, Star } from 'lucide-react';

const safarisBg = '/images/greatmigration.jpg';

function SafarisPage({ safaris, onSelect, selectedSafari }) {
  const [filters, setFilters] = useState({
    destinations: [],
    priceRange: 10000
  });

  const handleDestinationChange = (destination) => {
    setFilters(prev => ({
      ...prev,
      destinations: prev.destinations.includes(destination)
        ? prev.destinations.filter(d => d !== destination)
        : [...prev.destinations, destination]
    }));
  };

  const handlePriceChange = (e) => {
    setFilters(prev => ({
      ...prev,
      priceRange: parseInt(e.target.value)
    }));
  };

  const clearFilters = () => {
    setFilters({ destinations: [], priceRange: 10000 });
  };

  if (selectedSafari) {
    const safariImage = selectedSafari.images?.[0] || selectedSafari.image || '/images/simbagrandtours.jpg';
    const inclusions = selectedSafari.inclusions || [
      'Experienced professional guide',
      'Park entry fees',
      'Comfortable safari transport',
      'Meals and bottled drinking water'
    ];
    const exclusions = selectedSafari.exclusions || [];
    const itinerary = selectedSafari.itinerary || [];
    const highlights = selectedSafari.highlights || [];

    return (
      <div className="safaris-page fade-in">
        <div className="container section-padding">
          <button className="btn-outline-full safari-back" onClick={() => onSelect('safaris')}>
            <ArrowLeft size={18} /> Back to all safaris
          </button>
          <article className="safari-detail">
            <div className="safari-detail-image">
              <img src={safariImage} alt={selectedSafari.title} />
            </div>
            <div className="safari-detail-body">
              <p className="gold-text">{selectedSafari.location || 'Africa'}</p>
              <h1>{selectedSafari.title}</h1>
              <div className="sig-meta">
                <span className="gold-text">${selectedSafari.price?.toLocaleString()}</span>
                <span className="duration">{selectedSafari.duration || '7 Days'}</span>
              </div>
              <p>{selectedSafari.description || 'A carefully designed safari experience with exceptional wildlife encounters and comfortable, memorable stays.'}</p>
              {highlights.length > 0 && (
                <>
                  <h3>Trip highlights</h3>
                  <ul className="detail-inclusions">
                    {highlights.map((item) => <li key={item}><CheckCircle size={18} /> {item}</li>)}
                  </ul>
                </>
              )}
              {itinerary.length > 0 && (
                <>
                  <h3>Itinerary</h3>
                  <ol className="detail-itinerary">
                    {itinerary.map((item) => <li key={item}>{item}</li>)}
                  </ol>
                </>
              )}
              <h3>What's included</h3>
              <ul className="detail-inclusions">
                {inclusions.map((item) => (
                  <li key={item}><CheckCircle size={18} /> {item}</li>
                ))}
              </ul>
              {exclusions.length > 0 && (
                <>
                  <h3>What's excluded</h3>
                  <ul className="detail-inclusions">
                    {exclusions.map((item) => <li key={item}><CheckCircle size={18} /> {item}</li>)}
                  </ul>
                </>
              )}
              <button className="btn-gold btn-large" onClick={() => onSelect('contact')}>
                <MapPin size={18} /> Inquire about this safari
              </button>
            </div>
          </article>
        </div>
      </div>
    );
  }

  const sortedSafaris = [...safaris].sort((a, b) => {
    if (a.isSignature === b.isSignature) return 0;
    return a.isSignature ? -1 : 1;
  });

  const filteredSafaris = sortedSafaris.filter(safari => {
    const matchesDestination = filters.destinations.length === 0 || 
      filters.destinations.some(d => safari.location?.includes(d));
    const matchesPrice = (safari.price || 0) <= filters.priceRange;
    return matchesDestination && matchesPrice;
  });

  return (
    <div className="safaris-page fade-in">
      <header className="safaris-hero" style={{ backgroundImage: `url(${safarisBg})` }}>
        <div className="safaris-hero-overlay"></div>
        <div className="hero-content">
          <h1>Discover Africa's Premier Safari Experiences</h1>
          <p>From the endless plains of the Serengeti to the waterways of the Okavango Delta, our carefully curated safari tours offer unforgettable wildlife encounters tailored to your dreams.</p>
        </div>
      </header>

      <div className="container listing-layout section-padding">
        <aside className="sidebar">
          <h3>Filter Tours</h3>
          <div className="filter-group">
            <label className="filter-label">Destinations</label>
            {['Serengeti', 'Okavango', 'Amboseli', 'Masai Mara', 'Ngorongoro'].map(d => (
              <div key={d} className="check-item">
                <input 
                  type="checkbox" 
                  id={d.toLowerCase().replace(' ', '-')} 
                  checked={filters.destinations.includes(d)} 
                  onChange={() => handleDestinationChange(d)} 
                />
                <label htmlFor={d.toLowerCase().replace(' ', '-')}>{d}</label>
              </div>
            ))}
          </div>
          <div className="filter-group">
            <label className="filter-label">Max Price: ${filters.priceRange.toLocaleString()}</label>
            <input 
              type="range" 
              className="range-slider" 
              min="1000" 
              max="10000" 
              step="500" 
              value={filters.priceRange} 
              onChange={handlePriceChange} 
            />
            <div className="range-labels"><span>$1,000</span><span>$10,000</span></div>
          </div>
          <button className="btn-gold-full">Apply Filters</button>
          <button className="btn-outline-full btn-clear" onClick={clearFilters}>Clear Filters</button>
        </aside>

        <main className="listing-grid-main">
          <div className="listings-header">
            <h2 className="section-title">Our Premier Safari Tours</h2>
            <span className="results-count">{filteredSafaris.length} tours found</span>
          </div>
          
          {filteredSafaris.length === 0 ? (
            <div className="no-results"><p>No safaris match your filters.</p></div>
          ) : (
            <div className="grid">
              {filteredSafaris.map(safari => (
                <div key={safari.id} className="card" onClick={() => onSelect('details', safari)}>
                  <div className="card-image">
                    <img 
                      src={safari.images?.[0] || safari.image || '/images/simbagrandtours.jpg'} 
                      alt={safari.title}
                      loading="lazy"
                      width="400"
                      height="200"
                    />
                    {safari.isSignature && (
                      <span className="card-badge signature">
                        <Star size={12} /> Signature
                      </span>
                    )}
                    <span className="card-badge">
                      {safari.difficulty || 'Moderate'} • {safari.duration || '7 Days'}
                    </span>
                  </div>
                  <div className="card-body">
                    <h3>{safari.title}</h3>
                    <p className="location"><MapPin size={15} aria-hidden="true" /> {safari.location || 'Africa'}</p>
                    <div className="card-footer">
                      <span className="price">${safari.price?.toLocaleString()}</span>
                      <button className="btn-gold-sm">View Details</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default SafarisPage;

import { useState } from 'react';
