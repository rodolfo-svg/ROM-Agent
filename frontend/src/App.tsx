import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, lazy, Suspense } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useIsOnline } from '@/hooks/useOnlineStatus'

// Lazy loading de paginas para melhor performance
const LoginPage = lazy(() => import('@/pages/auth/LoginPage').then(m => ({ default: m.LoginPage })))
const ChatPage = lazy(() => import('@/pages/chat/ChatPage').then(m => ({ default: m.ChatPage })))
const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage').then(m => ({ default: m.DashboardPage })))
const UploadPage = lazy(() => import('@/pages/upload/UploadPage').then(m => ({ default: m.UploadPage })))
const PromptsPage = lazy(() => import('@/pages/prompts/PromptsPage').then(m => ({ default: m.PromptsPage })))
const MultiAgentPage = lazy(() => import('@/pages/multi-agent/MultiAgentPage').then(m => ({ default: m.MultiAgentPage })))
const CaseProcessorPage = lazy(() => import('@/pages/case-processor/CaseProcessorPage').then(m => ({ default: m.CaseProcessorPage })))
const CertidoesPage = lazy(() => import('@/pages/certidoes/CertidoesPage').then(m => ({ default: m.CertidoesPage })))
const UsersPage = lazy(() => import('@/pages/users/UsersPage').then(m => ({ default: m.UsersPage })))
const PartnersPage = lazy(() => import('@/pages/partners/PartnersPage').then(m => ({ default: m.PartnersPage })))
const ReportsPage = lazy(() => import('@/pages/reports/ReportsPage').then(m => ({ default: m.ReportsPage })))
const SystemPromptsPage = lazy(() => import('@/pages/admin/SystemPromptsPage'))
const CustomInstructionsPage = lazy(() => import('@/pages/custom-instructions/CustomInstructionsPage'))
const SuggestionsPage = lazy(() => import('@/pages/custom-instructions/SuggestionsPage'))

// Loading component
function PageLoader() {
  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-bronze-400 border-t-transparent rounded-full animate-spin" />
        <span className="text-stone-500 text-sm">Carregando...</span>
      </div>
    </div>
  )
}

// Offline indicator component
function OfflineIndicator() {
  const isOnline = useIsOnline()

  if (isOnline) return null

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] bg-amber-500 text-white px-4 py-2 text-center text-sm font-medium shadow-lg"
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-center justify-center gap-2">
        <svg
          className="w-4 h-4 animate-pulse"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"
          />
        </svg>
        <span>Voce esta offline. Algumas funcionalidades podem estar limitadas.</span>
      </div>
    </div>
  )
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore()

  useEffect(() => {
    checkAuth()
  }, []) // ✅ FIX: Rodar apenas UMA VEZ no mount

  if (isLoading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-bronze-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-stone-500 text-sm">Carregando...</span>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

export default function App() {
  return (
    <>
      {/* Offline indicator - always visible when offline */}
      <OfflineIndicator />

      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

        {/* Dashboard (main entry) */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />

        {/* Upload & KB */}
        <Route
          path="/upload"
          element={
            <ProtectedRoute>
              <UploadPage />
            </ProtectedRoute>
          }
        />

        {/* Prompts Library */}
        <Route
          path="/prompts"
          element={
            <ProtectedRoute>
              <PromptsPage />
            </ProtectedRoute>
          }
        />

        {/* Multi-Agent Pipeline */}
        <Route
          path="/multi-agent"
          element={
            <ProtectedRoute>
              <MultiAgentPage />
            </ProtectedRoute>
          }
        />

        {/* Case Processor */}
        <Route
          path="/case-processor"
          element={
            <ProtectedRoute>
              <CaseProcessorPage />
            </ProtectedRoute>
          }
        />

        {/* Certidoes */}
        <Route
          path="/certidoes"
          element={
            <ProtectedRoute>
              <CertidoesPage />
            </ProtectedRoute>
          }
        />

        {/* Users Management */}
        <Route
          path="/users"
          element={
            <ProtectedRoute>
              <UsersPage />
            </ProtectedRoute>
          }
        />

        {/* Partners (Multi-Tenancy) */}
        <Route
          path="/partners"
          element={
            <ProtectedRoute>
              <PartnersPage />
            </ProtectedRoute>
          }
        />

        {/* Reports & Analytics (Admin Only) */}
        <Route
          path="/reports"
          element={
            <ProtectedRoute>
              <ReportsPage />
            </ProtectedRoute>
          }
        />

        {/* System Prompts (Admin Only) */}
        <Route
          path="/admin/system-prompts"
          element={
            <ProtectedRoute>
              <SystemPromptsPage />
            </ProtectedRoute>
          }
        />

        {/* Custom Instructions */}
        <Route
          path="/admin/custom-instructions"
          element={
            <ProtectedRoute>
              <CustomInstructionsPage />
            </ProtectedRoute>
          }
        />

        {/* AI Suggestions */}
        <Route
          path="/admin/suggestions"
          element={
            <ProtectedRoute>
              <SuggestionsPage />
            </ProtectedRoute>
          }
        />

        {/* Chat (legacy route) */}
        <Route
          path="/chat/:conversationId?"
          element={
            <ProtectedRoute>
              <ChatPage />
            </ProtectedRoute>
          }
        />

        {/* Redirect root to dashboard */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Navigate to="/dashboard" replace />
            </ProtectedRoute>
          }
        />

        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      </Suspense>
    </>
  )
}
