// Runtime patch for util._extend deprecation warning
// This file patches util._extend to use Object.assign while suppressing the deprecation warning

const util = require('util');

// Store the original _extend function
const originalExtend = util._extend;

// Replace util._extend with Object.assign
util._extend = function(target, source) {
  // Use Object.assign which is the modern replacement
  return Object.assign(target, source);
};

// Optionally log when it's used (comment out in production)
if (process.env.NODE_ENV === 'development' && process.env.DEBUG_DEPRECATION) {
  const originalFunction = util._extend;
  util._extend = function(target, source) {
    console.trace('util._extend called from:');
    return originalFunction(target, source);
  };
}

console.log('✅ util._extend deprecation patch applied');

module.exports = {
  // Export the patch status
  patched: true,
  originalExtend
};