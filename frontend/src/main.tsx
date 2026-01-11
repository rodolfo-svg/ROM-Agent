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
    const registration = await navigator.serviceWorker.register('/service-worker.js', {
      scope: '/',
      updateViaCache: 'none',
    })

    console.log('[PWA] Service Worker registrado:', registration.scope)

    // Handle updates
    registration.onupdatefound = () => {
      const installingWorker = registration.installing
      if (!installingWorker) return

      installingWorker.onstatechange = () => {
        if (installingWorker.state === 'installed') {
          if (navigator.serviceWorker.controller) {
            // New content available
            console.log('[PWA] Nova versao disponivel')
            config?.onUpdate?.(registration)

            // Show update notification
            showUpdateNotification(registration)
          } else {
            // Content cached for offline
            console.log('[PWA] Conteudo cached para uso offline')
            config?.onSuccess?.(registration)
          }
        }
      }
    }

    // Check for updates periodically
    setInterval(() => {
      registration.update().catch(console.error)
    }, 60000) // Every minute

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

/**
 * Show update notification to user
 */
function showUpdateNotification(registration: ServiceWorkerRegistration) {
  // Create notification element
  const notification = document.createElement('div')
  notification.id = 'pwa-update-notification'
  notification.innerHTML = `
    <div style="
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #1c1917;
      color: white;
      padding: 16px 24px;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      gap: 16px;
      z-index: 10000;
      font-family: system-ui, -apple-system, sans-serif;
      animation: slideUp 0.3s ease;
    ">
      <span style="font-size: 14px;">Nova versao disponivel</span>
      <button id="pwa-update-btn" style="
        background: #d97706;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
      ">Atualizar</button>
      <button id="pwa-dismiss-btn" style="
        background: transparent;
        color: #a8a29e;
        border: none;
        padding: 8px;
        cursor: pointer;
        font-size: 18px;
      ">x</button>
    </div>
    <style>
      @keyframes slideUp {
        from { transform: translateX(-50%) translateY(100px); opacity: 0; }
        to { transform: translateX(-50%) translateY(0); opacity: 1; }
      }
    </style>
  `

  document.body.appendChild(notification)

  // Handle update button
  document.getElementById('pwa-update-btn')?.addEventListener('click', () => {
    const waiting = registration.waiting
    if (waiting) {
      waiting.postMessage({ type: 'SKIP_WAITING' })
      window.location.reload()
    }
  })

  // Handle dismiss button
  document.getElementById('pwa-dismiss-btn')?.addEventListener('click', () => {
    notification.remove()
  })
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
