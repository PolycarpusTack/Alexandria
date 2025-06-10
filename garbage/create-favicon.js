#!/usr/bin/env node

/**
 * Script to create favicon files from the Alexandria icon
 * This creates a reference for manual favicon generation
 */

console.log(`
To create proper favicon files from the Alexandria icon:

1. For best compatibility, use an online converter:
   - https://favicon.io/favicon-converter/
   - https://realfavicongenerator.net/
   
2. Upload the file: public/alexandria-icon.png

3. Generate the following files:
   - favicon.ico (16x16, 32x32, 48x48)
   - favicon-16x16.png
   - favicon-32x32.png
   - apple-touch-icon.png (180x180)
   - android-chrome-192x192.png
   - android-chrome-512x512.png

4. Place all generated files in the public/ directory

5. Update public/index.html with:
   <link rel="icon" type="image/x-icon" href="/favicon.ico">
   <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
   <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
   <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">

The current setup uses the PNG directly, which works in modern browsers,
but ICO format provides better compatibility with older browsers.
`);