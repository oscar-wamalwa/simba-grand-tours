import { useEffect, useState } from 'react';
import api from './api';
import profilePic from './profile.jpg';
import './admin.css';
import {
  LayoutDashboard,
  Map,
  MapPin,
  Users,
  MessageSquare,
  BarChart3,
  Settings,
  LogOut,
  FileText,
  MessageCircle,
  LockKeyhole,
  User,
  Menu,
  X,
  CalendarDays,
  FilePlus2,
  Megaphone
} from 'lucide-react';
import { fetchUsdKesRate, formatCurrencyPair, readCachedUsdKesRate } from './currency';
import Select from './components/Select';
import {
  DashboardView,
  SafarisView,
  DestinationsView,
  SubscribersView,
  MessagesView,
  TestimoniesView,
  BlogsView,
  AnalyticsView,
  SettingsView,
  BookingsView,
  CampaignsView,
  InvoicesView
} from './components';

const pageInfo = {
  dashboard: ['Dashboard', "Welcome back! Here's your website overview."],
  safaris: ['Safaris and Trips', 'Control which safari packages appear on the website.'],
  destinations: ['Destinations', 'Manage destination cards, starting prices, photos, and linked safari packages.'],
  subscribers: ['Subscribers', 'View and manage newsletter subscribers.'],
  messages: ['Messages', 'View and respond to contact form submissions.'],
  testimonies: ['Testimonies', 'Choose reviews to feature on the website.'],
  blogs: ['The Simba Pulse', 'Create, publish, and manage website stories.'],
  analytics: ['Sales Reports', 'Review confirmed bookings and revenue by safari.'],
  settings: ['Settings', 'Control contact details, social links, and website branding.'],
  bookings: ['Departures and Bookings', 'Schedule trips, track paid seats, and export passenger manifests.'],
  campaigns: ['Promotions and Waitlist', 'Manage promo codes, seasonal announcements, and sold-out trip waitlists.'],
  invoices: ['Invoices', 'Create, edit and download corporate or individual invoices.']
};

