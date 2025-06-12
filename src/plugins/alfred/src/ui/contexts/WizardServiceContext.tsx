/**
 * Wizard Service Context
 *
 * Provides access to the template wizard service throughout the UI
 */

import React, { createContext, useContext, useMemo } from 'react';
import { TemplateWizardService } from '../../services/template-wizard-service';
import { usePluginContext } from '../../../../../client/context/plugin-context';

interface WizardServiceContextValue {
  wizardService: TemplateWizardService | null;
}

const WizardServiceContext = createContext<WizardServiceContextValue>({
  wizardService: null
});

export interface WizardServiceProviderProps {
  children: React.ReactNode;
}

export const WizardServiceProvider: React.FC<WizardServiceProviderProps> = ({ children }) => {
  const pluginContext = usePluginContext();

  const wizardService = useMemo(() => {
    if (!pluginContext) return null;

    // Get required services from plugin context
    const { logger, eventBus, services } = pluginContext;
    const { aiService, storageService } = services;

    // Get Alfred-specific services
    const templateEngine = services.get('alfred.templateEngine');
    const discoveryService = services.get('alfred.discoveryService');
    const variableResolver = services.get('alfred.variableResolver');

    if (!templateEngine || !discoveryService || !variableResolver || !storageService) {
      logger.warn('Required services not available for wizard');
      return null;
    }

    return new TemplateWizardService(
      logger,
      eventBus,
      templateEngine,
      discoveryService,
      variableResolver,
      storageService,
      aiService
    );
  }, [pluginContext]);

  return (
    <WizardServiceContext.Provider value={{ wizardService }}>
      {children}
    </WizardServiceContext.Provider>
  );
};

/**
 * Hook to access wizard service
 */
export const useWizardService = () => {
  const { wizardService } = useContext(WizardServiceContext);

  if (!wizardService) {
    throw new Error(
      'WizardService not available. Make sure WizardServiceProvider is in the component tree.'
    );
  }

  return wizardService;
};

/**
 * Hook to optionally access wizard service
 */
export const useWizardServiceOptional = () => {
  const { wizardService } = useContext(WizardServiceContext);
  return wizardService;
};
