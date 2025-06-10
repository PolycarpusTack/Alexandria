/**
 * Alfred Dashboard - Main UI component for the Alfred plugin
 * Enhanced with all features from original Alfred
 */
import React from 'react';
declare global {
    interface Window {
        getAlfredSessions?: () => any[];
        createAlfredSession?: (projectPath?: string) => any;
    }
}
export declare function AlfredDashboard(): React.JSX.Element;
