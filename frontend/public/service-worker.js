/**
 * ROM Agent - Service Worker KILL SWITCH
 *
 * Este SW se auto-desregistra e limpa todos os caches
 * Resolve o problema de cache infinito do browser
 *
 * Após este deploy, o SW será removido do browser do usuário
 */

console.log('🔴 ROM Agent: Service Worker KILL SWITCH ativado');

// Instalação: pular espera e ativar imediatamente
self.addEventListener('install', (event) => {
  console.log('🔴 SW Kill Switch: Instalando...');
  self.skipWaiting();
});

// Ativação: DELETAR TODOS OS CACHES e desregistrar
self.addEventListener('activate', (event) => {
  console.log('🔴 SW Kill Switch: Ativando e limpando TUDO...');

  event.waitUntil(
    Promise.all([
      // Deletar TODOS os caches
      caches.keys().then((cacheNames) => {
        console.log('🔴 SW Kill Switch: Deletando caches:', cacheNames);
        return Promise.all(
          cacheNames.map((cacheName) => {
            console.log('🔴 SW Kill Switch: Deletando:', cacheName);
            return caches.delete(cacheName);
          })
        );
      }),

      // Tomar controle de todos os clientes
      self.clients.claim(),

      // Desregistrar este Service Worker
      self.registration.unregister().then(() => {
        console.log('🔴 SW Kill Switch: Service Worker desregistrado com sucesso!');

        // Recarregar todos os clientes para limpar completamente
        return self.clients.matchAll().then((clients) => {
          clients.forEach((client) => {
            console.log('🔴 SW Kill Switch: Recarregando cliente:', client.url);
            client.navigate(client.url);
          });
        });
      })
    ]).then(() => {
      console.log('✅ SW Kill Switch: Limpeza completa! Browser vai recarregar sem Service Worker.');
    })
  );
});

// Fetch: NÃO CACHEAR NADA - passar direto para a rede
self.addEventListener('fetch', (event) => {
  console.log('🔴 SW Kill Switch: Fetch direto (sem cache):', event.request.url);
  event.respondWith(fetch(event.request));
});
