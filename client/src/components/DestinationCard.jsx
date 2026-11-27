import { ArrowRight, Check, Clock3, MapPin } from 'lucide-react';
import { formatKes } from '../currency';

export default function DestinationCard({ destination, onExplore, compact = false }) {
  const startingPrice = Number(destination.starting_price);

  return (
    <article className={`destination-card${compact ? ' destination-card-compact' : ''}`}>
      <div className="destination-card-image">
        {destination.images?.[0] ? (
          <img
            src={destination.images[0]}
            alt={destination.name}
            loading="lazy"
          />
        ) : (
          <div className="destination-photo-placeholder">
            <MapPin size={30} aria-hidden="true" />
            <span>Photo coming soon</span>
          </div>
        )}
        {destination.badge && <span className="destination-badge">{destination.badge}</span>}
        {destination.duration && (
          <span className="destination-duration"><Clock3 size={14} />{destination.duration}</span>
        )}
      </div>
      <div className="destination-card-body">
        <h3>{destination.name}</h3>
        <p className="destination-hook">{destination.hook}</p>
        {destination.highlights?.length > 0 && (
          <ul className="destination-highlights">
            {destination.highlights.slice(0, 3).map((highlight, index) => (
              <li key={`${destination.id}-${index}`}><Check size={16} />{highlight}</li>
            ))}
          </ul>
        )}
        <div className="destination-card-footer">
          <div className="destination-price">
            <span>Starting From</span>
            <strong>{startingPrice > 0 ? formatKes(startingPrice) : 'Price on request'}</strong>
          </div>
          <button type="button" className="destination-cta" onClick={() => onExplore(destination)}>
            {destination.cta_label || `Explore ${destination.name}`}
            <ArrowRight size={17} />
          </button>
        </div>
      </div>
    </article>
  );
}
