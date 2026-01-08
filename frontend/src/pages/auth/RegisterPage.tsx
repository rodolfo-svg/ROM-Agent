import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { Eye, EyeOff, ArrowRight, UserPlus } from 'lucide-react'

export function RegisterPage() {
  const navigate = useNavigate()
  const { register, isAuthenticated, isLoading, error, clearError } = useAuthStore()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [name, setName] = useState('')
  const [oab, setOab] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [localError, setLocalError] = useState('')

  useEffect(() => {
    if (isAuthenticated) navigate('/')
  }, [isAuthenticated, navigate])

  useEffect(() => {
    clearError()
    setLocalError('')
  }, [email, password, confirmPassword, name, clearError])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError('')

    // Validação local
    if (password !== confirmPassword) {
      setLocalError('As senhas não coincidem')
      return
    }

    if (password.length < 8) {
      setLocalError('A senha deve ter pelo menos 8 caracteres')
      return
    }

    const success = await register(email, password, name, oab || undefined)
    if (success) navigate('/')
  }

  const displayError = localError || error

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

      {/* Right Panel - Register Form */}
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
              Criar conta
            </h2>
            <p className="text-sm text-stone-500">
              Preencha seus dados para começar
            </p>
          </div>

          {displayError && (
            <div className="mb-6 px-4 py-3 bg-red-50 border border-red-100 rounded-xl">
              <p className="text-sm text-red-600">{displayError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-600 mb-2">
                Nome completo
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome"
                required
                className="w-full h-12 px-4 bg-stone-100 border border-stone-200 rounded-xl text-stone-800 placeholder:text-stone-400 focus:bg-white focus:border-bronze-400 focus:ring-4 focus:ring-bronze-400/10 focus:outline-none transition-all"
              />
            </div>

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
                OAB (opcional)
              </label>
              <input
                type="text"
                value={oab}
                onChange={(e) => setOab(e.target.value)}
                placeholder="Ex: OAB/SP 123456"
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
                  placeholder="Mínimo 8 caracteres"
                  required
                  minLength={8}
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

            <div>
              <label className="block text-sm font-medium text-stone-600 mb-2">
                Confirmar senha
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Digite a senha novamente"
                  required
                  minLength={8}
                  className="w-full h-12 px-4 pr-12 bg-stone-100 border border-stone-200 rounded-xl text-stone-800 placeholder:text-stone-400 focus:bg-white focus:border-bronze-400 focus:ring-4 focus:ring-bronze-400/10 focus:outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
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
                  <UserPlus className="w-4 h-4" />
                  Criar conta
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-stone-500">
              Já tem uma conta?{' '}
              <Link
                to="/login"
                className="text-bronze-600 hover:text-bronze-700 font-medium transition-colors"
              >
                Entrar
              </Link>
            </p>
          </div>

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
