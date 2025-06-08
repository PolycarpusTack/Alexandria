// Log Visualization Plugin Entry Point
class LogVisualizationPlugin {
  constructor() {
    this.name = 'Log Visualization';
    this.version = '1.0.0';
  }

  async onInstall(api) {
    // Handle case where api is not provided (e.g., during plugin registry initialization)
    if (api && api.log) {
      api.log('info', 'Log Visualization plugin installed');
    } else {
      console.log('[Log Visualization] Plugin installed');
    }
  }

  async onActivate(api) {
    // Handle case where api is not provided (e.g., during plugin registry initialization)
    if (api && api.log) {
      api.log('info', 'Log Visualization plugin activated');
      
      // Register API routes
      if (api.registerRoute) {
        api.registerRoute('/log-visualization/sources', {
          method: 'GET',
          handler: async (req, res) => {
            res.json({ sources: [] });
          }
        });
      }
    } else {
      console.log('[Log Visualization] Plugin activated');
    }
  }

  async onDeactivate(api) {
    // Handle case where api is not provided (e.g., during plugin registry initialization)
    if (api && api.log) {
      api.log('info', 'Log Visualization plugin deactivated');
    } else {
      console.log('[Log Visualization] Plugin deactivated');
    }
  }
}

module.exports = LogVisualizationPlugin;