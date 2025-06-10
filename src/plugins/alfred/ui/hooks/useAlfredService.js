"use strict";
/**
 * React hook for accessing Alfred service
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.useAlfredService = useAlfredService;
const react_1 = require("react");
const plugin_context_1 = require("../../../../client/context/plugin-context");
function useAlfredService() {
    const context = (0, react_1.useContext)(plugin_context_1.PluginContext);
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
