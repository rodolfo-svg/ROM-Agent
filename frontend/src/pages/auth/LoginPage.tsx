import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { Eye, EyeOff, ArrowRight } from 'lucide-react'

export function LoginPage() {
  const navigate = useNavigate()
  const { login, isAuthenticated, isLoading, error, clearError } = useAuthStore()
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    if (isAuthenticated) navigate('/')
  }, [isAuthenticated, navigate])

  useEffect(() => {
    clearError()
  }, [email, password, clearError])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const success = await login(email, password)
    if (success) navigate('/')
  }

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-stone-50 to-stone-100">
      {/* Left Panel - Branding */}
      <div className="flex-1 flex flex-col justify-center items-center p-16 max-lg:hidden">
        <img
          src="/img/logo-rom-signature.png"
          alt="ROM"
          className="h-20 w-auto mb-8"
        />
        <h1 className="text-2xl font-normal text-stone-800 tracking-tight mb-1">
          ROM Agent
        </h1>
        <p className="text-sm text-stone-500 mb-10">
          Redator de Obras Magistrais
        </p>
        
        <div className="flex flex-col gap-3">
          {[
            '84 agentes jurídicos especializados',
            'Petições, recursos e documentos',
            'Pesquisa de jurisprudência integrada',
            'Metodologia ROM de excelência',
          ].map((text) => (
            <div key={text} className="flex items-center gap-3 text-stone-600 text-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-bronze-400" />
              <span>{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="w-full lg:w-[480px] flex flex-col justify-center p-8 lg:p-16">
        <div className="bg-white rounded-2xl p-8 lg:p-10 shadow-soft max-w-md mx-auto w-full">
          {/* Mobile logo */}
          <div className="lg:hidden flex justify-center mb-8">
            <img
              src="/img/logo-rom-signature.png"
              alt="ROM"
              className="h-14 w-auto"
            />
          </div>

          <div className="mb-8">
            <h2 className="text-xl font-medium text-stone-800 mb-1">
              Bem-vindo
            </h2>
            <p className="text-sm text-stone-500">
              Entre com suas credenciais para continuar
            </p>
          </div>

          {error && (
            <div className="mb-6 px-4 py-3 bg-red-50 border border-red-100 rounded-xl">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-stone-600 mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                className="w-full h-12 px-4 bg-stone-100 border border-stone-200 rounded-xl text-stone-800 placeholder:text-stone-400 focus:bg-white focus:border-bronze-400 focus:ring-4 focus:ring-bronze-400/10 focus:outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-600 mb-2">
                Senha
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full h-12 px-4 pr-12 bg-stone-100 border border-stone-200 rounded-xl text-stone-800 placeholder:text-stone-400 focus:bg-white focus:border-bronze-400 focus:ring-4 focus:ring-bronze-400/10 focus:outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 mt-2 bg-stone-700 hover:bg-stone-800 text-white text-sm font-medium rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Entrar
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <div className="inline-flex items-center gap-1.5 text-xs text-stone-500">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              ROM Agent v4.0
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
