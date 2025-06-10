"use strict";
/**
 * Connection Status Indicator Component
 *
 * Shows real-time AI service connection status
 * Based on original Alfred's connection status display
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConnectionStatusDetailed = exports.ConnectionStatusMini = exports.ConnectionStatus = void 0;
const react_1 = __importStar(require("react"));
const badge_1 = require("../../../../client/components/ui/badge");
const tooltip_1 = require("../../../../client/components/ui/tooltip");
const lucide_react_1 = require("lucide-react");
const useAlfredService_1 = require("../hooks/useAlfredService");
const ConnectionStatus = ({ className = '', showDetails = true, compact = false, refreshInterval = 30000 // 30 seconds
 }) => {
    const alfredService = (0, useAlfredService_1.useAlfredService)();
    const [connectionInfo, setConnectionInfo] = (0, react_1.useState)({
        status: 'connecting',
        provider: 'Unknown',
        model: 'Unknown'
    });
    const [isChecking, setIsChecking] = (0, react_1.useState)(false);
    // Check connection status
    const checkConnection = async () => {
        if (isChecking)
            return;
        setIsChecking(true);
        const startTime = Date.now();
        try {
            // Ping the AI service
            const aiService = alfredService.getAIService();
            if (!aiService) {
                throw new Error('AI service not available');
            }
            // Try a simple test query
            const testResponse = await aiService.query('Test connection', {
                maxTokens: 1,
                temperature: 0
            });
            const latency = Date.now() - startTime;
            setConnectionInfo({
                status: 'connected',
                provider: aiService.getProvider() || 'Unknown',
                model: aiService.getCurrentModel() || 'Unknown',
                latency,
                lastChecked: new Date(),
                apiEndpoint: aiService.getEndpoint?.() || undefined
            });
        }
        catch (error) {
            setConnectionInfo(prev => ({
                ...prev,
                status: 'error',
                error: error.message || 'Connection failed',
                lastChecked: new Date()
            }));
        }
        finally {
            setIsChecking(false);
        }
    };
    // Initial check and periodic updates
    (0, react_1.useEffect)(() => {
        checkConnection();
        const interval = setInterval(checkConnection, refreshInterval);
        return () => clearInterval(interval);
    }, [refreshInterval]);
    // Listen for AI service events
    (0, react_1.useEffect)(() => {
        const handleConnected = (data) => {
            setConnectionInfo(prev => ({
                ...prev,
                status: 'connected',
                provider: data.provider,
                model: data.model
            }));
        };
        const handleDisconnected = () => {
            setConnectionInfo(prev => ({
                ...prev,
                status: 'disconnected'
            }));
        };
        const handleError = (data) => {
            setConnectionInfo(prev => ({
                ...prev,
                status: 'error',
                error: data.error
            }));
        };
        alfredService.on('ai:connected', handleConnected);
        alfredService.on('ai:disconnected', handleDisconnected);
        alfredService.on('ai:error', handleError);
        return () => {
            alfredService.off('ai:connected', handleConnected);
            alfredService.off('ai:disconnected', handleDisconnected);
            alfredService.off('ai:error', handleError);
        };
    }, [alfredService]);
    const getStatusIcon = () => {
        if (isChecking) {
            return react_1.default.createElement(lucide_react_1.Loader2, { className: "h-4 w-4 animate-spin" });
        }
        switch (connectionInfo.status) {
            case 'connected':
                return react_1.default.createElement(lucide_react_1.Wifi, { className: "h-4 w-4 text-green-500" });
            case 'disconnected':
                return react_1.default.createElement(lucide_react_1.WifiOff, { className: "h-4 w-4 text-gray-500" });
            case 'connecting':
                return react_1.default.createElement(lucide_react_1.Loader2, { className: "h-4 w-4 animate-spin text-blue-500" });
            case 'error':
                return react_1.default.createElement(lucide_react_1.AlertCircle, { className: "h-4 w-4 text-red-500" });
        }
    };
    const getStatusText = () => {
        switch (connectionInfo.status) {
            case 'connected':
                return 'Connected';
            case 'disconnected':
                return 'Disconnected';
            case 'connecting':
                return 'Connecting...';
            case 'error':
                return 'Error';
        }
    };
    const getStatusColor = () => {
        switch (connectionInfo.status) {
            case 'connected':
                return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100';
            case 'disconnected':
                return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100';
            case 'connecting':
                return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100';
            case 'error':
                return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100';
        }
    };
    const formatLatency = (latency) => {
        if (!latency)
            return 'N/A';
        if (latency < 1000)
            return `${latency}ms`;
        return `${(latency / 1000).toFixed(1)}s`;
    };
    const formatLastChecked = (date) => {
        if (!date)
            return 'Never';
        const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
        if (seconds < 60)
            return 'Just now';
        if (seconds < 3600)
            return `${Math.floor(seconds / 60)}m ago`;
        return `${Math.floor(seconds / 3600)}h ago`;
    };
    if (compact) {
        return (react_1.default.createElement(tooltip_1.Tooltip, null,
            react_1.default.createElement(tooltip_1.Tooltip.Trigger, { asChild: true },
                react_1.default.createElement("div", { className: `flex items-center gap-1 cursor-pointer ${className}` }, getStatusIcon())),
            react_1.default.createElement(tooltip_1.Tooltip.Content, null,
                react_1.default.createElement("div", { className: "text-sm" },
                    react_1.default.createElement("div", { className: "font-medium" }, getStatusText()),
                    connectionInfo.status === 'connected' && (react_1.default.createElement(react_1.default.Fragment, null,
                        react_1.default.createElement("div", null,
                            connectionInfo.provider,
                            " - ",
                            connectionInfo.model),
                        react_1.default.createElement("div", null,
                            "Latency: ",
                            formatLatency(connectionInfo.latency)))),
                    connectionInfo.error && (react_1.default.createElement("div", { className: "text-red-500" }, connectionInfo.error))))));
    }
    return (react_1.default.createElement("div", { className: `alfred-connection-status ${className}` },
        react_1.default.createElement(badge_1.Badge, { variant: "outline", className: `${getStatusColor()} cursor-pointer`, onClick: checkConnection },
            react_1.default.createElement("div", { className: "flex items-center gap-2" },
                getStatusIcon(),
                react_1.default.createElement("span", { className: "font-medium" }, getStatusText()))),
        showDetails && connectionInfo.status === 'connected' && (react_1.default.createElement("div", { className: "mt-2 space-y-1 text-sm text-muted-foreground" },
            react_1.default.createElement("div", { className: "flex items-center gap-2" },
                react_1.default.createElement(lucide_react_1.Server, { className: "h-3 w-3" }),
                react_1.default.createElement("span", null, connectionInfo.provider)),
            react_1.default.createElement("div", { className: "flex items-center gap-2" },
                react_1.default.createElement(lucide_react_1.Zap, { className: "h-3 w-3" }),
                react_1.default.createElement("span", null, connectionInfo.model)),
            react_1.default.createElement("div", { className: "flex items-center gap-2" },
                react_1.default.createElement(lucide_react_1.Clock, { className: "h-3 w-3" }),
                react_1.default.createElement("span", null,
                    "Latency: ",
                    formatLatency(connectionInfo.latency))),
            connectionInfo.apiEndpoint && (react_1.default.createElement("div", { className: "flex items-center gap-2" },
                react_1.default.createElement(lucide_react_1.CheckCircle, { className: "h-3 w-3" }),
                react_1.default.createElement("span", { className: "truncate text-xs" }, connectionInfo.apiEndpoint))),
            react_1.default.createElement("div", { className: "text-xs opacity-70" },
                "Last checked: ",
                formatLastChecked(connectionInfo.lastChecked)))),
        connectionInfo.status === 'error' && connectionInfo.error && (react_1.default.createElement("div", { className: "mt-2 text-sm text-red-500" }, connectionInfo.error))));
};
exports.ConnectionStatus = ConnectionStatus;
// Mini version for header/status bar
const ConnectionStatusMini = () => {
    return react_1.default.createElement(exports.ConnectionStatus, { compact: true, showDetails: false });
};
exports.ConnectionStatusMini = ConnectionStatusMini;
// Detailed version for settings/dashboard
const ConnectionStatusDetailed = () => {
    const alfredService = (0, useAlfredService_1.useAlfredService)();
    const [availableModels, setAvailableModels] = (0, react_1.useState)([]);
    (0, react_1.useEffect)(() => {
        const fetchModels = async () => {
            try {
                const models = await alfredService.getAvailableModels();
                setAvailableModels(models);
            }
            catch (error) {
                console.error('Failed to fetch models:', error);
            }
        };
        fetchModels();
    }, [alfredService]);
    return (react_1.default.createElement("div", { className: "space-y-4" },
        react_1.default.createElement(exports.ConnectionStatus, { showDetails: true, refreshInterval: 10000 }),
        availableModels.length > 0 && (react_1.default.createElement("div", { className: "border rounded-lg p-4" },
            react_1.default.createElement("h4", { className: "font-medium mb-2" }, "Available Models"),
            react_1.default.createElement("div", { className: "space-y-1" }, availableModels.map(model => (react_1.default.createElement("div", { key: model, className: "text-sm text-muted-foreground" },
                "\u2022 ",
                model))))))));
};
exports.ConnectionStatusDetailed = ConnectionStatusDetailed;
