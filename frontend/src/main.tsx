import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './styles/globals.css'
import { initOfflineManager } from '@/utils/offline-manager'

// Initialize offline manager
initOfflineManager().catch(console.error)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)

// ===== PWA SERVICE WORKER REGISTRATION =====

interface ServiceWorkerConfig {
  onUpdate?: (registration: ServiceWorkerRegistration) => void
  onSuccess?: (registration: ServiceWorkerRegistration) => void
  onOffline?: () => void
  onOnline?: () => void
}

async function registerServiceWorker(config?: ServiceWorkerConfig) {
  if (!('serviceWorker' in navigator)) {
    console.warn('[PWA] Service Worker nao suportado')
    return
  }

  // Only register in production
  if (!import.meta.env.PROD) {
    console.log('[PWA] Service Worker desabilitado em desenvolvimento')
    return
  }

  try {
    // CRITICAL: Add timestamp query param to bypass ALL caches (Cloudflare, browser, etc)
    const swUrl = `/service-worker.js?v=${Date.now()}`;
    console.log('[PWA] Registering Service Worker with cache bypass:', swUrl);

    const registration = await navigator.serviceWorker.register(swUrl, {
      scope: '/',
      updateViaCache: 'none',
    })

    console.log('[PWA] Service Worker registrado:', registration.scope)

    // CRITICAL: Force immediate update check to get v8.1.0 (fixes Base64 fallback)
    registration.update().then(() => {
      console.log('[PWA] Verificação de atualização forçada')
    }).catch((err) => {
      console.warn('[PWA] Erro ao forçar atualização:', err)
    })

    // Handle updates
    registration.onupdatefound = () => {
      const installingWorker = registration.installing
      if (!installingWorker) return

      installingWorker.onstatechange = () => {
        console.log(`[PWA] Worker state: ${installingWorker.state}`)

        if (installingWorker.state === 'installed') {
          if (navigator.serviceWorker.controller) {
            // New content available
            console.log('[PWA] Nova versao disponivel')
            config?.onUpdate?.(registration)

            // Show update notification (early return inside prevents duplicates)
            showUpdateNotification(registration)
          } else {
            // Content cached for offline
            console.log('[PWA] Conteudo cached para uso offline')
            config?.onSuccess?.(registration)
          }
        }
      }
    }

    // Check for updates periodically (DESABILITADO: causava loop infinito)
    // setInterval(() => {
    //   registration.update().catch(console.error)
    // }, 60000)

    // Listen for controller change (new SW activated)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('[PWA] Novo Service Worker ativo')
    })

    // Listen for messages from SW
    navigator.serviceWorker.addEventListener('message', (event) => {
      const { type } = event.data || {}

      switch (type) {
        case 'SYNC_REQUESTED':
          console.log('[PWA] Sync solicitado pelo Service Worker')
          // Trigger sync in offline manager
          import('@/utils/offline-manager').then(({ getOfflineManager }) => {
            getOfflineManager().syncWhenOnline().catch(console.error)
          })
          break

        default:
          console.log('[PWA] Mensagem do SW:', event.data)
      }
    })

    return registration
  } catch (error) {
    console.error('[PWA] Erro ao registrar Service Worker:', error)
  }
}

// Global flag to prevent duplicate notifications
let globalNotificationShown = false

/**
 * Show update notification to user
 */
