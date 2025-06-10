import React from 'react';
import { DashboardWidget } from '@alexandria/ui';
import { useTemplateStats } from '../hooks/useTemplateStats';

export const TemplatesDashboardWidget: React.FC = () => {
  const stats = useTemplateStats();
  
  return (
    <DashboardWidget
      title="Templates & Snippets"
      icon="fa-solid fa-file-code"
      color="var(--color-secondary)"
    >
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--color-primary)' }}>
            {stats.totalTemplates}
          </div>
          <div className="stat-label">Active Templates</div>
        </div>
        
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--color-alfred)' }}>
            {stats.alfredGenerated}
          </div>
          <div className="stat-label">AI Generated</div>
        </div>
        
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--color-success)' }}>
            {stats.usageToday}
          </div>
          <div className="stat-label">Used Today</div>
        </div>
      </div>
    </DashboardWidget>
  );
};