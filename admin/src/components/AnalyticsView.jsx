import { useEffect, useState } from 'react';
import { BarChart3, Download, RefreshCw, TicketCheck, Users } from 'lucide-react';
import api from '../api';
import { formatKes } from '../currency';

function localDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDefaultRange() {
  const today = new Date();
  return {
    start_date: localDateString(new Date(today.getFullYear(), today.getMonth(), 1)),
    end_date: localDateString(today),
  };
}

function downloadCsv(filename, rows) {
  const contents = rows
    .map(row => row.map(value => {
      const text = String(value ?? '');
      const safeText = /^[\t\r\n ]*[=+\-@]/.test(text) ? `'${text}` : text;
      return `"${safeText.replaceAll('"', '""')}"`;
    }).join(','))
    .join('\n');
  const url = URL.createObjectURL(new Blob([contents], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function AnalyticsView() {
  const [dateRange, setDateRange] = useState(getDefaultRange);
  const [draftRange, setDraftRange] = useState(dateRange);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api.bookings.getReport(dateRange)
      .then(data => {
        if (active) setReport(data);
      })
      .catch(requestError => {
        console.error('Could not load sales report:', requestError);
        if (active) setError('Could not load the sales report. Check your connection and try again.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [dateRange]);

  const applyDateRange = (event) => {
    event.preventDefault();
    if (draftRange.start_date > draftRange.end_date) {
      setError('Start date must be on or before end date.');
      return;
    }
    setLoading(true);
    setError('');
    setReport(null);
    setDateRange({ ...draftRange });
  };

  const exportReport = () => {
    if (!report) return;
    const rows = [
      ['Trip', 'Confirmed bookings', 'Participants', 'Booking fees paid (KES)'],
      ...report.by_safari.map(trip => [
        trip.safari_title,
        trip.confirmed_bookings,
        trip.participants,
        trip.revenue_kes,
      ]),
      ['TOTAL', report.confirmed_bookings, report.participants, report.revenue_kes],
    ];
    downloadCsv(`sales-report-${dateRange.start_date}-to-${dateRange.end_date}.csv`, rows);
  };

  const stats = [
    { icon: BarChart3, iconClass: 'visitors', value: formatKes(report?.revenue_kes || 0), label: 'Booking fees collected' },
    { icon: TicketCheck, iconClass: 'safaris', value: report?.confirmed_bookings ?? '—', label: 'Confirmed bookings' },
    { icon: Users, iconClass: 'subscribers', value: report?.participants ?? '—', label: 'Participants' },
  ];

  return (
    <div className="analytics-view fade-in">
      <section className="data-card">
        <div className="data-card-header">
          <div>
            <h3>Sales report</h3>
            <p>Revenue includes confirmed bookings only.</p>
          </div>
          <button type="button" className="btn-secondary" onClick={exportReport} disabled={!report || loading}>
            <Download size={17} /> Export CSV
          </button>
        </div>
        <form className="report-filters" onSubmit={applyDateRange}>
          <label>
            From
            <input
              type="date"
              required
              value={draftRange.start_date}
              onChange={event => setDraftRange(prev => ({ ...prev, start_date: event.target.value }))}
            />
          </label>
          <label>
            To
            <input
              type="date"
              required
              value={draftRange.end_date}
              onChange={event => setDraftRange(prev => ({ ...prev, end_date: event.target.value }))}
            />
          </label>
          <button type="submit" className="btn-primary" disabled={loading}>
            <RefreshCw size={17} /> Apply dates
          </button>
        </form>
        {error && <p className="form-status error" role="alert">{error}</p>}
      </section>

      <div className="stats-grid report-stats">
        {stats.map(({ icon: Icon, iconClass, value, label }) => (
          <div key={label} className="stat-card">
            <div className={`stat-icon ${iconClass}`}><Icon size={28} /></div>
            <div className="stat-content">
              <p className="stat-value">{loading ? '…' : value}</p>
              <p className="stat-label">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <section className="data-card">
        <div className="data-card-header">
          <div>
            <h3>Booking fees collected by safari</h3>
            <p>
              {report?.total_bookings ?? 0} bookings in selected period
              {report?.status_counts?.pending_payment
                ? ` · ${report.status_counts.pending_payment} awaiting payment`
                : ''}
            </p>
          </div>
        </div>
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr><th>Safari</th><th>Confirmed bookings</th><th>Participants</th><th>Revenue</th></tr>
            </thead>
            <tbody>
              {report?.by_safari.map(trip => (
                <tr key={trip.safari_id}>
                  <td>{trip.safari_title}</td>
                  <td>{trip.confirmed_bookings}</td>
                  <td>{trip.participants}</td>
                  <td>{formatKes(trip.revenue_kes)}</td>
                </tr>
              ))}
              {!loading && report?.by_safari.length === 0 && (
                <tr><td colSpan="4">No confirmed bookings in this date range.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