function showUpdateNotification(registration: ServiceWorkerRegistration) {
  // Check global flag first (fastest check)
  if (globalNotificationShown) {
    console.log('[PWA] Notificação já foi mostrada (flag global)')
    return
  }

  // Check if element exists in DOM
  const existing = document.getElementById('pwa-update-notification')
  if (existing) {
    console.log('[PWA] Notificação já existe no DOM')
    return
  }

  // Set flag immediately to prevent race conditions
  globalNotificationShown = true
  console.log('[PWA] Mostrando notificação de atualização')

  // Create notification element
  const notification = document.createElement('div')
  notification.id = 'pwa-update-notification'
  notification.innerHTML = `
    <div class="pwa-notification" style="
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: linear-gradient(135deg, #1c1917 0%, #292524 100%);
      color: white;
      padding: 20px 28px;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.1);
      display: flex;
      align-items: center;
      gap: 20px;
      z-index: 10000;
      font-family: system-ui, -apple-system, sans-serif;
      animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
      backdrop-filter: blur(10px);
      max-width: calc(100vw - 48px);
      width: auto;
    ">
      <div style="
        display: flex;
        align-items: center;
        gap: 12px;
      ">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #d97706; flex-shrink: 0;">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M12 16v-4"></path>
          <path d="M12 8h.01"></path>
        </svg>
        <div style="display: flex; flex-direction: column; gap: 2px;">
          <span style="font-size: 15px; font-weight: 600; line-height: 1.4;">Nova versão disponível</span>
          <span style="font-size: 13px; color: #a8a29e; line-height: 1.3;">Clique para atualizar agora</span>
        </div>
      </div>
      <div style="display: flex; gap: 8px; align-items: center;">
        <button id="pwa-update-btn" class="pwa-update-button" style="
          background: #d97706;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
          display: flex;
          align-items: center;
          gap: 8px;
        ">
          <span id="pwa-update-text">Atualizar</span>
          <svg id="pwa-update-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="23 4 23 10 17 10"></polyline>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
          </svg>
        </button>
        <button id="pwa-dismiss-btn" class="pwa-dismiss-button" style="
          background: rgba(255,255,255,0.1);
          color: #d6d3d1;
          border: none;
          padding: 10px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s ease;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    </div>
    <style>
      @keyframes slideUp {
        from {
          transform: translateX(-50%) translateY(120px);
          opacity: 0;
        }
        to {
          transform: translateX(-50%) translateY(0);
          opacity: 1;
        }
      }
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      .pwa-updating #pwa-update-btn {
        opacity: 0.7;
        cursor: wait !important;
        pointer-events: none;
      }
      .pwa-updating #pwa-update-icon {
        animation: spin 1s linear infinite;
      }
      /* CSS Hover effects (CSP compliant) */
      .pwa-update-button:hover {
        background: #ea580c !important;
      }
      .pwa-dismiss-button:hover {
        background: rgba(255,255,255,0.15) !important;
      }
      @media (max-width: 640px) {
        .pwa-notification {
          bottom: 16px !important;
          left: 16px !important;
          right: 16px !important;
          transform: none !important;
          width: auto !important;
          max-width: none !important;
        }
        @keyframes slideUp {
          from {
            transform: translateY(120px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      }
    </style>
  `

  document.body.appendChild(notification)

  // Handle update button
  const updateBtn = document.getElementById('pwa-update-btn')
  const updateText = document.getElementById('pwa-update-text')

  updateBtn?.addEventListener('click', () => {
    const waiting = registration.waiting
    if (waiting) {
      // Show loading state
      notification.classList.add('pwa-updating')
      if (updateText) {
        updateText.textContent = 'Atualizando...'
      }

      // Listen for controller change (new SW activated)
      let refreshing = false
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true
          console.log('[PWA] Novo Service Worker ativo - recarregando...')

          // Update UI before reload
          if (updateText) {
            updateText.textContent = 'Recarregando...'
          }

          // Small delay to show feedback
          setTimeout(() => {
            window.location.reload()
          }, 300)
        }
      })

      // Send message to activate new SW
      console.log('[PWA] Enviando SKIP_WAITING...')
      waiting.postMessage({ type: 'SKIP_WAITING' })
    } else {
      console.warn('[PWA] No waiting service worker found')
      // Fallback: just reload
      window.location.reload()
    }
  })

  // Handle dismiss button
  document.getElementById('pwa-dismiss-btn')?.addEventListener('click', () => {
    notification.style.animation = 'slideDown 0.3s ease forwards'
    setTimeout(() => {
      notification.remove()
    }, 300)
  })

  // Add slideDown animation
  const style = document.createElement('style')
  style.textContent = `
    @keyframes slideDown {
      from {
        transform: translateX(-50%) translateY(0);
        opacity: 1;
      }
      to {
        transform: translateX(-50%) translateY(120px);
        opacity: 0;
      }
    }
    @media (max-width: 640px) {
      @keyframes slideDown {
        from {
          transform: translateY(0);
          opacity: 1;
        }
        to {
          transform: translateY(120px);
          opacity: 0;
        }
      }
    }
  `
  document.head.appendChild(style)
}

// Register service worker
registerServiceWorker({
  onUpdate: (registration) => {
    console.log('[PWA] Update callback - registration:', registration.scope)
  },
  onSuccess: (registration) => {
    console.log('[PWA] Success callback - registration:', registration.scope)
  },
})

// ===== PWA INSTALL PROMPT =====

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
  prompt(): Promise<void>
}

let deferredPrompt: BeforeInstallPromptEvent | null = null

window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent Chrome 67 and earlier from automatically showing the prompt
  e.preventDefault()
  // Stash the event so it can be triggered later
  deferredPrompt = e as BeforeInstallPromptEvent
  console.log('[PWA] beforeinstallprompt event captured')

  // Dispatch custom event for UI components to listen
  window.dispatchEvent(new CustomEvent('pwa-installable', {
    detail: { prompt: deferredPrompt }
  }))
})

window.addEventListener('appinstalled', () => {
  console.log('[PWA] App instalado com sucesso')
  deferredPrompt = null

  // Track installation
  if (typeof gtag !== 'undefined') {
    gtag('event', 'pwa_install', {
      event_category: 'PWA',
      event_label: 'App Installed',
    })
  }
})

// Export for use in components
export function canInstallPWA(): boolean {
  return deferredPrompt !== null
}

export async function installPWA(): Promise<boolean> {
  if (!deferredPrompt) {
    console.warn('[PWA] Install prompt not available')
    return false
  }

  try {
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === 'accepted') {
      console.log('[PWA] User accepted install prompt')
      deferredPrompt = null
      return true
    } else {
      console.log('[PWA] User dismissed install prompt')
      return false
    }
  } catch (error) {
    console.error('[PWA] Install error:', error)
    return false
  }
}

// ===== NETWORK STATUS MONITORING =====

function setupNetworkMonitoring() {
  const handleOnline = () => {
    console.log('[PWA] Conexao restaurada')
    document.body.classList.remove('offline')
    document.body.classList.add('online')

    // Trigger sync
    import('@/utils/offline-manager').then(({ getOfflineManager }) => {
      getOfflineManager().syncWhenOnline().catch(console.error)
    })

    // Request background sync if supported
    if ('serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype) {
      navigator.serviceWorker.ready.then((registration) => {
        (registration as any).sync.register('rom-agent-sync').catch(console.error)
      })
    }
  }

  const handleOffline = () => {
    console.log('[PWA] Conexao perdida')
    document.body.classList.add('offline')
    document.body.classList.remove('online')
  }

  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)

  // Set initial state
  if (navigator.onLine) {
    document.body.classList.add('online')
  } else {
    document.body.classList.add('offline')
  }
}

setupNetworkMonitoring()

// ===== GTAG TYPE DECLARATION =====

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
  }
  function gtag(...args: unknown[]): void
}
// Force rebuild qua 21 jan 2026 17:02:23 -03 (Fix Base64 flag reset)
