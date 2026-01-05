import { useState, useEffect } from 'react'
import { Sidebar } from '@/components/layout'
import {
  BarChart3,
  Users,
  FileText,
  DollarSign,
  TrendingUp,
  Activity,
  Calendar,
  Download
} from 'lucide-react'
import { Button } from '@/components/ui'
import { useAuthStore } from '@/stores/authStore'
import { useNavigate } from 'react-router-dom'

interface Stats {
  totalConversations: number
  totalMessages: number
  totalUsers: number
  averageMessagesPerConversation: number
}

interface Usage {
  daily: any[]
  weekly: any[]
  monthly: any[]
}

interface Analytics {
  topPrompts: any[]
  topUsers: any[]
  peakHours: any[]
}

interface Quality {
  averageResponseTime: number
  successRate: number
  errorRate: number
}

interface Billing {
  totalCost: number
  costByModel: any[]
  costByUser: any[]
}

export function ReportsPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const isAdmin = user?.role === 'admin'

  // Redirect if not admin
  useEffect(() => {
    if (!isAdmin) {
      navigate('/dashboard')
    }
  }, [isAdmin, navigate])

  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<Stats | null>(null)
  const [usage, setUsage] = useState<Usage | null>(null)
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [quality, setQuality] = useState<Quality | null>(null)
  const [billing, setBilling] = useState<Billing | null>(null)
  const [users, setUsers] = useState<any[]>([])
  const [pieces, setPieces] = useState<any[]>([])

  useEffect(() => {
    if (isAdmin) {
      fetchAllData()
    }
  }, [isAdmin])

  const fetchAllData = async () => {
    setLoading(true)
    try {
      const [
        statsRes,
        usageRes,
        analyticsRes,
        qualityRes,
        billingRes,
        usersRes,
        piecesRes
      ] = await Promise.all([
        fetch('/api/stats', { credentials: 'include' }),
        fetch('/api/dashboard/usage', { credentials: 'include' }),
        fetch('/api/dashboard/analytics', { credentials: 'include' }),
        fetch('/api/dashboard/quality', { credentials: 'include' }),
        fetch('/api/dashboard/billing', { credentials: 'include' }),
        fetch('/api/dashboard/users', { credentials: 'include' }),
        fetch('/api/dashboard/pieces', { credentials: 'include' })
      ])

      const statsData = await statsRes.json()
      const usageData = await usageRes.json()
      const analyticsData = await analyticsRes.json()
      const qualityData = await qualityRes.json()
      const billingData = await billingRes.json()
      const usersData = await usersRes.json()
      const piecesData = await piecesRes.json()

      setStats(statsData)
      setUsage(usageData.usage || { daily: [], weekly: [], monthly: [] })
      setAnalytics(analyticsData.analytics || { topPrompts: [], topUsers: [], peakHours: [] })
      setQuality(qualityData.quality || { averageResponseTime: 0, successRate: 0, errorRate: 0 })
      setBilling(billingData.billing || { totalCost: 0, costByModel: [], costByUser: [] })
      setUsers(usersData.users || [])
      setPieces(piecesData.pieces || [])
    } catch (error) {
      console.error('Failed to fetch reports data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleExport = () => {
    const data = {
      stats,
      usage,
      analytics,
      quality,
      billing,
      users,
      pieces,
      exportedAt: new Date().toISOString(),
      exportedBy: user?.email
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rom-agent-report-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!isAdmin) {
    return null
  }

  return (
    <div className="h-screen flex bg-stone-50">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="bg-white border-b border-stone-200 px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-stone-800 mb-2">Relatórios e Analytics</h1>
              <p className="text-stone-500">Métricas de uso e desempenho do sistema</p>
            </div>
            <Button onClick={handleExport} className="gap-2">
              <Download className="w-4 h-4" />
              Exportar Relatório
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            {loading ? (
              <div className="text-center py-12">
                <div className="w-10 h-10 border-2 border-bronze-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-stone-500">Carregando relatórios...</p>
              </div>
            ) : (
              <>
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-white rounded-xl shadow-soft p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                        <Activity className="w-6 h-6 text-blue-600" />
                      </div>
                    </div>
                    <h3 className="text-2xl font-bold text-stone-800 mb-1">
                      {stats?.totalConversations || 0}
                    </h3>
                    <p className="text-sm text-stone-500">Total de Conversas</p>
                  </div>

                  <div className="bg-white rounded-xl shadow-soft p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                        <Users className="w-6 h-6 text-green-600" />
                      </div>
                    </div>
                    <h3 className="text-2xl font-bold text-stone-800 mb-1">
                      {users.length}
                    </h3>
                    <p className="text-sm text-stone-500">Usuários Ativos</p>
                  </div>

                  <div className="bg-white rounded-xl shadow-soft p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                        <FileText className="w-6 h-6 text-purple-600" />
                      </div>
                    </div>
                    <h3 className="text-2xl font-bold text-stone-800 mb-1">
                      {pieces.length}
                    </h3>
                    <p className="text-sm text-stone-500">Peças Geradas</p>
                  </div>

                  <div className="bg-white rounded-xl shadow-soft p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                        <TrendingUp className="w-6 h-6 text-orange-600" />
                      </div>
                    </div>
                    <h3 className="text-2xl font-bold text-stone-800 mb-1">
                      {quality?.successRate ? `${(quality.successRate * 100).toFixed(1)}%` : '0%'}
                    </h3>
                    <p className="text-sm text-stone-500">Taxa de Sucesso</p>
                  </div>
                </div>

                {/* Quality Metrics */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white rounded-xl shadow-soft p-6">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 bg-bronze-100 rounded-lg flex items-center justify-center">
                        <BarChart3 className="w-5 h-5 text-bronze-600" />
                      </div>
                      <h2 className="text-lg font-semibold text-stone-800">Qualidade do Serviço</h2>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-stone-600">Tempo Médio de Resposta</span>
                          <span className="text-sm font-semibold text-stone-800">
                            {quality?.averageResponseTime ? `${quality.averageResponseTime.toFixed(2)}s` : 'N/A'}
                          </span>
                        </div>
                        <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500"
                            style={{ width: `${Math.min((quality?.averageResponseTime || 0) / 10 * 100, 100)}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-stone-600">Taxa de Sucesso</span>
                          <span className="text-sm font-semibold text-stone-800">
                            {quality?.successRate ? `${(quality.successRate * 100).toFixed(1)}%` : '0%'}
                          </span>
                        </div>
                        <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500"
                            style={{ width: `${(quality?.successRate || 0) * 100}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-stone-600">Taxa de Erro</span>
                          <span className="text-sm font-semibold text-stone-800">
                            {quality?.errorRate ? `${(quality.errorRate * 100).toFixed(1)}%` : '0%'}
                          </span>
                        </div>
                        <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-red-500"
                            style={{ width: `${(quality?.errorRate || 0) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl shadow-soft p-6">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                        <DollarSign className="w-5 h-5 text-green-600" />
                      </div>
                      <h2 className="text-lg font-semibold text-stone-800">Custos de Operação</h2>
                    </div>

                    <div className="mb-6">
                      <p className="text-3xl font-bold text-stone-800 mb-1">
                        ${billing?.totalCost ? billing.totalCost.toFixed(2) : '0.00'}
                      </p>
                      <p className="text-sm text-stone-500">Custo total do período</p>
                    </div>

                    {billing?.costByModel && billing.costByModel.length > 0 ? (
                      <div className="space-y-3">
                        <p className="text-sm font-medium text-stone-600 mb-2">Custo por Modelo:</p>
                        {billing.costByModel.map((item: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between">
                            <span className="text-sm text-stone-600">{item.model}</span>
                            <span className="text-sm font-semibold text-stone-800">${item.cost.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-stone-400">Nenhum dado de custo disponível</p>
                    )}
                  </div>
                </div>

                {/* Top Users & Prompts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white rounded-xl shadow-soft p-6">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Users className="w-5 h-5 text-blue-600" />
                      </div>
                      <h2 className="text-lg font-semibold text-stone-800">Top Usuários</h2>
                    </div>

                    {analytics?.topUsers && analytics.topUsers.length > 0 ? (
                      <div className="space-y-3">
                        {analytics.topUsers.slice(0, 5).map((user: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-stone-50 rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-bronze-200 rounded-full flex items-center justify-center">
                                <span className="text-xs font-semibold text-bronze-700">
                                  {user.name?.substring(0, 2).toUpperCase() || 'U'}
                                </span>
                              </div>
                              <span className="text-sm font-medium text-stone-700">{user.name || 'Usuário'}</span>
                            </div>
                            <span className="text-sm font-semibold text-stone-800">{user.count || 0} usos</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-stone-400">Nenhum dado disponível</p>
                    )}
                  </div>

                  <div className="bg-white rounded-xl shadow-soft p-6">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                        <FileText className="w-5 h-5 text-purple-600" />
                      </div>
                      <h2 className="text-lg font-semibold text-stone-800">Prompts Mais Usados</h2>
                    </div>

                    {analytics?.topPrompts && analytics.topPrompts.length > 0 ? (
                      <div className="space-y-3">
                        {analytics.topPrompts.slice(0, 5).map((prompt: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-stone-50 rounded-lg">
                            <span className="text-sm font-medium text-stone-700">{prompt.name || 'Prompt'}</span>
                            <span className="text-sm font-semibold text-stone-800">{prompt.count || 0} usos</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-stone-400">Nenhum dado disponível</p>
                    )}
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="bg-white rounded-xl shadow-soft p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-orange-600" />
                    </div>
                    <h2 className="text-lg font-semibold text-stone-800">Peças Recentes</h2>
                  </div>

                  {pieces && pieces.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-stone-100">
                            <th className="text-left text-sm font-medium text-stone-600 pb-3">Data</th>
                            <th className="text-left text-sm font-medium text-stone-600 pb-3">Tipo</th>
                            <th className="text-left text-sm font-medium text-stone-600 pb-3">Usuário</th>
                            <th className="text-left text-sm font-medium text-stone-600 pb-3">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pieces.slice(0, 10).map((piece: any, idx: number) => (
                            <tr key={idx} className="border-b border-stone-50">
                              <td className="py-3 text-sm text-stone-700">
                                {piece.createdAt ? new Date(piece.createdAt).toLocaleDateString('pt-BR') : 'N/A'}
                              </td>
                              <td className="py-3 text-sm text-stone-700">{piece.type || 'Documento'}</td>
                              <td className="py-3 text-sm text-stone-700">{piece.user || 'Sistema'}</td>
                              <td className="py-3">
                                <span className={`px-2 py-1 text-xs rounded-full ${
                                  piece.status === 'completed' ? 'bg-green-100 text-green-700' :
                                  piece.status === 'error' ? 'bg-red-100 text-red-700' :
                                  'bg-yellow-100 text-yellow-700'
                                }`}>
                                  {piece.status || 'pending'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-stone-400">Nenhuma peça gerada ainda</p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
