/**
 * ROM Agent - Service Worker v7.0.0
 *
 * Estrategias de Cache Completas para App Juridico:
 * - Network First: HTML/JS/CSS (codigo sempre atualizado)
 * - Cache First: Assets estaticos (fonts, imagens - performance)
 * - Stale While Revalidate: Recursos secundarios
 * - API: Network only com fallback offline
 *
 * Features:
 * - Suporte iOS PWA com splash screens
 * - Sincronizacao em background
 * - Notificacoes push
 * - Offline fallback page
 * - Precache de recursos criticos
 *
 * @version 7.0.0 - Complete Cache Strategies
 */

const VERSION = 'v8.1.0'; // CRITICAL: Force cache clear + Base64 flag reset fix
const STATIC_CACHE = `rom-agent-static-${VERSION}`;
const RUNTIME_CACHE = `rom-agent-runtime-${VERSION}`;
const OFFLINE_CACHE = `rom-agent-offline-${VERSION}`;

// iOS detection
const isIOS = /iPad|iPhone|iPod/.test(self.navigator.userAgent);

// ===== CACHE CONFIGURATION =====

// Critical assets to precache
const PRECACHE_ASSETS = [
  '/',
  '/manifest.json',
  '/icons/icon-180x180.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// iOS Splash Screens (optional - fail gracefully)
const IOS_SPLASH_SCREENS = [
  '/splash/iphone-14-pro-max-portrait.png',
  '/splash/iphone-14-pro-portrait.png',
  '/splash/iphone-13-portrait.png',
  '/splash/iphone-x-portrait.png',
  '/splash/iphone-11-portrait.png',
  '/splash/iphone-8-portrait.png',
];

// Font URLs to cache
const FONT_ORIGINS = [
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
];

// Cache time limits (in ms)
const CACHE_EXPIRATION = {
  FONTS: 30 * 24 * 60 * 60 * 1000, // 30 days
  IMAGES: 7 * 24 * 60 * 60 * 1000,  // 7 days
  API: 5 * 60 * 1000,               // 5 minutes (for offline fallback)
};

// Offline fallback HTML
const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="theme-color" content="#D97706">
  <title>Sem Conexao - ROM Agent</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      min-height: -webkit-fill-available;
      margin: 0;
      background: linear-gradient(135deg, #fafaf9 0%, #f5f5f4 100%);
      color: #292524;
      padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
    }
    .container {
      text-align: center;
      padding: 2rem;
      max-width: 400px;
    }
    .icon {
      font-size: 4rem;
      margin-bottom: 1.5rem;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    h1 {
      font-size: 1.5rem;
      font-weight: 600;
      margin-bottom: 0.75rem;
      color: #44403c;
    }
    p {
      color: #78716c;
      margin-bottom: 0.5rem;
      line-height: 1.5;
    }
    .actions {
      margin-top: 2rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    button {
      padding: 0.875rem 1.5rem;
      background: #d97706;
      color: white;
      border: none;
      border-radius: 0.75rem;
      font-size: 1rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      -webkit-tap-highlight-color: transparent;
    }
    button:hover {
      background: #b45309;
      transform: translateY(-1px);
    }
    button:active {
      transform: translateY(0);
    }
    .secondary {
      background: transparent;
      color: #78716c;
      border: 1px solid #d6d3d1;
    }
    .secondary:hover {
      background: #f5f5f4;
    }
    .status {
      margin-top: 2rem;
      padding: 1rem;
      background: #fef3c7;
      border-radius: 0.5rem;
      font-size: 0.875rem;
      color: #92400e;
    }
    .status.online {
      background: #d1fae5;
      color: #065f46;
    }
    .hidden { display: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">&#128268;</div>
    <h1>Sem Conexao com a Internet</h1>
    <p>O ROM Agent precisa de conexao para funcionar.</p>
    <p>Verifique sua internet e tente novamente.</p>

    <div class="actions">
      <button onclick="location.reload()">Tentar Novamente</button>
      <button class="secondary" onclick="checkStatus()">Verificar Conexao</button>
    </div>

    <div id="status" class="status hidden"></div>
  </div>

  <script>
    // Check connection status
    function checkStatus() {
      const statusEl = document.getElementById('status');
      statusEl.classList.remove('hidden', 'online');
      statusEl.textContent = 'Verificando conexao...';

      if (navigator.onLine) {
        statusEl.classList.add('online');
        statusEl.textContent = 'Conexao detectada! Recarregando...';
        setTimeout(() => location.reload(), 1000);
      } else {
        statusEl.textContent = 'Ainda sem conexao. Verifique seu Wi-Fi ou dados moveis.';
      }
    }

    // Auto-reload when back online
    window.addEventListener('online', () => {
      const statusEl = document.getElementById('status');
      statusEl.classList.remove('hidden');
      statusEl.classList.add('online');
      statusEl.textContent = 'Conexao restaurada! Recarregando...';
      setTimeout(() => location.reload(), 1000);
    });

    // Show offline message
    window.addEventListener('offline', () => {
      const statusEl = document.getElementById('status');
      statusEl.classList.remove('hidden', 'online');
      statusEl.textContent = 'Conexao perdida.';
    });
  </script>
</body>
</html>`;

// ===== HELPER FUNCTIONS =====

/**
 * Check if request is for API
 */
function isApiRequest(url) {
  return url.pathname.startsWith('/api/');
}

/**
 * Check if request is for streaming
 */
function isStreamingRequest(url) {
  return url.pathname.includes('/stream') ||
         url.pathname.includes('/chat/stream') ||
         url.pathname.includes('/api/chat-stream') ||
         url.pathname.includes('/sse');
}

/**
 * Check if request is for fonts
 */
function isFontRequest(url) {
  return FONT_ORIGINS.some(origin => url.href.includes(origin));
}

/**
 * Check if request is for static assets
 */
function isStaticAsset(url) {
  return /\.(png|jpg|jpeg|svg|ico|webp|woff|woff2|ttf|eot)$/i.test(url.pathname);
}

/**
 * Check if request is for app shell (HTML/JS/CSS)
 */
function isAppShell(request, url) {
  return url.pathname.endsWith('.html') ||
         url.pathname.endsWith('.js') ||
         url.pathname.endsWith('.css') ||
         url.pathname === '/' ||
         request.mode === 'navigate';
}

/**
 * Add timestamp to cached response for expiration check
 */
function addTimestamp(response) {
  const headers = new Headers(response.headers);
  headers.set('sw-cached-at', Date.now().toString());
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Check if cached response is expired
 */
function isCacheExpired(response, maxAge) {
  const cachedAt = response.headers.get('sw-cached-at');
  if (!cachedAt) return true;
  return Date.now() - parseInt(cachedAt) > maxAge;
}

// ===== CACHE STRATEGIES =====

/**
 * Network First - Try network, fallback to cache
 * Used for: App shell (HTML/JS/CSS)
 * Respeita Cache-Control headers do servidor
 */
async function networkFirst(request, cacheName = RUNTIME_CACHE) {
  try {
    const response = await fetch(request);
    if (response.ok && request.method === 'GET') {
      // NÃO cachear se servidor manda no-cache/no-store
      const cacheControl = response.headers.get('Cache-Control') || '';
      const shouldNotCache = cacheControl.includes('no-store') ||
                             cacheControl.includes('no-cache') ||
                             cacheControl.includes('must-revalidate');

      if (!shouldNotCache) {
        const cache = await caches.open(cacheName);
        cache.put(request, response.clone());
      }
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    throw error;
  }
}

/**
 * Cache First - Try cache, fallback to network
 * Used for: Static assets (images, fonts)
 */
async function cacheFirst(request, cacheName = STATIC_CACHE, maxAge = CACHE_EXPIRATION.IMAGES) {
  const cached = await caches.match(request);

  if (cached && !isCacheExpired(cached, maxAge)) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok && request.method === 'GET') {
      const cache = await caches.open(cacheName);
      cache.put(request, addTimestamp(response.clone()));
    }
    return response;
  } catch (error) {
    if (cached) {
      return cached;
    }
    throw error;
  }
}

/**
 * Stale While Revalidate - Return cache immediately, update in background
 * Used for: Secondary resources
 */
async function staleWhileRevalidate(request, cacheName = RUNTIME_CACHE) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then(response => {
      if (response.ok && request.method === 'GET') {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);

  return cached || fetchPromise;
}

/**
 * Network Only with Offline Fallback
 * Used for: API requests
 */
async function networkOnlyWithFallback(request) {
  try {
    return await fetch(request);
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: 'Sem conexao',
        message: 'Voce esta offline. Verifique sua conexao com a internet.',
        offline: true,
        timestamp: Date.now(),
      }),
      {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'X-Offline': 'true',
        },
      }
    );
  }
}

// ===== SERVICE WORKER EVENTS =====

/**
 * Install Event - Precache critical assets
 */
self.addEventListener('install', (event) => {
  console.log(`[SW ${VERSION}] Installing... iOS: ${isIOS}`);

  // CRITICAL: Force immediate activation to fix upload blocking
  self.skipWaiting();

  event.waitUntil(
    Promise.all([
      // Precache critical assets
      caches.open(STATIC_CACHE).then(async (cache) => {
        // Add critical assets
        for (const asset of PRECACHE_ASSETS) {
          try {
            await cache.add(asset);
          } catch (err) {
            console.warn(`[SW] Failed to cache ${asset}:`, err.message);
          }
        }

        // Add iOS splash screens (optional)
        if (isIOS) {
          for (const splash of IOS_SPLASH_SCREENS) {
            try {
              await cache.add(splash);
            } catch (err) {
              // Splash screens are optional
              console.debug(`[SW] iOS splash not available: ${splash}`);
            }
          }
        }
      }),

      // Cache offline page
      caches.open(OFFLINE_CACHE).then((cache) => {
        return cache.put(
          new Request('/offline.html'),
          new Response(OFFLINE_HTML, {
            headers: { 'Content-Type': 'text/html' },
          })
        );
      }),
    ])
  );
});

/**
 * Activate Event - Clean old caches, take control
 */
self.addEventListener('activate', (event) => {
  console.log(`[SW ${VERSION}] Activating...`);

  event.waitUntil(
    Promise.all([
      // Clean old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => {
              return name.startsWith('rom-agent-') &&
                     name !== STATIC_CACHE &&
                     name !== RUNTIME_CACHE &&
                     name !== OFFLINE_CACHE;
            })
            .map((name) => {
              console.log(`[SW] Deleting old cache: ${name}`);
              return caches.delete(name);
            })
        );
      }),

      // Take control immediately
      self.clients.claim(),
    ])
  );
});

/**
 * Fetch Event - Handle all network requests
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests for caching (uploads devem passar direto)
  // ✅ FIX: POST/PUT não são interceptados pelo SW para evitar timeouts em uploads
  if (request.method !== 'GET') {
    return; // Deixa passar direto sem interceptar
  }

  // Skip streaming requests entirely
  if (isStreamingRequest(url)) {
    return;
  }

  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // API Requests - Network only with offline fallback (somente GET)
  if (isApiRequest(url)) {
    event.respondWith(networkOnlyWithFallback(request));
    return;
  }

  // Font Requests - Cache first with long TTL
  if (isFontRequest(url)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE, CACHE_EXPIRATION.FONTS));
    return;
  }

  // Static Assets (images, icons) - Cache first
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE, CACHE_EXPIRATION.IMAGES));
    return;
  }

  // App Shell (HTML/JS/CSS) - Network first with offline fallback
  if (isAppShell(request, url)) {
    event.respondWith(
      networkFirst(request, RUNTIME_CACHE)
        .catch(async () => {
          // Try offline page for navigation requests
          if (request.mode === 'navigate') {
            const offlinePage = await caches.match('/offline.html');
            if (offlinePage) {
              return offlinePage;
            }
          }

          // Return offline HTML as last resort
          return new Response(OFFLINE_HTML, {
            headers: { 'Content-Type': 'text/html' },
          });
        })
    );
    return;
  }

  // Other requests - Stale while revalidate
  event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
});

// ===== BACKGROUND SYNC =====

/**
 * Sync Event - Process pending offline actions
 */
self.addEventListener('sync', (event) => {
  console.log(`[SW] Sync event: ${event.tag}`);

  if (event.tag === 'rom-agent-sync') {
    event.waitUntil(syncPendingActions());
  }
});

/**
 * Sync pending actions from IndexedDB
 */
async function syncPendingActions() {
  try {
    // Notify clients to sync
    const clients = await self.clients.matchAll({ type: 'window' });
    for (const client of clients) {
      client.postMessage({
        type: 'SYNC_REQUESTED',
        timestamp: Date.now(),
      });
    }
  } catch (error) {
    console.error('[SW] Sync failed:', error);
  }
}

// ===== PUSH NOTIFICATIONS =====

/**
 * Push Event - Handle push notifications
 */
self.addEventListener('push', (event) => {
  let data = {
    title: 'ROM Agent',
    body: 'Nova notificacao',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-180x180.png',
  };

  try {
    if (event.data) {
      const payload = event.data.json();
      data = { ...data, ...payload };
    }
  } catch (e) {
    if (event.data) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icons/icon-192x192.png',
    badge: data.badge || '/icons/icon-180x180.png',
    vibrate: [100, 50, 100],
    tag: data.tag || 'rom-agent-notification',
    renotify: true,
    requireInteraction: false,
    data: {
      url: data.url || '/',
      dateOfArrival: Date.now(),
      ...data.data,
    },
    actions: data.actions || [],
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

/**
 * Notification Click - Handle notification interactions
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Focus existing window if available
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        // Open new window
        if (self.clients.openWindow) {
          return self.clients.openWindow(url);
        }
      })
  );
});

// ===== MESSAGE HANDLING =====

/**
 * Message Event - Handle messages from clients
 */
self.addEventListener('message', (event) => {
  const { type, data } = event.data || {};

  console.log(`[SW ${VERSION}] 📨 Mensagem recebida:`, { type, data });

  switch (type) {
    case 'SKIP_WAITING':
      console.log(`[SW ${VERSION}] 🚀 SKIP_WAITING recebido - ativando novo SW...`);
      self.skipWaiting()
        .then(() => {
          console.log(`[SW ${VERSION}] ✅ skipWaiting() completado`);
          // Claim clients imediatamente
          return self.clients.claim();
        })
        .then(() => {
          console.log(`[SW ${VERSION}] ✅ clients.claim() completado`);
        })
        .catch((err) => {
          console.error(`[SW ${VERSION}] ❌ Erro em skipWaiting/claim:`, err);
        });
      break;

    case 'GET_VERSION':
      event.ports[0]?.postMessage({ version: VERSION });
      break;

    case 'CLEAR_CACHE':
      caches.keys()
        .then(names => Promise.all(names.map(name => caches.delete(name))))
        .then(() => {
          event.ports[0]?.postMessage({ success: true });
        });
      break;

    case 'CACHE_URLS':
      if (Array.isArray(data?.urls)) {
        caches.open(RUNTIME_CACHE)
          .then(cache => cache.addAll(data.urls))
          .then(() => {
            event.ports[0]?.postMessage({ success: true });
          })
          .catch(err => {
            event.ports[0]?.postMessage({ success: false, error: err.message });
          });
      }
      break;

    default:
      console.log(`[SW] Unknown message type: ${type}`);
  }
});

// ===== PERIODIC SYNC (if supported) =====

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'rom-agent-periodic-sync') {
    event.waitUntil(syncPendingActions());
  }
});

console.log(`[SW ${VERSION}] Service Worker loaded`);
