import React from 'react';
import { TrendingUp, TrendingDown, Users, Map, MessageSquare } from 'lucide-react';

export default function DashboardView({ stats }) {
  return (
    <>
      <div className="stats-grid">
        {[
          { icon: <TrendingUp size={28} />, iconClass: 'visitors', value: stats.visitors, label: 'Total Visitors', change: '0%', positive: true },
          { icon: <Users size={28} />, iconClass: 'subscribers', value: stats.subscribers, label: 'Subscribers', change: '+0', positive: true },
          { icon: <Map size={28} />, iconClass: 'safaris', value: stats.safaris, label: 'Active Safaris', change: '+0', positive: true },
          { icon: <MessageSquare size={28} />, iconClass: 'messages', value: stats.messages, label: 'New Messages', change: '0', positive: false },
        ].map((stat, i) => (
          <div key={i} className="stat-card fade-in">
            <div className={`stat-icon ${stat.iconClass}`}>{stat.icon}</div>
            <div className="stat-content">
              <p className="stat-value">{stat.value}</p>
              <p className="stat-label">{stat.label}</p>
              <span className={`stat-change ${stat.positive ? 'positive' : 'negative'}`}>
                {stat.positive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                {stat.change} this month
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="charts-section">
        <div className="chart-card">
          <div className="chart-header"><h3>Weekly Visitors - January</h3></div>
          <div className="visitor-chart">
            {['Week 1', 'Week 2', 'Week 3', 'Week 4'].map((week, i) => (
              <div key={i} className="chart-bar-wrapper">
                <div className="chart-bar" style={{ height: '50px' }}></div>
                <span className="chart-label">{week}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-header"><h3>Traffic Sources</h3></div>
          <div className="pie-chart-container">
            <div className="pie-chart"></div>
            <div className="pie-legend">
              {['Direct (60%)', 'Social Media (40%)'].map((s, i) => (
                <div key={i} className="legend-item">
                  <span className="legend-color" style={{ background: ['var(--gold-majesty)','#27ae60'][i] }}></span>
                  <span>{s}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

