import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Menu, X } from 'lucide-react';
import api from './api';

// Icons - load only what's needed for initial render
// Lazy load page components - they only load when needed
const HomeSection = lazy(() => import('./components/HomeSection'));
const SafarisPage = lazy(() => import('./components/SafarisPage'));
const DestinationsPage = lazy(() => import('./components/DestinationsPage'));
const LegalPage = lazy(() => import('./components/LegalPage'));
const PulsePage = lazy(() => import('./components/PulsePage'));
const ServicesPage = lazy(() => import('./components/ServicesPage'));
const AboutPage = lazy(() => import('./components/AboutPage'));
const ContactPage = lazy(() => import('./components/ContactPage'));
const FooterSection = lazy(() => import('./components/FooterSection'));
const ReviewModal = lazy(() => import('./components/ReviewModal'));

// Default settings - used immediately while API data loads
const defaultSettings = {
  siteName: 'Simba Grand Tours',
  siteEmail: 'simbagrandtours@gmail.com',
  sitePhone: '+254 707 984 287',
  address: 'Platinumz Plaza, Tom Mboya Street, Nairobi CBD',
  website: 'www.simbagrandtours.com',
  instagram: 'https://instagram.com/simba.grand.tours',
  facebook: 'https://web.facebook.com/simbagrandtours',
  tiktok: 'https://www.tiktok.com/@simba.grand.tours',
  whatsapp: '+254707984287'
};

// Empty default safaris - data loaded from API only
const defaultSafaris = [];
const clientPages = new Set(['home', 'safaris', 'details', 'destinations', 'pulse', 'services', 'about', 'contact', 'privacy', 'terms']);

// Loading fallback - instant render
const LoadingFallback = () => (
  <div style={{ 
    display: 'flex', 
    flexDirection: 'column', 
    alignItems: 'center', 
    justifyContent: 'center', 
    minHeight: '60vh',
    gap: '15px'
  }}>
    <div style={{ 
      width: '40px', 
      height: '40px', 
      border: '3px solid #e0e0e0',
      borderTopColor: '#c49a6c',
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite'
    }} />
    <style>{`
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `}</style>
  </div>
);

