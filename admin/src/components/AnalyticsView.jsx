import React from 'react';
import { BarChart3, Users, Clock, TrendingDown } from 'lucide-react';

export default function AnalyticsView() {
  return (
    <div className="analytics-view fade-in">
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon visitors"><BarChart3 size={28} /></div>
          <div className="stat-content"><p className="stat-value">0</p><p className="stat-label">Total Page Views</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon subscribers"><Users size={28} /></div>
          <div className="stat-content"><p className="stat-value">0</p><p className="stat-label">New Users</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon safaris"><Clock size={28} /></div>
          <div className="stat-content"><p className="stat-value">0:00</p><p className="stat-label">Avg. Session Duration</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon messages"><TrendingDown size={28} /></div>
          <div className="stat-content"><p className="stat-value">0%</p><p className="stat-label">Drop off Rate</p></div>
        </div>
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
                  <span className="legend-color" style={{ background: ['var(--gold-majesty)', '#27ae60'][i] }}></span>
                  <span>{s}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

