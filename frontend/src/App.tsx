import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, lazy, Suspense } from 'react'
import { useAuthStore } from '@/stores/authStore'

// Lazy loading de páginas para melhor performance
const LoginPage = lazy(() => import('@/pages/auth/LoginPage').then(m => ({ default: m.LoginPage })))
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage').then(m => ({ default: m.RegisterPage })))
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

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore()

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

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
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

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

      {/* Certidões */}
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
  )
}
