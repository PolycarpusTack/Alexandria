import React, { createContext, useContext } from 'react';

interface PluginContextType {
  pluginId: string;
  api: any;
}

const PluginContext = createContext<PluginContextType | null>(null);

export function PluginProvider({ 
  children, 
  pluginId, 
  api 
}: { 
  children: React.ReactNode;
  pluginId: string;
  api: any;
}) {
  return (
    <PluginContext.Provider value={{ pluginId, api }}>
      {children}
    </PluginContext.Provider>
  );
}

export function usePlugin() {
  const context = useContext(PluginContext);
  if (!context) {
    throw new Error('usePlugin must be used within a PluginProvider');
  }
  return context;
}

// Alias for backward compatibility
export const usePluginContext = usePlugin;

export { PluginContext };