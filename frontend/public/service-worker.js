/**
 * ROM Agent - Service Worker "Network First"
 *
 * Estratégia Otimizada para App Jurídico:
 * ✅ HTML/JS/CSS sempre da REDE (código sempre atualizado)
 * ✅ Assets estáticos em CACHE (fonts, imagens - performance)
 * ✅ API nunca cached (dados sempre frescos)
 * ✅ Mantém features PWA (instalável, notificações)
 *
 * @version 5.0.0 - Network First
 */

const VERSION = 'v5.0.0';
const STATIC_CACHE = `rom-agent-static-${VERSION}`;
const RUNTIME_CACHE = `rom-agent-runtime-${VERSION}`;

// Assets que PODEM ser cached (não mudam frequentemente)
const STATIC_ASSETS = [
  '/manifest.json',
  '/icons/icon-72.png',
  '/icons/icon-96.png',
  '/icons/icon-128.png',
  '/icons/icon-144.png',
  '/icons/icon-152.png',
  '/icons/icon-192.png',
  '/icons/icon-384.png',
  '/icons/icon-512.png',
];

// Fontes externas (podem ser cached)
const FONT_URLS = [
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
];

// ===== INSTALAÇÃO =====
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        return cache.addAll(STATIC_ASSETS).catch(() => {
          // Não falhar se alguns assets não existirem
        });
      })
      .then(() => self.skipWaiting())
  );
});

// ===== ATIVAÇÃO =====
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      // Limpar caches antigos
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => {
              // Deletar qualquer cache que não seja da versão atual
              return name.startsWith('rom-agent-') &&
                     name !== STATIC_CACHE &&
                     name !== RUNTIME_CACHE;
            })
            .map((name) => caches.delete(name))
        );
      }),

      // Tomar controle imediato
      self.clients.claim(),
    ])
  );
});

// ===== FETCH - ESTRATÉGIA NETWORK FIRST =====
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. API NUNCA cached - sempre da rede
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(
          JSON.stringify({ error: 'Sem conexão. Verifique sua internet.' }),
          { headers: { 'Content-Type': 'application/json' }, status: 503 }
        );
      })
    );
    return;
  }

  // 2. Fontes externas - Cache First (otimização)
  if (FONT_URLS.some(fontUrl => url.origin.includes(fontUrl))) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          return cached;
        }
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // 3. Assets estáticos (imagens, ícones) - Cache First
  if (url.pathname.match(/\.(png|jpg|jpeg|svg|ico|webp)$/)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          return cached;
        }
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // 4. HTML/JS/CSS - SEMPRE NETWORK FIRST (código atualizado)
  if (
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname === '/' ||
    request.mode === 'navigate'
  ) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Não cachear código - sempre buscar da rede
          return response;
        })
        .catch(() => {
          // Sem fallback - força conexão para código
          return new Response(
            `<!DOCTYPE html>
            <html>
            <head>
              <title>Sem Conexão - ROM Agent</title>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                body {
                  font-family: system-ui, -apple-system, sans-serif;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  min-height: 100vh;
                  margin: 0;
                  background: #fafaf9;
                  color: #292524;
                }
                .container {
                  text-align: center;
                  padding: 2rem;
                }
                h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
                p { color: #78716c; }
                button {
                  margin-top: 1rem;
                  padding: 0.75rem 1.5rem;
                  background: #0ea5e9;
                  color: white;
                  border: none;
                  border-radius: 0.5rem;
                  font-size: 1rem;
                  cursor: pointer;
                }
                button:hover { background: #0284c7; }
              </style>
            </head>
            <body>
              <div class="container">
                <h1>⚠️ Sem Conexão com a Internet</h1>
                <p>O ROM Agent precisa de conexão para funcionar.</p>
                <p>Verifique sua internet e tente novamente.</p>
                <button onclick="location.reload()">Tentar Novamente</button>
              </div>
            </body>
            </html>`,
            { headers: { 'Content-Type': 'text/html' } }
          );
        })
    );
    return;
  }

  // 5. Outros recursos - Network First com fallback para cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => {
        return caches.match(request);
      })
  );
});

// ===== NOTIFICAÇÕES PUSH =====
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'Nova notificação do ROM Agent',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1,
    },
  };

  event.waitUntil(
    self.registration.showNotification('ROM Agent', options)
  );
});

// ===== CLICK EM NOTIFICAÇÃO =====
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/')
  );
});
