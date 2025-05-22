/**
 * UI Component Factory for Log Visualization Plugin
 * 
 * This file exports functions to create UI components for the plugin
 */

import { PluginContext } from '../../../core/plugin-registry/interfaces';
import { LogVisualizationService } from '../src/services/log-visualization-service';

/**
 * Create UI components for the Log Visualization plugin
 * 
 * @param service - Log visualization service instance
 * @param context - Plugin context
 * @returns Array of UI components
 */
export function createUIComponents(service: LogVisualizationService, context: PluginContext): any[] {
  // In a real implementation, this would import and configure React components
  // For now, we'll return placeholder components
  
  const components = [
    {
      id: 'log-visualization-dashboard',
      name: 'Log Visualization Dashboard',
      component: {
        // This would be a reference to the actual React component
        render: () => ({
          type: 'div',
          props: {
            children: 'Log Visualization Dashboard'
          }
        }),
        // Provide the service as a prop to the component
        props: {
          service
        }
      }
    },
    {
      id: 'log-detail-view',
      name: 'Log Detail View',
      component: {
        render: () => ({
          type: 'div',
          props: {
            children: 'Log Detail View'
          }
        }),
        props: {
          service
        }
      }
    }
  ];
  
  return components;
}