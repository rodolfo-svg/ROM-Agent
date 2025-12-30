import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { LoginPage } from '@/pages/auth/LoginPage'
import { ChatPage } from '@/pages/chat/ChatPage'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import { UploadPage } from '@/pages/upload/UploadPage'
import { PromptsPage } from '@/pages/prompts/PromptsPage'
import { MultiAgentPage } from '@/pages/multi-agent/MultiAgentPage'
import { CaseProcessorPage } from '@/pages/case-processor/CaseProcessorPage'
import { CertidoesPage } from '@/pages/certidoes/CertidoesPage'
import { UsersPage } from '@/pages/users/UsersPage'
import { PartnersPage } from '@/pages/partners/PartnersPage'
import { ReportsPage } from '@/pages/reports/ReportsPage'

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
  )
}
