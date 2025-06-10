// Quick script to reset the layout to enhanced-mockup
console.log('Resetting Alexandria layout to enhanced-mockup...');

// Clear the existing layout preference
if (typeof window !== 'undefined' && window.localStorage) {
  window.localStorage.removeItem('alexandria-layout-mode');
  console.log('Layout preference cleared. The app will now use the enhanced-mockup layout by default.');
} else {
  console.log('This script should be run in the browser console.');
  console.log('Open Alexandria in your browser, press F12, go to Console tab, and run:');
  console.log('localStorage.removeItem("alexandria-layout-mode");');
  console.log('Then refresh the page.');
}