import React from 'react';
interface PluginContextType {
    pluginId: string;
    api: any;
}
declare const PluginContext: React.Context<PluginContextType | null>;
export declare function PluginProvider({ children, pluginId, api }: {
    children: React.ReactNode;
    pluginId: string;
    api: any;
}): React.JSX.Element;
export declare function usePlugin(): PluginContextType;
export declare const usePluginContext: typeof usePlugin;
export { PluginContext };