export default function App() {
  const [page, setPage] = useState(() => {
    const savedPage = sessionStorage.getItem('clientCurrentPage');
    return clientPages.has(savedPage) ? savedPage : 'home';
  });
  const [safaris, setSafaris] = useState(defaultSafaris);
  const [destinations, setDestinations] = useState([]);
  const [packageFilterIds, setPackageFilterIds] = useState([]);
  const [settings, setSettings] = useState(defaultSettings);
  const [testimonials, setTestimonials] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [dismissedAnnouncementId, setDismissedAnnouncementId] = useState(null);
  const [focusCustomTripRequest, setFocusCustomTripRequest] = useState(false);
  const [customTripService, setCustomTripService] = useState('');
  const [selectedSafari, setSelectedSafari] = useState(null);
  const [selectedSafariId, setSelectedSafariId] = useState(() => sessionStorage.getItem('clientSelectedSafariId'));
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const initialHistoryState = useRef({ page, safariId: selectedSafariId, packageIds: [] });

  useEffect(() => {
    window.history.replaceState(
      initialHistoryState.current,
      '',
      window.location.href,
    );

    const handlePopState = (event) => {
      const state = event.state;
      const nextPage = state && clientPages.has(state.page) ? state.page : 'home';
      const nextSafariId = state?.safariId == null ? null : String(state.safariId);
      const nextPackageIds = Array.isArray(state?.packageIds) ? state.packageIds.map(String) : [];

      setPage(nextPage);
      setSelectedSafariId(nextSafariId);
      setPackageFilterIds(nextPackageIds);
      setFocusCustomTripRequest(Boolean(state?.focusCustomTripRequest));
      setCustomTripService(state?.customTripService || '');
      setSelectedSafari(current => (
        current && String(current.id) === nextSafariId ? current : null
      ));
      setMobileMenuOpen(false);
      sessionStorage.setItem('clientCurrentPage', nextPage);
      if (nextSafariId) {
        sessionStorage.setItem('clientSelectedSafariId', nextSafariId);
      } else {
        sessionStorage.removeItem('clientSelectedSafariId');
      }
      window.scrollTo(0, 0);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (!selectedSafariId) return;
    const safari = safaris.find(item => String(item.id) === selectedSafariId);
    if (safari) setSelectedSafari(safari);
  }, [safaris, selectedSafariId]);

  // Fetch data asynchronously - doesn't block UI
  useEffect(() => {
    const fetchFeaturedTestimonials = async () => {
      try {
        const testimonialsData = await api.testimonials.getFeatured();
        setTestimonials(testimonialsData.map(d => ({ id: d.id, ...d })));
      } catch (err) {
        console.error('Error fetching featured testimonials:', err.message);
      }
    };

    const fetchData = async () => {
      try {
        // Fetch only visible safaris for client
        console.log('Fetching safaris from API...');
        const safarisData = await api.safaris.getAll({ visible: 'true' });
        console.log('Safaris fetched:', safarisData?.length || 0);
        setSafaris(safarisData.map(d => ({
          id: d.id,
          ...d,
          isSignature: d.is_signature ?? d.isSignature ?? false
        })));
      } catch (err) {
        console.error('Error fetching safaris:', err.message);
      }

      try {
        const destinationsData = await api.destinations.getAll();
        setDestinations(destinationsData);
      } catch (err) {
        console.error('Error fetching destinations:', err.message);
      }

      try {
        const settingsData = await api.settings.get();
        if (settingsData) {
          setSettings(prev => ({
            ...prev,
            siteName: settingsData.site_name || prev.siteName,
            siteEmail: settingsData.site_email || prev.siteEmail,
            sitePhone: settingsData.site_phone || prev.sitePhone,
            address: settingsData.address || prev.address,
            website: settingsData.website || prev.website,
            instagram: settingsData.instagram || prev.instagram,
            facebook: settingsData.facebook || prev.facebook,
            tiktok: settingsData.tiktok || prev.tiktok,
            privacyPolicy: settingsData.privacy_policy || prev.privacyPolicy,
            termsConditions: settingsData.terms_conditions || prev.termsConditions,
            whatsapp: settingsData.whatsapp || prev.whatsapp
          }));
        }
      } catch (err) {
        console.error('Error fetching website settings:', err.message);
      }

      await fetchFeaturedTestimonials();

      try {
        const announcementData = await api.announcements.getAll();
        setAnnouncements(announcementData);
      } catch (err) {
        console.error('Error fetching trip announcements:', err.message);
      }
    };

    // Start fetching after a small delay to let initial render complete
    const timer = setTimeout(fetchData, 100);
    window.addEventListener('focus', fetchFeaturedTestimonials);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', fetchFeaturedTestimonials);
    };
  }, []);

  const navigateTo = (pageName, safariData = null, nextPackageIds = [], options = {}) => {
    const safariId = safariData?.id == null ? null : String(safariData.id);
    const packageIds = nextPackageIds.map(String);
    const shouldFocusCustomTripRequest = pageName === 'safaris' && options.focusCustomTripRequest === true;
    const requestedService = shouldFocusCustomTripRequest ? String(options.serviceTitle || '') : '';
    const currentState = window.history.state;
    if (
      currentState?.page !== pageName
      || currentState?.safariId !== safariId
      || JSON.stringify(currentState?.packageIds || []) !== JSON.stringify(packageIds)
      || Boolean(currentState?.focusCustomTripRequest) !== shouldFocusCustomTripRequest
      || (currentState?.customTripService || '') !== requestedService
    ) {
      window.history.pushState(
        {
          page: pageName,
          safariId,
          packageIds,
          focusCustomTripRequest: shouldFocusCustomTripRequest,
          customTripService: requestedService,
        },
        '',
        window.location.href,
      );
    }
    setSelectedSafari(safariData);
    setSelectedSafariId(safariId);
    setPackageFilterIds(packageIds);
    setFocusCustomTripRequest(shouldFocusCustomTripRequest);
    setCustomTripService(requestedService);
    sessionStorage.setItem('clientCurrentPage', pageName);
    if (!safariId) {
      sessionStorage.removeItem('clientSelectedSafariId');
    } else {
      sessionStorage.setItem('clientSelectedSafariId', safariId);
    }
    setPage(pageName);
    setMobileMenuOpen(false);
    window.scrollTo(0, 0);
  };

  return (
    <div className="site-wrapper">
      <nav className="navbar">
        <div className="nav-container">
          <div className="nav-logo" onClick={() => navigateTo('home')}>
            <img src="/simbalogo.png" alt="Logo" style={{ width: '100px', height: '100px' }} />
            <span className="logo-text"></span>
          </div>
          
          <div
            className={`nav-links-center ${mobileMenuOpen ? 'nav-links-open' : ''}`}
            id="client-navigation"
          >
            <button className={`nav-link ${page === 'home' ? 'active' : ''}`} onClick={() => navigateTo('home')}>Home</button>
            <button className={`nav-link ${page === 'safaris' ? 'active' : ''}`} onClick={() => navigateTo('safaris')}>Safaris</button>
            <button className={`nav-link ${page === 'destinations' ? 'active' : ''}`} onClick={() => navigateTo('destinations')}>Destinations</button>
            <button className={`nav-link ${page === 'pulse' ? 'active' : ''}`} onClick={() => navigateTo('pulse')}>The Simba Pulse</button>
            <button className={`nav-link ${page === 'services' ? 'active' : ''}`} onClick={() => navigateTo('services')}>Services</button>
            <button className={`nav-link ${page === 'about' ? 'active' : ''}`} onClick={() => navigateTo('about')}>About Us</button>
            <button className={`nav-link ${page === 'contact' ? 'active' : ''}`} onClick={() => navigateTo('contact')}>Contact</button>
          </div>
          
          <div className="nav-actions">
            <button className="btn-gold" onClick={() => navigateTo('safaris')}>Plan My Safari</button>
            <span className="nav-phone">{settings.sitePhone}</span>
            <button
              type="button"
              className="mobile-menu-btn"
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileMenuOpen}
              aria-controls="client-navigation"
              onClick={() => setMobileMenuOpen(open => !open)}
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </nav>

      {announcements[0] && announcements[0].id !== dismissedAnnouncementId && (
        <aside className="seasonal-announcement" aria-label="Seasonal announcement">
          <button
            type="button"
            className="seasonal-announcement-close"
            aria-label="Dismiss announcement"
            onClick={() => setDismissedAnnouncementId(announcements[0].id)}
          >
            <X size={18} />
          </button>
          {announcements[0].image && <img src={announcements[0].image} alt="" />}
          <div>
            <strong>{announcements[0].title}</strong>
            <p>{announcements[0].message}</p>
          </div>
          {announcements[0].link_url ? (
            <a href={announcements[0].link_url} target="_blank" rel="noreferrer">Learn more</a>
          ) : (
            <button type="button" onClick={() => navigateTo('safaris')}>Explore trips</button>
          )}
        </aside>
      )}

      <Suspense fallback={<LoadingFallback />}>
        {page === 'home' && (
          <HomeSection 
            destinations={destinations}
            testimonials={testimonials}
            onSelect={navigateTo} 
            onExploreDestination={destination => navigateTo('safaris', null, destination.package_ids || [])}
            onShowReviewForm={() => setShowReviewModal(true)} 
          />
        )}
        {page === 'safaris' && (
          <SafarisPage 
            safaris={safaris} 
            onSelect={navigateTo}
            selectedSafari={selectedSafari}
            packageFilterIds={packageFilterIds}
            focusCustomTripRequest={focusCustomTripRequest}
            customTripService={customTripService}
          />
        )}
        {page === 'destinations' && (
          <DestinationsPage
            destinations={destinations}
            onExplore={destination => navigateTo('safaris', null, destination.package_ids || [])}
          />
        )}
        {page === 'details' && (
          <SafarisPage
            safaris={safaris}
            onSelect={navigateTo}
            selectedSafari={selectedSafari}
            focusCustomTripRequest={focusCustomTripRequest}
            customTripService={customTripService}
          />
        )}
        {page === 'pulse' && <PulsePage onNavigate={navigateTo} />}
        {page === 'services' && (
          <ServicesPage
            onNavigate={navigateTo}
            onRequestCustomSafari={serviceTitle => navigateTo('safaris', null, [], {
              focusCustomTripRequest: true,
              serviceTitle,
            })}
          />
        )}
        {page === 'about' && <AboutPage onNavigate={navigateTo} />}
        {page === 'contact' && <ContactPage settings={settings} />}
        {page === 'privacy' && <LegalPage type="privacy" settings={settings} onNavigate={navigateTo} />}
        {page === 'terms' && <LegalPage type="terms" settings={settings} onNavigate={navigateTo} />}
        
        <FooterSection onNavigate={navigateTo} settings={settings} />
        
        {showReviewModal && <ReviewModal onClose={() => setShowReviewModal(false)} />}
      </Suspense>
    </div>
  );
}
