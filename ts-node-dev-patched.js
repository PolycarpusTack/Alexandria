#!/usr/bin/env node

// Apply deprecation patch before ts-node-dev starts
require('./scripts/deprecation-patch');

// Remove this script from argv to pass correct args to ts-node-dev
process.argv.splice(1, 1);

// Now run ts-node-dev
require('ts-node-dev/lib/bin');