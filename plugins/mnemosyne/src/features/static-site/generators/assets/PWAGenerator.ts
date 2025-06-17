/**
 * PWA Asset Generator
 * Generates Progressive Web App assets (manifest, service worker, icons)
 */

import { PWAConfig } from './types';
import sharp from 'sharp';
import * as fs from 'fs/promises';
import * as path from 'path';

export class PWAGenerator {
  /**
   * Generate all PWA assets
   */
  async generatePWAAssets(
    config: PWAConfig,
    outputDir: string
  ): Promise<Array<{
    path: string;
    content: string | Buffer;
    type: string;
  }>> {
    const assets = [];

    // Generate manifest.json
    const manifest = await this.generateManifest(config);
    assets.push({
      path: path.join(outputDir, 'manifest.json'),
      content: manifest,
      type: 'application/json'
    });

    // Generate service worker
    const serviceWorker = await this.generateServiceWorker(config);
    assets.push({
      path: path.join(outputDir, 'sw.js'),
      content: serviceWorker,
      type: 'application/javascript'
    });

    // Generate icons if source icon provided
    if (config.icons && config.icons.length > 0) {
      const iconAssets = await this.generateIcons(
        config.icons[0].src,
        outputDir
      );
      assets.push(...iconAssets);
    }

    return assets;
  }

  /**
   * Generate web app manifest
   */
  private async generateManifest(config: PWAConfig): Promise<string> {
    const manifest = {
      name: config.name,
      short_name: config.shortName,
      description: config.description,
      start_url: config.startUrl,
      display: config.display,
      theme_color: config.themeColor,
      background_color: config.backgroundColor,
      icons: config.icons || this.getDefaultIconSizes().map(size => ({
        src: `/icons/icon-${size}x${size}.png`,
        sizes: `${size}x${size}`,
        type: 'image/png'
      })),
      categories: ['education', 'productivity'],
      orientation: 'any',
      lang: 'en-US',
      dir: 'auto'
    };

    return JSON.stringify(manifest, null, 2);
  }

  /**
   * Generate service worker
   */
  private async generateServiceWorker(config: PWAConfig): Promise<string> {
    return `
// Service Worker - Generated for ${config.name}
const CACHE_NAME = 'mnemosyne-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/assets/css/theme.css',
  '/assets/js/bundle.js',
  '/manifest.json'
];

// Install event - cache resources
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }

        // Clone the request
        const fetchRequest = event.request.clone();

        return fetch(fetchRequest).then(response => {
          // Check if valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clone the response
          const responseToCache = response.clone();

          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });

          return response;
        });
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];

  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Background sync for offline actions
self.addEventListener('sync', event => {
  if (event.tag === 'sync-notes') {
    event.waitUntil(syncNotes());
  }
});

async function syncNotes() {
  // Implement note synchronization logic
  console.log('Syncing notes...');
}

// Push notifications
self.addEventListener('push', event => {
  const options = {
    body: event.data ? event.data.text() : 'New update available',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'View',
        icon: '/icons/checkmark.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/icons/xmark.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('${config.name}', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'explore') {
    // Open the app
    event.waitUntil(
      clients.openWindow('${config.startUrl}')
    );
  }
});
`;
  }

  /**
   * Generate app icons in multiple sizes
   */
  private async generateIcons(
    sourceIcon: string,
    outputDir: string
  ): Promise<Array<{
    path: string;
    content: Buffer;
    type: string;
  }>> {
    const sizes = this.getDefaultIconSizes();
    const iconDir = path.join(outputDir, 'icons');
    const assets = [];

    // Ensure icons directory exists
    await fs.mkdir(iconDir, { recursive: true });

    for (const size of sizes) {
      try {
        const iconBuffer = await sharp(sourceIcon)
          .resize(size, size, {
            fit: 'contain',
            background: { r: 255, g: 255, b: 255, alpha: 0 }
          })
          .png()
          .toBuffer();

        assets.push({
          path: path.join(iconDir, `icon-${size}x${size}.png`),
          content: iconBuffer,
          type: 'image/png'
        });
      } catch (error) {
        console.error(`Failed to generate ${size}x${size} icon:`, error);
      }
    }

    // Generate maskable icon
    try {
      const maskableBuffer = await sharp(sourceIcon)
        .resize(512, 512, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        })
        .png()
        .toBuffer();

      assets.push({
        path: path.join(iconDir, 'icon-maskable.png'),
        content: maskableBuffer,
        type: 'image/png'
      });
    } catch (error) {
      console.error('Failed to generate maskable icon:', error);
    }

    return assets;
  }

  /**
   * Get default icon sizes
   */
  private getDefaultIconSizes(): number[] {
    return [72, 96, 128, 144, 152, 192, 384, 512];
  }

  /**
   * Generate offline page
   */
  async generateOfflinePage(siteName: string): Promise<string> {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Offline - ${siteName}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: #f5f5f5;
    }
    .offline-message {
      text-align: center;
      padding: 2rem;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      max-width: 400px;
    }
    .offline-icon {
      font-size: 4rem;
      margin-bottom: 1rem;
    }
    h1 {
      color: #333;
      margin: 0 0 1rem;
    }
    p {
      color: #666;
      margin: 0 0 1.5rem;
    }
    button {
      background: #0066cc;
      color: white;
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: 4px;
      font-size: 1rem;
      cursor: pointer;
    }
    button:hover {
      background: #0052a3;
    }
  </style>
</head>
<body>
  <div class="offline-message">
    <div class="offline-icon">📵</div>
    <h1>You're Offline</h1>
    <p>It looks like you've lost your internet connection. Some features may be unavailable until you're back online.</p>
    <button onclick="location.reload()">Try Again</button>
  </div>
  <script>
    // Check for connection periodically
    setInterval(() => {
      if (navigator.onLine) {
        location.reload();
      }
    }, 5000);
  </script>
</body>
</html>`;
  }
}