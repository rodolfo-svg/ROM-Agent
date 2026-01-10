import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './styles/globals.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)

// PWA Service Worker Registration
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .then((registration) => {
        console.log('✅ PWA: Service Worker registrado:', registration.scope)

        // Check for updates periodically
        setInterval(() => {
          registration.update()
        }, 60000) // Check every minute
      })
      .catch((error) => {
        console.error('❌ PWA: Erro ao registrar Service Worker:', error)
      })
  })
}

// PWA Install Prompt Handler
let deferredPrompt: any = null

window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent Chrome 67 and earlier from automatically showing the prompt
  e.preventDefault()
  // Stash the event so it can be triggered later
  deferredPrompt = e
  console.log('✅ PWA: beforeinstallprompt event captured')

  // Dispatch custom event for UI components to listen
  window.dispatchEvent(new CustomEvent('pwa-installable', { detail: { prompt: deferredPrompt } }))
})

window.addEventListener('appinstalled', () => {
  console.log('✅ PWA: App instalado com sucesso')
  deferredPrompt = null
})
