import { useState, useEffect } from 'react'
import {
  FileText,
  Plus,
  Edit,
  Save,
  X,
  Search,
  Filter,
  Download,
  Upload,
  Copy,
  Trash2,
  AlertCircle,
  CheckCircle,
  Clock,
  Tag,
  Globe,
  Building,
  Folder,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  Info
} from 'lucide-react'
import { apiFetch } from '@/services/api'

interface Prompt {
  id: string
  filename: string
  name: string
  type: 'global' | 'partner'
  partnerId?: string
  path: string
  editable: boolean
  size: number
  lastModified: string
  overridesGlobal?: boolean
  content?: string
  tags?: string[]
  version?: string
  description?: string
}

interface PromptsResponse {
  global: Prompt[]
  partner: Prompt[]
  canEditGlobal: boolean
  canEditPartner: boolean
}

export default function AdminPrompts() {
  const [prompts, setPrompts] = useState<PromptsResponse>({
    global: [],
    partner: [],
    canEditGlobal: false,
    canEditPartner: false
  })
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'global' | 'partner'>('all')
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [showCategoriesPanel, setShowCategoriesPanel] = useState(true)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadPrompts()
  }, [])

  const loadPrompts = async () => {
    try {
      setLoading(true)
      const response = await apiFetch<PromptsResponse>('/system-prompts')
      if (!response.success) throw new Error(response.error || 'Erro ao carregar prompts')
      setPrompts(response.data.prompts || response.data)
    } catch (error) {
      console.error('Erro ao carregar prompts:', error)
      showMessage('error', 'Erro ao carregar prompts')
    } finally {
      setLoading(false)
    }
  }

  const loadPromptContent = async (prompt: Prompt) => {
    try {
      const response = await apiFetch<{ content: string }>(`/system-prompts/${prompt.type}/${prompt.id}`)
      if (!response.success) throw new Error(response.error || 'Erro ao carregar conteúdo')
      setSelectedPrompt({ ...prompt, content: response.data.content })
      setEditContent(response.data.content || '')
    } catch (error) {
      console.error('Erro ao carregar conteúdo do prompt:', error)
      showMessage('error', 'Erro ao carregar conteúdo do prompt')
    }
  }

  const savePrompt = async () => {
    if (!selectedPrompt) return

    try {
      setSaving(true)
      const response = await apiFetch(`/system-prompts/${selectedPrompt.type}/${selectedPrompt.id}`, {
        method: 'PUT',
        body: JSON.stringify({ content: editContent })
      })

      if (!response.success) throw new Error(response.error || 'Erro ao salvar prompt')

      showMessage('success', 'Prompt salvo com sucesso!')
      setEditMode(false)
      await loadPrompts()
      setSelectedPrompt({ ...selectedPrompt, content: editContent })
    } catch (error) {
      console.error('Erro ao salvar prompt:', error)
      showMessage('error', 'Erro ao salvar prompt')
    } finally {
      setSaving(false)
    }
  }

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(category)) {
      newExpanded.delete(category)
    } else {
      newExpanded.add(category)
    }
    setExpandedCategories(newExpanded)
  }

  const createNewPrompt = async (suggestedId?: string, suggestedName?: string) => {
    const name = suggestedName || prompt('Nome do novo prompt:')
    if (!name) return

    const type = prompts.canEditGlobal
      ? confirm('Criar como prompt global? (Cancelar = específico do parceiro)')
        ? 'global'
        : 'partner'
      : 'partner'

    try {
      const response = await apiFetch('/system-prompts', {
        method: 'POST',
        body: JSON.stringify({
          name,
          type,
          content: '# ' + name + '\n\nConteúdo do prompt aqui...'
        })
      })

      if (!response.success) throw new Error(response.error || 'Erro ao criar prompt')

      showMessage('success', 'Prompt criado com sucesso!')
      await loadPrompts()
    } catch (error) {
      console.error('Erro ao criar prompt:', error)
      showMessage('error', 'Erro ao criar prompt')
    }
  }

  const deletePrompt = async (prompt: Prompt) => {
    if (!confirm(`Tem certeza que deseja deletar "${prompt.name}"?`)) return

    try {
      const response = await apiFetch(`/system-prompts/${prompt.type}/${prompt.id}`, {
        method: 'DELETE'
      })

      if (!response.success) throw new Error(response.error || 'Erro ao deletar prompt')

      showMessage('success', 'Prompt deletado com sucesso!')
      await loadPrompts()
      setSelectedPrompt(null)
    } catch (error) {
      console.error('Erro ao deletar prompt:', error)
      showMessage('error', 'Erro ao deletar prompt')
    }
  }

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 5000)
  }

  const filteredPrompts = () => {
    const allPrompts = [
      ...prompts.global.map(p => ({ ...p, type: 'global' as const })),
      ...prompts.partner.map(p => ({ ...p, type: 'partner' as const }))
    ]

    return allPrompts.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.id.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesFilter = filterType === 'all' || p.type === filterType
      return matchesSearch && matchesFilter
    })
  }

  // Categorias de peças jurídicas (espelho do backend)
  const CATEGORIAS_PECAS = {
    'Cível - Iniciais': ['peticao_inicial_civel', 'acao_declaratoria', 'acao_cautelar', 'acao_monitoria', 'acao_execucao', 'acao_rescisoria'],
    'Cível - Respostas': ['contestacao_civel', 'reconvencao', 'replica', 'impugnacao_cumprimento', 'embargos_execucao'],
    'Recursos Cíveis': ['recurso_apelacao', 'agravo_instrumento', 'agravo_interno', 'embargos_declaracao', 'recurso_especial', 'recurso_extraordinario'],
    'Trabalhista': ['reclamacao_trabalhista', 'contestacao_trabalhista', 'recurso_ordinario', 'recurso_revista', 'embargos_execucao_trabalhista', 'mandado_seguranca_trabalhista'],
    'Criminal': ['queixa_crime', 'resposta_acusacao', 'alegacoes_finais_criminais', 'habeas_corpus', 'liberdade_provisoria', 'revisao_criminal', 'apelacao_criminal', 'recurso_sentido_estrito', 'agravo_execucao_penal'],
    'Empresarial': ['alteracao_contratual', 'distrato_social', 'contrato_social'],
    'Contratos': ['contrato', 'contrato_compra_venda', 'contrato_prestacao_servicos', 'contrato_locacao', 'contrato_honorarios', 'termo_acordo', 'termo_quitacao'],
    'Procurações': ['procuracao_ad_judicia', 'substabelecimento'],
    'Memoriais e Análises': ['memoriais_civeis', 'alegacoes_finais', 'parecer_juridico', 'analise_processual', 'resumo_executivo', 'leading_case']
  }

  const promptoExiste = (id: string) => {
    return filteredPrompts().some(p => p.id === id || p.id === id.replace(/_/g, '-'))
  }

  const [showGuide, setShowGuide] = useState(false)

  return (
    <div className="h-screen flex flex-col bg-stone-50">
      {/* Header */}
      <div className="bg-white border-b border-stone-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-stone-900">Gerenciamento de Prompts</h1>
            <p className="text-sm text-stone-600 mt-1">
              Gerencie prompts do sistema e específicos do seu escritório
            </p>
          </div>

          <button
            onClick={createNewPrompt}
            className="flex items-center gap-2 px-4 py-2 bg-stone-900 text-white rounded-lg hover:bg-stone-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo Prompt
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 mt-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              type="text"
              placeholder="Buscar prompts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900"
            />
          </div>

          <div className="flex items-center gap-2 bg-white border border-stone-300 rounded-lg p-1">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                filterType === 'all'
                  ? 'bg-stone-900 text-white'
                  : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setFilterType('global')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center gap-1 ${
                filterType === 'global'
                  ? 'bg-stone-900 text-white'
                  : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              <Globe className="w-3 h-3" />
              Globais
            </button>
            <button
              onClick={() => setFilterType('partner')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center gap-1 ${
                filterType === 'partner'
                  ? 'bg-stone-900 text-white'
                  : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              <Building className="w-3 h-3" />
              Parceiro
            </button>
          </div>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`mx-6 mt-4 px-4 py-3 rounded-lg flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          <span className="text-sm font-medium">{message.text}</span>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* List */}
        <div className="w-96 bg-white border-r border-stone-200 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-stone-900"></div>
            </div>
          ) : filteredPrompts().length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-stone-500">
              <FileText className="w-12 h-12 mb-2 opacity-50" />
              <p className="text-sm">Nenhum prompt encontrado</p>
            </div>
          ) : (
            <div className="divide-y divide-stone-200">
              {filteredPrompts().map((prompt) => (
                <button
                  key={prompt.id}
                  onClick={() => loadPromptContent(prompt)}
                  className={`w-full text-left px-4 py-3 hover:bg-stone-50 transition-colors ${
                    selectedPrompt?.id === prompt.id ? 'bg-stone-100' : ''
                  }`}
                >
                  <div className="flex items-start justify-between mb-1">
                    <h3 className="font-medium text-stone-900 text-sm">{prompt.name}</h3>
                    {prompt.type === 'global' ? (
                      <Globe className="w-3 h-3 text-blue-600" />
                    ) : (
                      <Building className="w-3 h-3 text-orange-600" />
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-stone-500">
                    <span>{prompt.id}</span>
                    <span>•</span>
                    <span>{(prompt.size / 1024).toFixed(1)} KB</span>
                  </div>

                  {prompt.overridesGlobal && (
                    <div className="mt-1 text-xs text-orange-600 font-medium">
                      ⚠ Sobrescreve global
                    </div>
                  )}

                  {!prompt.editable && (
                    <div className="mt-1 text-xs text-stone-400">
                      🔒 Somente leitura
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Editor */}
        <div className="flex-1 flex flex-col bg-white">
          {selectedPrompt ? (
            <>
              {/* Editor Header */}
              <div className="px-6 py-4 border-b border-stone-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-stone-900">{selectedPrompt.name}</h2>
                    <div className="flex items-center gap-3 mt-1 text-sm text-stone-600">
                      <span className="flex items-center gap-1">
                        {selectedPrompt.type === 'global' ? (
                          <><Globe className="w-3 h-3" /> Global</>
                        ) : (
                          <><Building className="w-3 h-3" /> Parceiro</>
                        )}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(selectedPrompt.lastModified).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {selectedPrompt.editable && !editMode && (
                      <button
                        onClick={() => setEditMode(true)}
                        className="flex items-center gap-2 px-4 py-2 border border-stone-300 rounded-lg hover:bg-stone-50 transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                        Editar
                      </button>
                    )}

                    {editMode && (
                      <>
                        <button
                          onClick={() => {
                            setEditMode(false)
                            setEditContent(selectedPrompt.content || '')
                          }}
                          className="flex items-center gap-2 px-4 py-2 border border-stone-300 rounded-lg hover:bg-stone-50 transition-colors"
                        >
                          <X className="w-4 h-4" />
                          Cancelar
                        </button>
                        <button
                          onClick={savePrompt}
                          disabled={saving}
                          className="flex items-center gap-2 px-4 py-2 bg-stone-900 text-white rounded-lg hover:bg-stone-800 transition-colors disabled:opacity-50"
                        >
                          <Save className="w-4 h-4" />
                          {saving ? 'Salvando...' : 'Salvar'}
                        </button>
                      </>
                    )}

                    {selectedPrompt.editable && (
                      <button
                        onClick={() => deletePrompt(selectedPrompt)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Editor Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {editMode ? (
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full h-full font-mono text-sm border border-stone-300 rounded-lg p-4 focus:outline-none focus:ring-2 focus:ring-stone-900 resize-none"
                    placeholder="Conteúdo do prompt..."
                  />
                ) : (
                  <pre className="font-mono text-sm whitespace-pre-wrap text-stone-800">
                    {selectedPrompt.content || 'Carregando conteúdo...'}
                  </pre>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-stone-500">
              <div className="text-center">
                <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Selecione um prompt para visualizar</p>
                <p className="text-sm mt-1">Escolha um prompt na lista ao lado</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Botão Flutuante - Guia de Peças */}
      <button
        onClick={() => setShowGuide(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-bronze-600 hover:bg-bronze-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all z-40"
        title="Ver todas as peças jurídicas suportadas"
      >
        <Info className="w-6 h-6" />
      </button>

      {/* Modal - Guia de Peças Jurídicas */}
      {showGuide && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-bronze-50">
              <div>
                <h2 className="text-xl font-semibold text-stone-900">Peças Jurídicas Suportadas</h2>
                <p className="text-sm text-stone-600 mt-1">
                  {Object.values(CATEGORIAS_PECAS).flat().length} tipos de peças organizadas em {Object.keys(CATEGORIAS_PECAS).length} categorias
                </p>
              </div>
              <button
                onClick={() => setShowGuide(false)}
                className="p-2 hover:bg-white rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Object.entries(CATEGORIAS_PECAS).map(([categoria, pecas]) => (
                  <div key={categoria} className="bg-stone-50 rounded-lg p-4">
                    <h3 className="font-semibold text-stone-900 mb-3 flex items-center gap-2">
                      <Folder className="w-4 h-4 text-bronze-600" />
                      {categoria}
                      <span className="text-xs text-stone-500 font-normal">
                        ({pecas.filter(p => promptoExiste(p)).length}/{pecas.length})
                      </span>
                    </h3>
                    <ul className="space-y-1.5">
                      {pecas.map(peca => {
                        const existe = promptoExiste(peca)
                        const nome = peca.replace(/_/g, ' ').replace(/-/g, ' ')

                        return (
                          <li key={peca} className="flex items-center justify-between text-sm group">
                            <span className={existe ? 'text-stone-700' : 'text-stone-400'}>
                              {existe && <CheckCircle className="w-3 h-3 inline mr-1 text-green-600" />}
                              {!existe && <AlertCircle className="w-3 h-3 inline mr-1 text-orange-500" />}
                              {nome}
                            </span>
                            {!existe && (
                              <button
                                onClick={() => {
                                  setShowGuide(false)
                                  createNewPrompt(peca, nome)
                                }}
                                className="opacity-0 group-hover:opacity-100 text-xs text-bronze-600 hover:text-bronze-700 transition-opacity"
                              >
                                <Plus className="w-3 h-3 inline mr-0.5" />
                                Criar
                              </button>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-stone-200 bg-stone-50 text-sm text-stone-600">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-stone-900 mb-1">Como funciona:</p>
                  <ul className="space-y-1 text-xs">
                    <li>• <CheckCircle className="w-3 h-3 inline text-green-600" /> = Prompt já existe (pode ser editado)</li>
                    <li>• <AlertCircle className="w-3 h-3 inline text-orange-500" /> = Prompt ainda não criado (clique em "Criar")</li>
                    <li>• O agente detecta automaticamente o tipo de peça e usa o prompt apropriado</li>
                    <li>• Você pode criar prompts globais (todos escritórios) ou específicos do parceiro</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
