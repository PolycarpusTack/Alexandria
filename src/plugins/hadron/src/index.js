// Crash Analyzer Plugin Entry Point
class CrashAnalyzerPlugin {
  constructor() {
    this.name = 'AI-Powered Crash Analyzer';
    this.version = '1.0.0';
  }

  async onInstall(api) {
    // Handle case where api is not provided (e.g., during plugin registry initialization)
    if (api && api.log) {
      api.log('info', 'Crash Analyzer plugin installed');
    } else {
      console.log('[Crash Analyzer] Plugin installed');
    }
  }

  async onActivate(api) {
    // Handle case where api is not provided (e.g., during plugin registry initialization)
    if (api && api.log) {
      api.log('info', 'Crash Analyzer plugin activated');
      
      // Register API routes
      if (api.registerRoute) {
        api.registerRoute('/crash-analyzer/analyze', {
          method: 'POST',
          handler: async (req, res) => {
            res.json({ status: 'analyzing' });
          }
        });
      }
    } else {
      console.log('[Crash Analyzer] Plugin activated');
    }
  }

  async onDeactivate(api) {
    // Handle case where api is not provided (e.g., during plugin registry initialization)
    if (api && api.log) {
      api.log('info', 'Crash Analyzer plugin deactivated');
    } else {
      console.log('[Crash Analyzer] Plugin deactivated');
    }
  }
}

module.exports = CrashAnalyzerPlugin;