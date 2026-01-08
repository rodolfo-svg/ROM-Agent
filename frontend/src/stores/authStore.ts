import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types'
import { clearCsrfToken } from '@/services/api'

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
      isLoading: true,
      error: null,

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null })

        try {
          const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email, password }),
          })

          const data = await res.json()

          if (data.success && data.user) {
            set({
              user: data.user,
              isAuthenticated: true,
              isLoading: false
            })
            return true
          } else {
            set({
              error: data.error || 'Credenciais inválidas',
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
          const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email, password, name, oab }),
          })

          const data = await res.json()

          if (data.success) {
            // Registrou com sucesso - agora faz login automático
            const loginSuccess = await get().login(email, password)
            return loginSuccess
          } else {
            set({
              error: data.error || 'Erro ao criar conta',
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
          // Buscar CSRF token para logout
          const tokenRes = await fetch('/api/auth/csrf-token', {
            credentials: 'include',
          })
          const tokenData = await tokenRes.json()
          const csrfToken = tokenData.csrfToken

          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
          }
          if (csrfToken) {
            headers['x-csrf-token'] = csrfToken
          }

          await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include',
            headers,
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
          const res = await fetch('/api/auth/me', {
            credentials: 'include',
          })

          if (res.ok) {
            const data = await res.json()
            if (data.authenticated && data.user) {
              set({
                user: data.user,
                isAuthenticated: true,
                isLoading: false
              })
              return
            }
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
