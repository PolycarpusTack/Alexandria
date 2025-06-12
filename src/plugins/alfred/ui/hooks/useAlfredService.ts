/**
 * React hook for accessing Alfred service
 */

import { useContext } from 'react';
import { PluginContext } from '../../../../client/context/plugin-context';
import { AlfredService } from '../../src/services/alfred-service';

export function useAlfredService(): AlfredService {
  const context = useContext(PluginContext);

  if (!context) {
    throw new Error('useAlfredService must be used within a PluginProvider');
  }

  // The context provides api object, not getService method
  const service = context.api?.getService?.('alfred');

  if (!service) {
    throw new Error('Alfred service not found. Is the plugin activated?');
  }

  return service;
}
