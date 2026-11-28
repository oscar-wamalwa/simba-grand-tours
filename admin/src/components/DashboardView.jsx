import React from 'react';
import { TrendingUp, Users, Map, MessageSquare } from 'lucide-react';

export default function DashboardView({ stats }) {
  const weekly = stats.weekly || [];
  const topSafaris = stats.topSafaris || [];
  const maxWeekly = Math.max(1, ...weekly.map(week => week.count));
  const maxTravelers = Math.max(1, ...topSafaris.map(item => item.travelers));

  return (
    <>
      <div className="stats-grid">
        {[
          { icon: <TrendingUp size={28} />, iconClass: 'visitors', value: stats.bookings, label: 'Confirmed Bookings' },
          { icon: <Users size={28} />, iconClass: 'subscribers', value: stats.subscribers, label: 'Subscribers' },
          { icon: <Map size={28} />, iconClass: 'safaris', value: stats.safaris, label: 'Active Safaris' },
          { icon: <MessageSquare size={28} />, iconClass: 'messages', value: stats.messages, label: 'New Messages' },
        ].map((stat, i) => (
          <div key={i} className="stat-card fade-in">
            <div className={`stat-icon ${stat.iconClass}`}>{stat.icon}</div>
            <div className="stat-content">
              <p className="stat-value">{stat.value}</p>
              <p className="stat-label">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="charts-section">
        <div className="chart-card">
          <div className="chart-header"><h3>Confirmed Bookings - Last 4 Weeks</h3></div>
          <div className="visitor-chart">
            {weekly.map((week, i) => (
              <div key={i} className="chart-bar-wrapper">
                <span className="chart-label">{week.count}</span>
                <div className="chart-bar" style={{ height: `${Math.max(4, (week.count / maxWeekly) * 200)}px` }}></div>
                <span className="chart-label">{week.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-header"><h3>Top Safaris by Travelers</h3></div>
          {topSafaris.length === 0 ? (
            <p className="chart-empty">No confirmed bookings yet.</p>
          ) : (
            <div className="top-safaris">
              {topSafaris.map(item => (
                <div key={item.title} className="top-safari-row">
                  <div className="top-safari-head"><span>{item.title}</span><strong>{item.travelers}</strong></div>
                  <div className="top-safari-track"><div className="top-safari-fill" style={{ width: `${(item.travelers / maxTravelers) * 100}%` }}></div></div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
