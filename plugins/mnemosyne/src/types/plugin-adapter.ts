import { AlexandriaPluginContext } from './alexandria-plugin-api';
import { PluginContext } from '../../../../src/core/plugin-registry/interfaces';

/**
 * Adapter to convert AlexandriaPluginContext to PluginContext
 */
export function adaptPluginContext(context: AlexandriaPluginContext): PluginContext {
  return {
    services: {
      logger: context.logger as any,
      eventBus: context.eventBus as any,
      data: context.data as any,
      ui: context.ui as any,
      featureFlags: context.featureFlags as any,
      security: context.security as any,
      api: context.api as any
    },
    manifest: {
      id: 'mnemosyne',
      name: 'Mnemosyne Knowledge Management',
      version: '0.1.0',
      main: 'index.js'
    }
  } as PluginContext;
}