// Alfred Plugin Entry Point
class AlfredPlugin {
  constructor() {
    this.name = 'ALFRED - AI Coding Assistant';
    this.version = '2.0.0';
  }

  async onInstall(api) {
    // Handle case where api is not provided (e.g., during plugin registry initialization)
    if (api && api.log) {
      api.log('info', 'Alfred plugin installed');
    } else {
      console.log('[Alfred] Plugin installed');
    }
  }

  async onActivate(api) {
    // Handle case where api is not provided (e.g., during plugin registry initialization)
    if (api && api.log) {
      api.log('info', 'Alfred plugin activated');
      
      // Register API routes
      if (api.registerRoute) {
        api.registerRoute('/alfred/sessions', {
          method: 'GET',
          handler: async (req, res) => {
            res.json({ sessions: [] });
          }
        });
      }
    } else {
      console.log('[Alfred] Plugin activated');
    }
  }

  async onDeactivate(api) {
    // Handle case where api is not provided (e.g., during plugin registry initialization)
    if (api && api.log) {
      api.log('info', 'Alfred plugin deactivated');
    } else {
      console.log('[Alfred] Plugin deactivated');
    }
  }
}

module.exports = AlfredPlugin;