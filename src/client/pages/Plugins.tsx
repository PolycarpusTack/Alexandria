import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const Plugins: React.FC = () => {
  const navigate = useNavigate();
  const [plugins, setPlugins] = useState([
    {
      id: 'alfred',
      name: 'Alfred',
      version: 'v2.0.0',
      status: 'active',
      description: 'AI-powered coding assistant with project-aware context and intelligent code generation capabilities.',
      author: 'Alexandria Team',
      category: 'AI Assistant',
      color: '#38bdf8',
      icon: '💻',
      installed: true,
      enabled: true,
      size: '2.4 MB',
      lastUpdated: '2025-01-06',
      metrics: {
        requests: 893,
        success: '98.2%',
        avgTime: '145ms',
        users: 12
      },
      features: [
        'Code generation',
        'Project analysis',
        'AI chat interface',
        'Template management',
        'Session persistence'
      ]
    },
    {
      id: 'hadron',
      name: 'Hadron',
      version: 'v1.0.0',
      status: 'active',
      description: 'AI-powered crash log analysis with root cause detection and solution recommendations.',
      author: 'Alexandria Team',
      category: 'Analysis',
      color: '#f43f5e',
      icon: '🔍',
      installed: true,
      enabled: true,
      size: '1.8 MB',
      lastUpdated: '2025-01-05',
      metrics: {
        logs: 24,
        accuracy: '89.4%',
        avgTime: '2.3s',
        users: 8
      },
      features: [
        'Log file analysis',
        'Root cause detection',
        'Solution suggestions',
        'Pattern recognition',
        'Export reports'
      ]
    },
    {
      id: 'heimdall',
      name: 'Heimdall',
      version: 'v1.0.0',
      status: 'inactive',
      description: 'Advanced log visualization and pattern detection platform for system monitoring.',
      author: 'Alexandria Team',
      category: 'Monitoring',
      color: '#a78bfa',
      icon: '📈',
      installed: true,
      enabled: false,
      size: '3.2 MB',
      lastUpdated: '2025-01-04',
      metrics: {
        sources: 0,
        monitors: 0,
        alerts: 0,
        users: 0
      },
      features: [
        'Real-time monitoring',
        'Log visualization',
        'Alert system',
        'Pattern detection',
        'Dashboard widgets'
      ]
    }
  ]);

  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredPlugins = plugins.filter(plugin => {
    const matchesFilter = filter === 'all' || 
      (filter === 'active' && plugin.status === 'active') ||
      (filter === 'inactive' && plugin.status === 'inactive');
    
    const matchesSearch = plugin.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      plugin.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      plugin.category.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  const togglePlugin = (pluginId: string) => {
    setPlugins(prev => prev.map(plugin => 
      plugin.id === pluginId 
        ? { 
            ...plugin, 
            enabled: !plugin.enabled,
            status: !plugin.enabled ? 'active' : 'inactive'
          }
        : plugin
    ));
  };

  const navigateToPlugin = (pluginId: string) => {
    // Map plugin IDs to their actual routes
    const routeMap: Record<string, string> = {
      'alfred': '/alfred',
      'hadron': '/crash-analyzer',
      'heimdall': '/heimdall'
    };
    
    const route = routeMap[pluginId] || `/${pluginId}`;
    navigate(route);
  };

  return (
    <div className="plugins-page">
      <style>{pluginsPageStyles}</style>
      
      {/* Header */}
      <div className="page-header">
        <div className="header-content">
          <h1 className="page-title">Plugins</h1>
          <p className="page-subtitle">Manage and configure your Alexandria Platform plugins</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary">
            ➕ Install Plugin
          </button>
          <button className="btn btn-secondary">
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="plugin-stats">
        <div className="stat-item">
          <div className="stat-value">{plugins.length}</div>
          <div className="stat-label">Total Plugins</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{plugins.filter(p => p.status === 'active').length}</div>
          <div className="stat-label">Active</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{plugins.filter(p => p.enabled).length}</div>
          <div className="stat-label">Enabled</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{plugins.reduce((acc, p) => acc + (p.metrics.users || 0), 0)}</div>
          <div className="stat-label">Total Users</div>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <div className="search-container">
          <input
            type="text"
            className="search-input"
            placeholder="Search plugins..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="filter-buttons">
          <button 
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All ({plugins.length})
          </button>
          <button 
            className={`filter-btn ${filter === 'active' ? 'active' : ''}`}
            onClick={() => setFilter('active')}
          >
            Active ({plugins.filter(p => p.status === 'active').length})
          </button>
          <button 
            className={`filter-btn ${filter === 'inactive' ? 'active' : ''}`}
            onClick={() => setFilter('inactive')}
          >
            Inactive ({plugins.filter(p => p.status === 'inactive').length})
          </button>
        </div>
      </div>

      {/* Plugin Grid */}
      <div className="plugins-grid">
        {filteredPlugins.map((plugin) => (
          <div key={plugin.id} className="plugin-card" style={{ '--plugin-color': plugin.color } as any}>
            <div className="plugin-header">
              <div className="plugin-icon">{plugin.icon}</div>
              <div className="plugin-info">
                <div className="plugin-name">{plugin.name}</div>
                <div className="plugin-version">{plugin.version}</div>
              </div>
              <div className="plugin-status">
                <div className={`status-badge ${plugin.status}`}>
                  {plugin.status === 'active' ? '🟢' : '🔴'} {plugin.status}
                </div>
              </div>
            </div>

            <div className="plugin-meta">
              <span className="plugin-category">{plugin.category}</span>
              <span className="plugin-size">{plugin.size}</span>
            </div>

            <p className="plugin-description">{plugin.description}</p>

            <div className="plugin-features">
              <div className="features-label">Features:</div>
              <div className="features-list">
                {plugin.features.slice(0, 3).map((feature, index) => (
                  <span key={index} className="feature-tag">
                    {feature}
                  </span>
                ))}
                {plugin.features.length > 3 && (
                  <span className="feature-tag more">
                    +{plugin.features.length - 3} more
                  </span>
                )}
              </div>
            </div>

            <div className="plugin-metrics">
              {Object.entries(plugin.metrics).map(([key, value]) => (
                <div key={key} className="metric-item">
                  <div className="metric-value">{value}</div>
                  <div className="metric-label">{key}</div>
                </div>
              ))}
            </div>

            <div className="plugin-actions">
              <button 
                className="btn btn-primary"
                onClick={() => navigateToPlugin(plugin.id)}
              >
                🚀 Open
              </button>
              <button 
                className={`btn ${plugin.enabled ? 'btn-warning' : 'btn-success'}`}
                onClick={() => togglePlugin(plugin.id)}
              >
                {plugin.enabled ? '⏸️ Disable' : '▶️ Enable'}
              </button>
              <button className="btn btn-secondary">
                ⚙️ Configure
              </button>
            </div>

            <div className="plugin-footer">
              <span className="plugin-author">by {plugin.author}</span>
              <span className="plugin-updated">Updated {plugin.lastUpdated}</span>
            </div>
          </div>
        ))}
      </div>

      {filteredPlugins.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">🔍</div>
          <div className="empty-title">No plugins found</div>
          <div className="empty-message">
            {searchTerm ? 'Try adjusting your search terms' : 'No plugins match the current filter'}
          </div>
        </div>
      )}
    </div>
  );
};

const pluginsPageStyles = `
.plugins-page {
  padding: 24px;
  background-color: var(--color-bg-dark);
  color: #e5e5e5;
  min-height: 100%;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}

.header-content h1 {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 8px;
  color: #ffffff;
}

.page-subtitle {
  color: #8b8b8b;
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.plugin-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.stat-item {
  background-color: var(--color-card-dark);
  border: 1px solid var(--color-border-dark);
  border-radius: 6px;
  padding: 16px;
  text-align: center;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--color-primary);
  margin-bottom: 4px;
}

.stat-label {
  font-size: 12px;
  color: #8b8b8b;
}

.filters-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  gap: 16px;
}

.search-container {
  flex: 1;
  max-width: 300px;
}

.search-input {
  width: 100%;
  background-color: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--color-border-dark);
  border-radius: 4px;
  padding: 8px 12px;
  color: #e5e5e5;
  font-size: 14px;
  outline: none;
}

.search-input:focus {
  border-color: var(--color-primary);
  background-color: rgba(255, 255, 255, 0.08);
}

.search-input::placeholder {
  color: #6b6b6b;
}

.filter-buttons {
  display: flex;
  gap: 8px;
}

.filter-btn {
  padding: 8px 16px;
  background-color: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--color-border-dark);
  border-radius: 4px;
  color: #8b8b8b;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.filter-btn:hover {
  background-color: rgba(255, 255, 255, 0.08);
  color: #e5e5e5;
}

.filter-btn.active {
  background-color: var(--color-primary);
  border-color: var(--color-primary);
  color: white;
}

.plugins-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 20px;
}

.plugin-card {
  background-color: var(--color-card-dark);
  border: 1px solid var(--color-border-dark);
  border-radius: 8px;
  padding: 20px;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
}

.plugin-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--plugin-color, var(--color-primary));
}

.plugin-card:hover {
  border-color: var(--color-border-light);
  transform: translateY(-2px);
}

.plugin-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.plugin-icon {
  font-size: 28px;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
}

.plugin-info {
  flex: 1;
}

.plugin-name {
  font-size: 18px;
  font-weight: 600;
  color: #ffffff;
  margin-bottom: 2px;
}

.plugin-version {
  font-size: 12px;
  color: #6b6b6b;
}

.status-badge {
  padding: 4px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
}

.status-badge.active {
  background-color: rgba(16, 185, 129, 0.15);
  color: #34d399;
}

.status-badge.inactive {
  background-color: rgba(107, 107, 107, 0.15);
  color: #6b6b6b;
}

.plugin-meta {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
  font-size: 12px;
}

.plugin-category {
  background-color: rgba(255, 255, 255, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  color: #8b8b8b;
}

.plugin-size {
  color: #6b6b6b;
}

.plugin-description {
  color: #8b8b8b;
  font-size: 13px;
  line-height: 1.5;
  margin-bottom: 16px;
}

.plugin-features {
  margin-bottom: 16px;
}

.features-label {
  font-size: 12px;
  color: #8b8b8b;
  margin-bottom: 8px;
}

.features-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.feature-tag {
  background-color: rgba(255, 255, 255, 0.05);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  color: #cccccc;
}

.feature-tag.more {
  background-color: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
}

.plugin-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
  padding: 12px;
  background-color: rgba(255, 255, 255, 0.02);
  border-radius: 6px;
}

.metric-item {
  text-align: center;
}

.metric-value {
  font-size: 16px;
  font-weight: 600;
  color: #ffffff;
}

.metric-label {
  font-size: 10px;
  color: #6b6b6b;
  margin-top: 2px;
}

.plugin-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.plugin-actions .btn {
  flex: 1;
  font-size: 11px;
}

.plugin-footer {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #6b6b6b;
  border-top: 1px solid var(--color-border-dark);
  padding-top: 12px;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 500;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s ease;
  border: none;
  outline: none;
  user-select: none;
  text-decoration: none;
}

.btn-primary {
  background-color: var(--color-primary);
  color: white;
}

.btn-primary:hover {
  background-color: var(--color-primary-dark);
}

.btn-secondary {
  background-color: rgba(255, 255, 255, 0.08);
  color: #e5e5e5;
  border: 1px solid var(--color-border-light);
}

.btn-secondary:hover {
  background-color: rgba(255, 255, 255, 0.12);
  border-color: #4a4a4a;
}

.btn-success {
  background-color: var(--color-success);
  color: white;
}

.btn-success:hover {
  background-color: #059669;
}

.btn-warning {
  background-color: var(--color-warning);
  color: white;
}

.btn-warning:hover {
  background-color: #d97706;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #6b6b6b;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 8px;
  color: #8b8b8b;
}

.empty-message {
  font-size: 14px;
}

@media (max-width: 768px) {
  .plugins-grid {
    grid-template-columns: 1fr;
  }
  
  .page-header {
    flex-direction: column;
    gap: 16px;
  }
  
  .filters-section {
    flex-direction: column;
    align-items: stretch;
  }
  
  .plugin-actions {
    flex-direction: column;
  }
}
`;

export default Plugins;