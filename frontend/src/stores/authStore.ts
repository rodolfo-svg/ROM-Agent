import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types'
import { apiFetch, clearCsrfToken } from '@/services/api'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null

  login: (email: string, password: string) => Promise<boolean>
  register: (email: string, password: string, name: string, oab?: string) => Promise<boolean>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
  clearError: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null })

        try {
          const result = await apiFetch<{ user: User; success: boolean }>('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
          })

          if (result.success && result.data?.user) {
            set({
              user: result.data.user,
              isAuthenticated: true,
              isLoading: false
            })
            return true
          } else {
            set({
              error: result.error || 'Credenciais inválidas',
              isLoading: false
            })
            return false
          }
        } catch (err) {
          set({
            error: 'Erro ao conectar com o servidor',
            isLoading: false
          })
          return false
        }
      },

      register: async (email: string, password: string, name: string, oab?: string) => {
        set({ isLoading: true, error: null })

        try {
          const result = await apiFetch<{ success: boolean }>('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ email, password, name, oab }),
          })

          if (result.success) {
            // Registrou com sucesso - agora faz login automático
            const loginSuccess = await get().login(email, password)
            return loginSuccess
          } else {
            set({
              error: result.error || 'Erro ao criar conta',
              isLoading: false
            })
            return false
          }
        } catch (err) {
          set({
            error: 'Erro ao conectar com o servidor',
            isLoading: false
          })
          return false
        }
      },

      logout: async () => {
        try {
          // apiFetch automaticamente busca e inclui CSRF token
          await apiFetch('/auth/logout', {
            method: 'POST',
          })
        } catch (err) {
          console.error('Logout error:', err)
        } finally {
          // Limpar CSRF token após logout
          clearCsrfToken()

          set({
            user: null,
            isAuthenticated: false,
            isLoading: false
          })
        }
      },

      checkAuth: async () => {
        set({ isLoading: true })

        try {
          const result = await apiFetch<{ authenticated: boolean; user: User }>('/auth/me')

          if (result.success && result.data?.authenticated && result.data?.user) {
            set({
              user: result.data.user,
              isAuthenticated: true,
              isLoading: false
            })
            return
          }
        } catch (err) {
          console.error('Auth check error:', err)
        }

        // CRÍTICO: Limpar localStorage se sessão inválida
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false
        })
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'rom-auth',
      partialize: (state) => ({
        // NÃO persistir isAuthenticated - apenas user
        // isAuthenticated será recalculado via checkAuth()
        user: state.user
      }),
    }
  )
)
