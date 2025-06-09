#!/usr/bin/env node

console.log(`
To see the new UI changes:

1. Clear your browser cache:
   - Chrome/Edge: Ctrl+Shift+Delete
   - Or: F12 > Network tab > Right-click > Clear browser cache
   
2. Clear localStorage:
   - F12 > Console > Type: localStorage.clear()
   
3. Hard refresh the page:
   - Ctrl+Shift+R (Windows/Linux)
   - Cmd+Shift+R (Mac)
   
4. If you're still seeing the old UI:
   - Close all browser tabs
   - Restart the dev server (Ctrl+C then pnpm dev)
   - Open a new incognito/private window
   - Navigate to http://localhost:3000

The new UI features:
- Modern VSCode/Notion style sidebar
- Functional LLM Models page with real UI
- Settings page with all options
- Smaller logo (48x48px)
- Proper button styling and alignment
- Dark/light theme support
- Collapsible sidebar (Ctrl+B)
- Global search (Ctrl+/)
- Command palette (Ctrl+K)
`);