export default function AdminDashboard({ onLogout }) {
  const [token, setToken] = useState(() => localStorage.getItem('adminToken'));
  const [displayCurrency, setDisplayCurrency] = useState(() => (
    localStorage.getItem('adminDisplayCurrency') === 'USD' && readCachedUsdKesRate()?.rate
      ? 'USD'
      : 'KES'
  ));
  const [exchangeRate, setExchangeRate] = useState(readCachedUsdKesRate);
  const [exchangeRateError, setExchangeRateError] = useState(false);
  const [currentPage, setCurrentPage] = useState(() => {
    const savedPage = sessionStorage.getItem('adminCurrentPage');
    return pageInfo[savedPage] ? savedPage : 'dashboard';
  });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [stats, setStats] = useState({
    bookings: 0,
    weekly: [],
    topSafaris: [],
    subscribers: 0,
    safaris: 0,
    messages: 0,
    blogs: 0
  });

  useEffect(() => {
    if (token) fetchStats();
  }, [token]);

  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    fetchUsdKesRate()
      .then(rateInfo => {
        if (!active) return;
        setExchangeRate(rateInfo);
        setExchangeRateError(false);
        if (localStorage.getItem('adminDisplayCurrency') === 'USD') setDisplayCurrency('USD');
      })
      .catch(error => {
        console.error('Could not update USD/KES exchange rate:', error);
        if (active) setExchangeRateError(true);
      });
    return () => { active = false; };
  }, [token]);

  const fetchStats = async () => {
    try {
      const [safaris, subscribers, _messages, blogs, unread, bookings] = await Promise.all([
        api.safaris.getAll(),
        api.subscribers.getAll(),
        api.messages.getAll(),
        api.blogs.getAll({ status: 'published' }),
        api.messages.getUnreadCount(),
        api.bookings.getAll().catch(() => [])
      ]);
      const confirmed = bookings.filter(item => item.status === 'confirmed');
      const weekMs = 7 * 24 * 60 * 60 * 1000;
      const now = Date.now();
      const weekly = [3, 2, 1, 0].map(weeksAgo => {
        const end = now - weeksAgo * weekMs;
        const start = end - weekMs;
        const count = confirmed.filter(item => {
          const time = new Date(item.created_at).getTime();
          return time > start && time <= end;
        }).length;
        return { label: weeksAgo === 0 ? 'This week' : `${weeksAgo} wk ago`, count };
      });
      const perSafari = {};
      confirmed.forEach(item => {
        perSafari[item.safari_title] = (perSafari[item.safari_title] || 0) + item.participant_count;
      });
      const topSafaris = Object.entries(perSafari)
        .map(([title, travelers]) => ({ title, travelers }))
        .sort((x, y) => y.travelers - x.travelers)
        .slice(0, 5);
      setStats({
        bookings: confirmed.length,
        weekly,
        topSafaris,
        subscribers: subscribers.length,
        safaris: safaris.filter(item => item.visible).length,
        messages: unread.unread_count || 0,
        blogs: blogs.length
      });
    } catch (error) {
      console.error('Could not load dashboard stats:', error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    sessionStorage.removeItem('adminCurrentPage');
    setMobileNavOpen(false);
    setToken(null);
    onLogout?.();
  };

  const navigateToPage = (pageName) => {
    sessionStorage.setItem('adminCurrentPage', pageName);
    setCurrentPage(pageName);
    setMobileNavOpen(false);
  };

  const formatPrice = amountKes => formatCurrencyPair(amountKes, displayCurrency, exchangeRate?.rate);
  const handleCurrencyChange = event => {
    const nextCurrency = event.target.value;
    if (nextCurrency === 'USD' && !exchangeRate?.rate) return;
    localStorage.setItem('adminDisplayCurrency', nextCurrency);
    setDisplayCurrency(nextCurrency);
  };

  if (!token) {
    return <LoginView onLogin={(newToken) => {
      localStorage.setItem('adminToken', newToken);
      setToken(newToken);
    }} />;
  }

  const [title, subtitle] = pageInfo[currentPage];
  const navItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'safaris', icon: Map, label: 'Safaris and Trips' },
    { id: 'destinations', icon: MapPin, label: 'Destinations' },
    { id: 'blogs', icon: FileText, label: 'The Simba Pulse' },
    { id: 'subscribers', icon: Users, label: 'Subscribers' },
    { id: 'messages', icon: MessageSquare, label: 'Messages' },
    { id: 'testimonies', icon: MessageCircle, label: 'Testimonies' },
    { id: 'analytics', icon: BarChart3, label: 'Sales Reports' },
    { id: 'settings', icon: Settings, label: 'Settings' },
    { id: 'bookings', icon: CalendarDays, label: 'Departures and Bookings' },
    { id: 'invoices', icon: FilePlus2, label: 'Invoices' },
    { id: 'campaigns', icon: Megaphone, label: 'Promotions and Waitlist' }
  ];

  return (
    <div className="admin-wrapper">
      <aside className={`admin-sidebar ${mobileNavOpen ? 'mobile-open' : ''}`} aria-label="Admin navigation">
        <div className="sidebar-header">
          <div className="sidebar-logo"><h2>Simba Grand Tours Admin</h2></div>
        </div>
        <nav className="sidebar-nav" id="admin-navigation">
          <div className="nav-section">
            <p className="nav-section-title">Main Menu</p>
            {navItems.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                className={`nav-item ${currentPage === id ? 'active' : ''}`}
                onClick={() => navigateToPage(id)}
              >
                <Icon size={20} /><span>{label}</span>
              </button>
            ))}
          </div>
          <div className="nav-section">
            <p className="nav-section-title">Account</p>
            <button className="nav-item" onClick={handleLogout}>
              <LogOut size={20} /><span>Logout</span>
            </button>
          </div>
        </nav>
      </aside>
      {mobileNavOpen && (
        <button
          type="button"
          className="admin-sidebar-backdrop"
          aria-label="Close navigation menu"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      <main className="admin-main">
        <header className="admin-header">
          <button
            type="button"
            className="mobile-nav-toggle"
            aria-label={mobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileNavOpen}
            aria-controls="admin-navigation"
            onClick={() => setMobileNavOpen(open => !open)}
          >
            {mobileNavOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="header-left">
            <img src="/simbalogo.png" alt="Simba Grand Tours" style={{ width: '50px', height: '50px', borderRadius: '50%' }} />
            <div><h1>{title}</h1><p>{subtitle}</p></div>
          </div>
          <div className="header-right">
            <label className="admin-currency-control">
              <span>Display currency</span>
              <Select
                compact
                aria-label="Admin display currency"
                title={exchangeRate?.rate
                  ? `USD values are rounded to whole dollars. 1 USD = KES ${exchangeRate.rate.toFixed(2)}.`
                  : 'USD exchange rate is currently unavailable.'}
                value={displayCurrency}
                onChange={handleCurrencyChange}
              >
                <option value="KES">KES</option>
                <option value="USD" disabled={!exchangeRate?.rate}>
                  {exchangeRateError && exchangeRate?.rate ? 'USD (saved rate)' : !exchangeRate?.rate ? 'USD unavailable' : 'USD'}
                </option>
              </Select>
            </label>
            <div className="admin-profile">
              <img src={profilePic} alt="Administrator" style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover' }} />
              <div className="admin-info"><span className="name">Admin</span><span className="role">Website Manager</span></div>
            </div>
          </div>
        </header>

        <div className="admin-content">
          {currentPage === 'dashboard' && <DashboardView stats={stats} />}
          {currentPage === 'safaris' && <SafarisView onRefresh={fetchStats} />}
          {currentPage === 'destinations' && <DestinationsView formatPrice={formatPrice} />}
          {currentPage === 'subscribers' && <SubscribersView />}
          {currentPage === 'messages' && <MessagesView />}
          {currentPage === 'testimonies' && <TestimoniesView />}
          {currentPage === 'blogs' && <BlogsView onRefresh={fetchStats} />}
          {currentPage === 'analytics' && <AnalyticsView formatPrice={formatPrice} />}
          {currentPage === 'settings' && <SettingsView />}
          {currentPage === 'bookings' && <BookingsView formatPrice={formatPrice} />}
          {currentPage === 'invoices' && <InvoicesView />}
          {currentPage === 'campaigns' && <CampaignsView formatPrice={formatPrice} />}
        </div>
      </main>
    </div>
  );
}

function LoginView({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await api.auth.login(username, password);
      onLogin(result.token);
    } catch (loginError) {
      setError(loginError.message || 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login">
      <form className="admin-login-card" onSubmit={handleSubmit}>
        <img src="/simbalogo.png" alt="Simba Grand Tours" />
        <h1>Admin Sign In</h1>
        <p>Manage the website content and settings.</p>
        <label><User size={16} /> Username</label>
        <input value={username} onChange={(event) => setUsername(event.target.value)} required autoComplete="username" />
        <label><LockKeyhole size={16} /> Password</label>
        <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" />
        {error && <div className="login-error">{error}</div>}
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}
