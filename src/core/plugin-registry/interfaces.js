"use strict";
/**
 * Plugin Registry interfaces for the Alexandria Platform
 *
 * These interfaces define the plugin system architecture and how plugins
 * interact with the core platform.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PluginState = void 0;
/**
 * Plugin state enum
 */
var PluginState;
(function (PluginState) {
    PluginState["DISCOVERED"] = "discovered";
    PluginState["INSTALLED"] = "installed";
    PluginState["ACTIVE"] = "active";
    PluginState["INACTIVE"] = "inactive";
    PluginState["NEEDS_UPDATE"] = "needs_update";
    PluginState["ERRORED"] = "errored";
})(PluginState || (exports.PluginState = PluginState = {}));
//# sourceMappingURL=interfaces.js.map