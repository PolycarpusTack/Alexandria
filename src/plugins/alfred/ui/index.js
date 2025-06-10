"use strict";
/**
 * Alfred UI Plugin Entry Point
 * This file serves as the main entry point for the Alfred UI plugin
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlfredApp = void 0;
const AlfredApp_1 = require("./AlfredApp");
// Export the component directly for Vite to bundle
exports.AlfredApp = AlfredApp_1.AlfredApp;
// Default export for dynamic imports
exports.default = exports.AlfredApp;
