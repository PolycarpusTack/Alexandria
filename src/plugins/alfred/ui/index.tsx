/**
 * Alfred UI Plugin Entry Point
 * This file serves as the main entry point for the Alfred UI plugin
 */

import React from 'react';
import { AlfredApp as AlfredAppComponent } from './AlfredApp';

// Export the component directly for Vite to bundle
export const AlfredApp = AlfredAppComponent;

// Default export for dynamic imports
export default AlfredApp;