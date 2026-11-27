import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle, MapPin, Star, CalendarDays, Users, PackageCheck, Clock, RotateCcw } from 'lucide-react';
import api from '../api';
import { formatKes } from '../currency';

const safarisBg = '/images/greatmigration.jpg';
const bookingsEnabled = import.meta.env.VITE_BOOKINGS_ENABLED !== 'false';

function SafarisPage({ safaris, onSelect, selectedSafari, packageFilterIds = [] }) {
  const maxPrice = Math.max(800000, ...safaris.map(safari => Number(safari.price) || 0));
  const [filters, setFilters] = useState({
    destination: '',
    tripType: '',
    duration: '',
    tripMode: '',
    priceRange: maxPrice,
  });
  const [departures, setDepartures] = useState([]);
  const [departuresError, setDeparturesError] = useState('');
  const [selectedDepartureId, setSelectedDepartureId] = useState('');
  const [bookingForm, setBookingForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    payment_phone: '',
    participant_count: 1,
    promo_code: '',
    passengers: [{ full_name: '' }],
  });
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [bookingResult, setBookingResult] = useState(null);
  const [bookingStatus, setBookingStatus] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [waitlistMessage, setWaitlistMessage] = useState('');
  const [waitlistDepartureId, setWaitlistDepartureId] = useState('');
  const [waitlistForm, setWaitlistForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    participant_count: 1,
  });
  const [customTripForm, setCustomTripForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    destination: '',
    trip_mode: 'group',
    preferred_date: '',
    participant_count: 1,
    details: '',
  });
  const [customTripMessage, setCustomTripMessage] = useState('');
  const [customTripError, setCustomTripError] = useState('');
  const [customTripSubmitting, setCustomTripSubmitting] = useState(false);
  const selectedSafariId = selectedSafari?.id;

  useEffect(() => {
    if (!selectedSafariId) return undefined;
    let active = true;
    setDepartures([]);
    setSelectedDepartureId('');
    setDeparturesError('');
    setTermsAccepted(false);
    const refreshDepartures = () => api.departures.getForSafari(selectedSafariId)
      .then(data => {
        if (active) {
          setDepartures(data);
          setDeparturesError('');
        }
      })
      .catch(error => {
        if (active) {
          console.error('Could not load trip departures:', error);
          setDeparturesError('Departure availability is temporarily unavailable. Please contact us to book.');
        }
      });
    refreshDepartures();
    const refreshTimer = window.setInterval(refreshDepartures, 30000);
    return () => {
      active = false;
      window.clearInterval(refreshTimer);
    };
  }, [selectedSafariId]);

  useEffect(() => {
    if (!bookingResult?.reference || bookingStatus === 'confirmed' || bookingStatus === 'payment_failed') return undefined;
    let active = true;
    const pollStatus = async () => {
      try {
        const statusResult = await api.bookings.getStatus(bookingResult.reference);
        if (active) setBookingStatus(statusResult.status);
      } catch (error) {
        console.error('Could not check booking payment status:', error);
      }
    };
    const timer = window.setInterval(pollStatus, 5000);
    pollStatus();
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [bookingResult?.reference, bookingStatus]);

  const handlePriceChange = (event) => {
    setFilters(prev => ({ ...prev, priceRange: Number(event.target.value) }));
  };

  const clearFilters = () => setFilters({
    destination: '',
    tripType: '',
    duration: '',
    tripMode: '',
    priceRange: maxPrice,
  });

  const handleParticipantCount = (value) => {
    const count = Math.max(1, Math.min(20, Number(value) || 1));
    setBookingForm(prev => ({
      ...prev,
      participant_count: count,
      passengers: Array.from({ length: count }, (_, index) => prev.passengers[index] || { full_name: '' }),
    }));
  };

  const handleBooking = async (event) => {
    event.preventDefault();
    setBookingSubmitting(true);
    setBookingError('');
    try {
      const result = await api.bookings.create({
        ...bookingForm,
        departure: Number(selectedDepartureId),
        terms_accepted: termsAccepted,
      });
      setBookingResult(result);
      setBookingStatus(result.status);
    } catch (error) {
      setBookingError(error.message || 'Could not start your booking. Please try again.');
    } finally {
      setBookingSubmitting(false);
    }
  };

  const handleWaitlist = async (event, departureId) => {
    event.preventDefault();
    setBookingError('');
    setWaitlistMessage('');
    try {
      await api.waitlist.create({
        departure: departureId,
        ...waitlistForm,
        participant_count: Number(waitlistForm.participant_count),
      });
      setWaitlistMessage('You are on the waitlist. We will contact you if spots open.');
      setWaitlistDepartureId('');
    } catch (error) {
      setBookingError(error.message || 'Could not join the waitlist.');
    }
  };

  const handleCustomTripInquiry = async (event) => {
    event.preventDefault();
    setCustomTripError('');
    setCustomTripMessage('');
    setCustomTripSubmitting(true);
    try {
      await api.messages.create({
        full_name: customTripForm.full_name,
        email: customTripForm.email,
        phone: customTripForm.phone,
        subject: 'Custom group or private trip inquiry',
        message: [
          `Destination: ${customTripForm.destination}`,
          `Trip style: ${customTripForm.trip_mode}`,
          `Preferred date: ${customTripForm.preferred_date || 'Flexible'}`,
          `Travelers: ${customTripForm.participant_count}`,
          `Details: ${customTripForm.details}`,
        ].join('\n'),
      });
      setCustomTripForm({
        full_name: '',
        email: '',
        phone: '',
        destination: '',
        trip_mode: 'group',
        preferred_date: '',
        participant_count: 1,
        details: '',
      });
      setCustomTripMessage('Your trip inquiry has been sent. Our team will be in touch.');
    } catch (error) {
      setCustomTripError(error.message || 'Could not send your inquiry. Please try again.');
    } finally {
      setCustomTripSubmitting(false);
    }
  };

  if (selectedSafari) {
    const safariImage = selectedSafari.images?.[0] || selectedSafari.image || '/images/simbagrandtours.jpg';
    const selectedDeparture = departures.find(departure => String(departure.id) === selectedDepartureId);
    const participantCount = Number(bookingForm.participant_count) || 1;
    const fullAmount = (Number(selectedDeparture?.price_kes) || 0) * participantCount;
    const bookingFee = Number(selectedDeparture?.booking_fee_kes) || 0;
    const balanceBeforePromo = Math.max(0, fullAmount - bookingFee);
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
                <span className="gold-text">From {formatKes(selectedSafari.price)} per person</span>
                <span>{selectedSafari.booking_fee_kes
                  ? `Booking fee ${formatKes(selectedSafari.booking_fee_kes)} per reservation`
                  : 'Booking fee not set'}
                </span>
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
                    {itinerary.map((item, index) => (
                      <li key={`${item.day || 'day'}-${index}`}>
                        {typeof item === 'string'
                          ? item
                          : <><strong>{item.day || `Day ${index + 1}`}</strong>{item.title ? ` - ${item.title}` : ''}{item.description ? `: ${item.description}` : ''}</>}
                      </li>
                    ))}
                  </ol>
                </>
              )}
              {selectedSafari.pickup_points?.length > 0 && (
                <>
                  <h3>Pickup points and times</h3>
                  <ul className="detail-inclusions">
                    {selectedSafari.pickup_points.map((point, index) => (
                      <li key={`${point.name || point}-${index}`}>
                        <MapPin size={18} />
                        {typeof point === 'string' ? point : `${point.name}${point.time ? ` - ${point.time}` : ''}`}
                      </li>
                    ))}
                  </ul>
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
              {selectedSafari.packing_checklist?.length > 0 && (
                <>
                  <h3>What to pack</h3>
                  <ul className="detail-inclusions">
                    {selectedSafari.packing_checklist.map(item => (
                      <li key={item}><PackageCheck size={18} /> {item}</li>
                    ))}
                  </ul>
                </>
              )}
              <section className="departure-booking" hidden={!bookingsEnabled}>
                <h3><CalendarDays size={20} /> Upcoming departures</h3>
                {selectedSafari.booking_terms && (
                  <aside className="booking-terms-notice">
                    <h4>Booking Terms / Notes</h4>
                    <p>{selectedSafari.booking_terms}</p>
                  </aside>
                )}
                {departuresError && <p role="alert">{departuresError}</p>}
                {!departuresError && departures.length === 0 && (
                  <p>No scheduled departures are available yet. Contact us for a custom trip.</p>
                )}
                {departures.map(departure => (
                  <div key={departure.id}>
                    <article className="departure-option">
                      <div>
                        <strong>{new Date(`${departure.start_date}T00:00:00`).toLocaleDateString('en-KE', { dateStyle: 'medium' })}</strong>
                        <span>Full amount: {formatKes(departure.price_kes)} per person</span>
                        <span>{departure.booking_fee_kes
                          ? `Booking fee: ${formatKes(departure.booking_fee_kes)} per reservation`
                          : 'Booking fee not configured'}
                        </span>
                        <span><Users size={15} /> {departure.seats_available} spots left</span>
                        {departure.pickup_time && <span><Clock size={15} /> Pickup: {departure.pickup_time}</span>}
                      </div>
                      {departure.seats_available > 0 ? (
                        <button
                          type="button"
                          className="btn-gold-sm"
                          disabled={!departure.booking_fee_kes}
                          onClick={() => {
                            setSelectedDepartureId(String(departure.id));
                            setTermsAccepted(false);
                            setBookingResult(null);
                            setBookingStatus('');
                          }}
                        >
                          {departure.booking_fee_kes
                            ? selectedDepartureId === String(departure.id) ? 'Selected' : 'Book'
                            : 'Booking fee not set'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn-outline-full"
                          onClick={() => {
                            setWaitlistDepartureId(String(departure.id));
                            setBookingError('');
                            setWaitlistMessage('');
                          }}
                        >
                          Join waitlist
                        </button>
                      )}
                    </article>
                    {waitlistDepartureId === String(departure.id) && departure.seats_available <= 0 && (
                      <form className="booking-form waitlist-form" onSubmit={event => handleWaitlist(event, departure.id)}>
                        <h4>Join the waitlist</h4>
                        <label>Full name<input required value={waitlistForm.full_name} onChange={event => setWaitlistForm(prev => ({ ...prev, full_name: event.target.value }))} /></label>
                        <label>Email<input type="email" required value={waitlistForm.email} onChange={event => setWaitlistForm(prev => ({ ...prev, email: event.target.value }))} /></label>
                        <label>Phone<input type="tel" required value={waitlistForm.phone} onChange={event => setWaitlistForm(prev => ({ ...prev, phone: event.target.value }))} placeholder="07XX XXX XXX" /></label>
                        <label>Number of travelers<input type="number" min="1" max="20" required value={waitlistForm.participant_count} onChange={event => setWaitlistForm(prev => ({ ...prev, participant_count: event.target.value }))} /></label>
                        {bookingError && <p className="form-status error" role="alert">{bookingError}</p>}
                        <button className="btn-gold btn-large" type="submit">Join waitlist</button>
                      </form>
                    )}
                  </div>
                ))}
                {waitlistMessage && <p className="form-status success" role="status">{waitlistMessage}</p>}
                {selectedDepartureId && !bookingResult && (
                  <form className="booking-form" onSubmit={handleBooking}>
                    <h4>Traveler and payment details</h4>
                    <label>Full name<input required value={bookingForm.full_name} onChange={event => setBookingForm(prev => ({ ...prev, full_name: event.target.value }))} /></label>
                    <label>Email<input type="email" required value={bookingForm.email} onChange={event => setBookingForm(prev => ({ ...prev, email: event.target.value }))} /></label>
                    <label>Contact phone<input type="tel" required value={bookingForm.phone} onChange={event => setBookingForm(prev => ({ ...prev, phone: event.target.value }))} placeholder="07XX XXX XXX" /></label>
                    <label>M-Pesa phone<input type="tel" required value={bookingForm.payment_phone} onChange={event => setBookingForm(prev => ({ ...prev, payment_phone: event.target.value }))} placeholder="07XX XXX XXX" /></label>
                    <label>Number of travelers<input type="number" min="1" max="20" required value={bookingForm.participant_count} onChange={event => handleParticipantCount(event.target.value)} /></label>
                    {bookingForm.passengers.map((passenger, index) => (
                      <label key={index}>Traveler {index + 1} name
                        <input
                          required
                          value={passenger.full_name}
                          onChange={event => setBookingForm(prev => ({
                            ...prev,
                            passengers: prev.passengers.map((item, passengerIndex) => passengerIndex === index
                              ? { ...item, full_name: event.target.value }
                              : item),
                          }))}
                        />
                      </label>
                    ))}
                    <label>Promo code (optional)<input value={bookingForm.promo_code} onChange={event => setBookingForm(prev => ({ ...prev, promo_code: event.target.value }))} /></label>
                    <div className="booking-summary">
                      <h4>Booking summary</h4>
                      <div><span>Full amount ({participantCount} traveler{participantCount === 1 ? '' : 's'})</span><strong>{formatKes(fullAmount)}</strong></div>
                      <div><span>Booking fee due now</span><strong>{formatKes(bookingFee)}</strong></div>
                      <div><span>Remaining balance before promo</span><strong>{formatKes(balanceBeforePromo)}</strong></div>
                      <p>Valid promo codes reduce the full amount. Your booking fee stays fixed; the adjusted balance is shown after checkout validation.</p>
                      {bookingFee > fullAmount && <p className="form-status error" role="alert">The booking fee is greater than the full trip amount. Please contact us.</p>}
                    </div>
                    {selectedSafari.booking_terms && (
                      <label className="booking-terms-accept">
                        <input
                          type="checkbox"
                          required
                          checked={termsAccepted}
                          onChange={event => setTermsAccepted(event.target.checked)}
                        />
                        I have read and agree to the booking terms above.
                      </label>
                    )}
                    {bookingError && <p className="form-status error" role="alert">{bookingError}</p>}
                    <button className="btn-gold btn-large" type="submit" disabled={bookingSubmitting || !bookingFee || bookingFee > fullAmount}>
                      {bookingSubmitting ? 'Starting M-Pesa...' : 'Reserve and pay booking fee'}
                    </button>
                    <p className="booking-note">Your selected spots are held for 10 minutes while you pay the booking fee.</p>
                  </form>
                )}
                {bookingResult && (
                  <div className="booking-confirmation" role="status">
                    <h4>Booking reference: {bookingResult.reference}</h4>
                    <p>Full amount: {formatKes(bookingResult.full_amount_kes)}</p>
                    {bookingResult.discount_kes > 0 && <p>Promo discount: −{formatKes(bookingResult.discount_kes)}</p>}
                    <p>Booking fee due now: {formatKes(bookingResult.booking_fee_kes)}</p>
                    <p>Remaining balance: {formatKes(bookingResult.balance_due_kes)}</p>
                    <p>{bookingStatus === 'confirmed'
                      ? 'Booking fee received. Your slot is reserved; pay the remaining balance before departure.'
                      : bookingStatus === 'payment_failed'
                        ? 'Payment was not completed. Please start a new booking.'
                        : bookingResult.message || `Complete the ${formatKes(bookingResult.booking_fee_kes)} booking-fee payment prompt. Checking status...`}
                    </p>
                  </div>
                )}
              </section>
              <button className="btn-gold btn-large" onClick={() => onSelect('contact')}>
                <MapPin size={18} /> Inquire about this safari
              </button>
              {selectedSafari.images?.length > 1 && (
                <section className="safari-photo-gallery" aria-label={`${selectedSafari.title} photo gallery`}>
                  <h3>Trip gallery</h3>
                  <div>
                    {selectedSafari.images.slice(1).map((image, index) => (
                      <img key={`${image}-${index}`} src={image} alt={`${selectedSafari.title} trip photo ${index + 2}`} loading="lazy" />
                    ))}
                  </div>
                </section>
              )}
              {selectedSafari.videos?.length > 0 && (
                <section className="safari-video-gallery" aria-label={`${selectedSafari.title} video gallery`}>
                  <h3>Trip videos</h3>
                  <div>
                    {selectedSafari.videos.map((video, index) => (
                      <video key={`${video}-${index}`} src={video} controls preload="metadata">
                        Your browser does not support embedded videos.
                      </video>
                    ))}
                  </div>
                </section>
              )}
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
    const matchesDestinationPackages = packageFilterIds.length === 0
      || packageFilterIds.includes(String(safari.id));
    const matchesDestination = !filters.destination
      || `${safari.location || ''} ${safari.county || ''}`.toLowerCase().includes(filters.destination.toLowerCase());
    const matchesType = !filters.tripType || safari.trip_type === filters.tripType;
    const matchesDuration = !filters.duration || safari.duration === filters.duration;
    const matchesMode = !filters.tripMode || safari.trip_mode === filters.tripMode || safari.trip_mode === 'either';
    const matchesPrice = (safari.price || 0) <= filters.priceRange;
    return matchesDestinationPackages && matchesDestination && matchesType && matchesDuration && matchesMode && matchesPrice;
  });
  const destinations = [...new Set(safaris.flatMap(safari => [safari.county, safari.location]).filter(Boolean))].sort();
  const tripTypes = [...new Set(safaris.map(safari => safari.trip_type).filter(Boolean))].sort();
  const durations = [...new Set(safaris.map(safari => safari.duration).filter(Boolean))].sort();

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
            <select value={filters.destination} onChange={event => setFilters(prev => ({ ...prev, destination: event.target.value }))}>
              <option value="">All destinations</option>
              {destinations.map(destination => <option key={destination} value={destination}>{destination}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label">Trip type</label>
            <select value={filters.tripType} onChange={event => setFilters(prev => ({ ...prev, tripType: event.target.value }))}>
              <option value="">All trip types</option>
              {tripTypes.map(type => <option key={type} value={type}>{type}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label">Duration</label>
            <select value={filters.duration} onChange={event => setFilters(prev => ({ ...prev, duration: event.target.value }))}>
              <option value="">Any duration</option>
              {durations.map(duration => <option key={duration} value={duration}>{duration}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label">Group or private</label>
            <select value={filters.tripMode} onChange={event => setFilters(prev => ({ ...prev, tripMode: event.target.value }))}>
              <option value="">Any trip style</option>
              <option value="group">Group</option>
              <option value="private">Private</option>
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label">Maximum price: {formatKes(filters.priceRange)}</label>
            <input 
              type="range" 
              className="range-slider" 
              min="0"
              max={maxPrice}
              step="1000"
              value={filters.priceRange} 
              onChange={handlePriceChange} 
            />
            <div className="range-labels"><span>{formatKes(0)}</span><span>{formatKes(maxPrice)}</span></div>
          </div>
          <button type="button" className="filter-reset-button" onClick={clearFilters}>
            <RotateCcw size={16} aria-hidden="true" />
            Clear filters
          </button>
        </aside>

        <main className="listing-grid-main">
          <div className="listings-header">
            <h2 className="section-title">{packageFilterIds.length ? 'Packages for this Destination' : 'Our Premier Safari Tours'}</h2>
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
                      <span className="price">{formatKes(safari.price)}</span>
                      <button className="btn-gold-sm">View Details</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
      <section className="container custom-trip-inquiry">
        <div>
          <p className="gold-text">Tailored for you</p>
          <h2>Plan a private or group trip</h2>
          <p>Tell us where you want to go and what you have in mind. We’ll help shape the itinerary.</p>
        </div>
        <form className="booking-form" onSubmit={handleCustomTripInquiry}>
          <div className="custom-trip-fields">
            <label>Full name<input required value={customTripForm.full_name} onChange={event => setCustomTripForm(prev => ({ ...prev, full_name: event.target.value }))} /></label>
            <label>Email<input type="email" required value={customTripForm.email} onChange={event => setCustomTripForm(prev => ({ ...prev, email: event.target.value }))} /></label>
            <label>Phone<input type="tel" required value={customTripForm.phone} onChange={event => setCustomTripForm(prev => ({ ...prev, phone: event.target.value }))} /></label>
            <label>Destination or county<input required value={customTripForm.destination} onChange={event => setCustomTripForm(prev => ({ ...prev, destination: event.target.value }))} /></label>
            <label>Trip style<select value={customTripForm.trip_mode} onChange={event => setCustomTripForm(prev => ({ ...prev, trip_mode: event.target.value }))}><option value="group">Group</option><option value="private">Private</option></select></label>
            <label>Preferred date<input type="date" value={customTripForm.preferred_date} onChange={event => setCustomTripForm(prev => ({ ...prev, preferred_date: event.target.value }))} /></label>
            <label>Number of travelers<input type="number" min="1" max="100" required value={customTripForm.participant_count} onChange={event => setCustomTripForm(prev => ({ ...prev, participant_count: event.target.value }))} /></label>
          </div>
          <label>What would you like from your trip?<textarea rows="4" value={customTripForm.details} onChange={event => setCustomTripForm(prev => ({ ...prev, details: event.target.value }))} /></label>
          {customTripError && <p className="form-status error" role="alert">{customTripError}</p>}
          {customTripMessage && <p className="form-status success" role="status">{customTripMessage}</p>}
          <button type="submit" className="btn-gold btn-large" disabled={customTripSubmitting}>{customTripSubmitting ? 'Sending...' : 'Request a custom trip'}</button>
        </form>
      </section>
    </div>
  );
}

export default SafarisPage;
