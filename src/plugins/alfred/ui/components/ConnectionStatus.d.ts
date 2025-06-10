/**
 * Connection Status Indicator Component
 *
 * Shows real-time AI service connection status
 * Based on original Alfred's connection status display
 */
import React from 'react';
export interface ConnectionInfo {
    status: 'connected' | 'disconnected' | 'connecting' | 'error';
    provider: string;
    model: string;
    latency?: number;
    lastChecked?: Date;
    error?: string;
    apiEndpoint?: string;
}
interface ConnectionStatusProps {
    className?: string;
    showDetails?: boolean;
    compact?: boolean;
    refreshInterval?: number;
}
export declare const ConnectionStatus: React.FC<ConnectionStatusProps>;
export declare const ConnectionStatusMini: React.FC;
export declare const ConnectionStatusDetailed: React.FC;
export {};
