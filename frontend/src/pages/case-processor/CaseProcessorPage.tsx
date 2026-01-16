/**
 * CaseProcessorPage - Processamento de Processos Judiciais
 *
 * Pagina para upload e processamento de processos judiciais com:
 * - Progress tracking em tempo real via SSE
 * - Integracao com IA (Layer Cake Architecture)
 * - Extracao automatica de dados
 * - Listagem de processos com busca
 * - Integracao com backend /api/case-processor/process
 */

import { apiFetch } from '@/services/api'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Sidebar } from '@/components/layout'
import {
  FolderOpen,
  Upload,
  Search,
  FileText,
  Calendar,
  User,
  AlertCircle,
  Loader2,
  Brain,
  CheckCircle,
  Trash2,
  RefreshCw,
  Layers,
  ChevronDown,
  ChevronUp,
  Eye,
  Clock,
  Gavel,
  Scale,
  XCircle
} from 'lucide-react'
import { Button } from '@/components/ui'
import { useFileUpload, type FileInfo } from '@/hooks'

// ============================================================
// TYPES
// ============================================================

interface Case {
  id: string
  caseNumber: string
  title: string
  status: 'pending' | 'processing' | 'completed' | 'error'
  createdAt: string
  parties: { plaintiff: string; defendant: string }
  // Dados de processamento IA
  metadata?: {
    documentsCount?: number
    layersProcessed?: number
    processingTime?: string
    extractionSummary?: string
    wordCount?: number
    toolsUsed?: string[]
    structuredDocs?: number
  }
}

interface SSEUpdate {
  type: 'info' | 'progress' | 'layer' | 'success' | 'error' | 'warning'
  message: string
  progress?: number
  layer?: number
  step?: string
  timestamp?: string
}

// ============================================================
// COMPONENT
// ============================================================

export function CaseProcessorPage() {
  // State
  const [cases, setCases] = useState<Case[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedCase, setExpandedCase] = useState<string | null>(null)
  const [sseUpdates, setSSEUpdates] = useState<SSEUpdate[]>([])
  const [currentCasoId, setCurrentCasoId] = useState<string | null>(null)
  const [processingProgress, setProcessingProgress] = useState(0)
  const [processingMessage, setProcessingMessage] = useState('')
  const [processingLayer, setProcessingLayer] = useState(0)

  // Refs
  const eventSourceRef = useRef<EventSource | null>(null)

  // File upload with AI - uses case-processor endpoint
  const {
    attachedFiles,
    isUploading,
    uploadProgress,
    error: uploadError,
    uploadFiles,
    removeFile,
    clearFiles,
  } = useFileUpload({
    endpoint: 'case-processor',
    maxFiles: 10,
    maxSizeBytes: 500 * 1024 * 1024, // 500MB para documentos jurídicos grandes
    allowedTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    onUploadComplete: async (file, fileInfo) => {
      console.log(`[CaseProcessor] File processed: ${file.name}`, fileInfo)
    },
    onUploadError: (file, error) => {
      console.error(`[CaseProcessor] Processing error for ${file.name}:`, error)
    },
  })

  // ============================================================
  // SSE CONNECTION
  // ============================================================

  const connectSSE = useCallback((casoId: string) => {
    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    setCurrentCasoId(casoId)
    setSSEUpdates([])
    setProcessingProgress(0)
    setProcessingMessage('Conectando ao servidor...')
    setProcessingLayer(0)

    const url = `/api/case-processor/${casoId}/stream`
    const eventSource = new EventSource(url, { withCredentials: true })
    eventSourceRef.current = eventSource

    eventSource.onmessage = (event) => {
      try {
        const update: SSEUpdate = JSON.parse(event.data)
        setSSEUpdates(prev => [...prev, update])

        // Update progress
        if (update.progress !== undefined) {
          setProcessingProgress(update.progress)
        }
        if (update.message) {
          setProcessingMessage(update.message)
        }
        if (update.layer !== undefined) {
          setProcessingLayer(update.layer)
        }
      } catch (e) {
        console.error('[CaseProcessor] SSE parse error:', e)
      }
    }

    eventSource.addEventListener('complete', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data)
        setProcessingProgress(100)
        setProcessingMessage(`Concluido em ${data.totalTime || 'N/A'}`)
        setSSEUpdates(prev => [...prev, {
          type: 'success',
          message: `Processamento concluido em ${data.totalTime || 'N/A'}`,
        }])
        // Refresh cases list
        fetchCases()
      } catch (e) {
        console.error('[CaseProcessor] SSE complete parse error:', e)
      }
      eventSource.close()
      eventSourceRef.current = null
      setCurrentCasoId(null)
    })

    eventSource.addEventListener('error', (event: Event) => {
      const msgEvent = event as MessageEvent
      if (msgEvent.data) {
        try {
          const data = JSON.parse(msgEvent.data)
          setProcessingMessage(data.error || 'Erro no processamento')
          setSSEUpdates(prev => [...prev, {
            type: 'error',
            message: data.error || 'Erro desconhecido',
          }])
        } catch {
          // Ignore parse errors
        }
      }
      eventSource.close()
      eventSourceRef.current = null
      setCurrentCasoId(null)
    })

    eventSource.onerror = () => {
      console.warn('[CaseProcessor] SSE connection error')
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
    }
  }, [])

  // ============================================================
  // FETCH CASES
  // ============================================================

  const fetchCases = useCallback(async () => {
    setLoading(true)
    try {
      const response = await apiFetch<{ cases: Case[] }>('/case-processor/cases')
      if (response.success && response.data?.cases) {
        setCases(response.data.cases)
      }
    } catch (error) {
      console.error('[CaseProcessor] Error fetching cases:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCases()
  }, [fetchCases])

  // ============================================================
  // HANDLERS
  // ============================================================

  const handleProcessCase = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    // Clear previous SSE updates
    setSSEUpdates([])
    setProcessingProgress(0)
    setProcessingMessage('Iniciando upload...')

    // Upload files
    const results = await uploadFiles(files)

    // If upload successful, try to connect to SSE
    if (results.length > 0) {
      // Get casoId from the response metadata or generate based on timestamp
      const casoId = results[0]?.metadata?.casoId as string || `CASO_${Date.now()}`
      connectSSE(casoId)
    }

    // Reset input
    if (e.target) {
      e.target.value = ''
    }
  }

  const handleViewCase = (caseItem: Case) => {
    setExpandedCase(expandedCase === caseItem.id ? null : caseItem.id)
  }

  // ============================================================
  // FILTERING
  // ============================================================

  const filteredCases = cases.filter(c =>
    c.caseNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.parties.plaintiff.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.parties.defendant.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Stats
  const totalCases = cases.length
  const completedCases = cases.filter(c => c.status === 'completed').length
  const processingCases = cases.filter(c => c.status === 'processing').length

  // ============================================================
  // RENDER HELPERS
  // ============================================================

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  const getStatusBadge = (status: Case['status']) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-stone-100 text-stone-600 text-xs rounded-full">
            <Clock className="w-3 h-3" />
            Pendente
          </span>
        )
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">
            <Loader2 className="w-3 h-3 animate-spin" />
            Processando
          </span>
        )
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
            <CheckCircle className="w-3 h-3" />
            Concluido
          </span>
        )
      case 'error':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
            <XCircle className="w-3 h-3" />
            Erro
          </span>
        )
      default:
        return (
          <span className="px-2 py-0.5 bg-bronze-100 text-bronze-700 text-xs rounded-full">
            {status}
          </span>
        )
    }
  }

  const getLayerName = (layer: number): string => {
    switch (layer) {
      case 1: return 'Extracao Bruta'
      case 2: return 'Indices e Metadados'
      case 3: return 'Analises Especializadas'
      case 4: return 'Jurisprudencia'
      case 5: return 'Redacao Final'
      default: return `Layer ${layer}`
    }
  }

  const getUploadStatusBadge = (status: FileInfo['status']) => {
    switch (status) {
      case 'uploading':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
            <Loader2 className="w-3 h-3 animate-spin" />
            Enviando
          </span>
        )
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">
            <Brain className="w-3 h-3 animate-pulse" />
            Processando IA
          </span>
        )
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
            <CheckCircle className="w-3 h-3" />
            Processado
          </span>
        )
      case 'error':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
            <AlertCircle className="w-3 h-3" />
            Erro
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-stone-100 text-stone-600 text-xs rounded-full">
            <Clock className="w-3 h-3" />
            Aguardando
          </span>
        )
    }
  }

  // Check if processing is happening
  const isProcessing = isUploading || currentCasoId !== null

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="h-screen flex bg-stone-50">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="bg-white border-b border-stone-200 px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-stone-800 mb-2 flex items-center gap-2">
                <Gavel className="w-6 h-6 text-bronze-500" />
                Processos Judiciais
              </h1>
              <p className="text-stone-500">
                Upload e analise automatica com IA (Layer Cake Architecture)
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchCases}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-6 mt-4">
            <div className="flex items-center gap-2 text-sm text-stone-600">
              <Scale className="w-4 h-4" />
              <span>{totalCases} processos</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle className="w-4 h-4" />
              <span>{completedCases} concluidos</span>
            </div>
            {processingCases > 0 && (
              <div className="flex items-center gap-2 text-sm text-yellow-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{processingCases} em processamento</span>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-6xl mx-auto">
            {/* Upload Area */}
            <div className="bg-white rounded-xl shadow-soft p-6 mb-6">
              <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                isProcessing
                  ? 'border-bronze-400 bg-bronze-50/50'
                  : 'border-stone-300 hover:border-bronze-400 hover:bg-bronze-50/50'
              }`}>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx"
                  onChange={handleProcessCase}
                  className="hidden"
                  id="case-upload"
                  disabled={isProcessing}
                />
                <label htmlFor="case-upload" className="cursor-pointer">
                  {isProcessing ? (
                    <>
                      <Layers className="w-10 h-10 text-bronze-500 mx-auto mb-3 animate-pulse" />
                      <p className="text-lg font-medium text-stone-700 mb-2">
                        {isUploading ? 'Enviando arquivos...' : 'Processando com IA...'}
                      </p>
                      <div className="w-80 mx-auto bg-stone-200 rounded-full h-2 mb-2">
                        <div
                          className="bg-bronze-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${isUploading ? uploadProgress : processingProgress}%` }}
                        />
                      </div>
                      <p className="text-sm text-stone-600 mb-1">
                        {processingMessage || `${isUploading ? uploadProgress : processingProgress}% concluido`}
                      </p>
                      {processingLayer > 0 && (
                        <p className="text-xs text-bronze-600">
                          <Brain className="w-3 h-3 inline mr-1" />
                          Layer {processingLayer}: {getLayerName(processingLayer)}
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <Upload className="w-10 h-10 text-stone-400 mx-auto mb-3" />
                      <p className="text-lg font-medium text-stone-700 mb-1">
                        Upload de Processo Judicial
                      </p>
                      <p className="text-sm text-stone-500">
                        Envie PDFs de processos para analise automatica com IA
                      </p>
                      <p className="text-xs text-bronze-600 mt-2">
                        <Layers className="w-3 h-3 inline mr-1" />
                        5 Layers: Extracao, Indexacao, Analise, Jurisprudencia, Redacao
                      </p>
                    </>
                  )}
                </label>
              </div>

              {/* Upload Error */}
              {uploadError && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {uploadError}
                </div>
              )}

              {/* Processing Files */}
              {attachedFiles.length > 0 && (
                <div className="mt-4 space-y-2">
                  <h3 className="text-sm font-medium text-stone-700">Arquivos:</h3>
                  {attachedFiles.map((af) => (
                    <div
                      key={af.fileInfo.id}
                      className={`flex items-center gap-3 p-3 rounded-lg ${
                        af.fileInfo.status === 'error'
                          ? 'bg-red-50 border border-red-200'
                          : af.fileInfo.status === 'completed'
                          ? 'bg-green-50 border border-green-200'
                          : 'bg-stone-50 border border-stone-200'
                      }`}
                    >
                      <FileText className={`w-4 h-4 flex-shrink-0 ${
                        af.fileInfo.status === 'error' ? 'text-red-500' :
                        af.fileInfo.status === 'completed' ? 'text-green-500' :
                        'text-stone-400'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-stone-800 truncate">
                            {af.fileInfo.name}
                          </p>
                          {getUploadStatusBadge(af.fileInfo.status)}
                        </div>
                        {af.fileInfo.status === 'uploading' && (
                          <div className="w-full bg-stone-200 rounded-full h-1 mt-1">
                            <div
                              className="bg-bronze-500 h-1 rounded-full transition-all duration-300"
                              style={{ width: `${af.fileInfo.progress}%` }}
                            />
                          </div>
                        )}
                        {af.fileInfo.error && (
                          <p className="text-xs text-red-600 mt-1">{af.fileInfo.error}</p>
                        )}
                        {af.fileInfo.status === 'completed' && af.fileInfo.structuredDocuments && (
                          <p className="text-xs text-green-600 mt-1">
                            {af.fileInfo.structuredDocuments.filesGenerated} documentos estruturados gerados
                          </p>
                        )}
                      </div>
                      {!isProcessing && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(af.fileInfo.id)}
                          className="text-stone-400 hover:text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {attachedFiles.every(af => af.fileInfo.status === 'completed') && (
                    <Button variant="ghost" size="sm" onClick={clearFiles}>
                      Limpar lista
                    </Button>
                  )}
                </div>
              )}

              {/* SSE Updates Log */}
              {sseUpdates.length > 0 && (
                <div className="mt-4 p-4 bg-stone-900 rounded-lg max-h-40 overflow-y-auto">
                  <h3 className="text-xs font-medium text-stone-400 mb-2">Log de Processamento:</h3>
                  <div className="space-y-1 font-mono text-xs">
                    {sseUpdates.map((update, index) => (
                      <div
                        key={index}
                        className={`${
                          update.type === 'error' ? 'text-red-400' :
                          update.type === 'success' ? 'text-green-400' :
                          update.type === 'warning' ? 'text-yellow-400' :
                          update.type === 'layer' ? 'text-purple-400' :
                          'text-stone-300'
                        }`}
                      >
                        {update.layer && <span className="text-purple-500">[L{update.layer}] </span>}
                        {update.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Search */}
            <div className="mb-6">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                <input
                  type="text"
                  placeholder="Buscar por numero, nome, autor ou reu..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-12 pl-12 pr-4 bg-white border border-stone-200 rounded-xl text-stone-700 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-bronze-400/30 focus:border-bronze-400"
                />
              </div>
            </div>

            {/* Cases List */}
            <div className="bg-white rounded-xl shadow-soft overflow-hidden">
              <div className="px-6 py-4 border-b border-stone-100">
                <h2 className="font-semibold text-stone-800">Processos ({filteredCases.length})</h2>
              </div>

              {loading ? (
                <div className="text-center py-12">
                  <Loader2 className="w-10 h-10 text-bronze-400 mx-auto mb-4 animate-spin" />
                  <p className="text-stone-500">Carregando processos...</p>
                </div>
              ) : filteredCases.length === 0 ? (
                <div className="text-center py-12">
                  <FolderOpen className="w-12 h-12 text-stone-300 mx-auto mb-3" />
                  <p className="text-stone-500">Nenhum processo encontrado</p>
                  <p className="text-sm text-stone-400 mt-1">
                    Faca upload de PDFs para comecar
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-stone-100">
                  {filteredCases.map((caseItem) => (
                    <div key={caseItem.id}>
                      {/* Case Header */}
                      <div
                        className="px-6 py-5 hover:bg-stone-50 transition-colors cursor-pointer"
                        onClick={() => handleViewCase(caseItem)}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-start gap-3">
                            <FileText className="w-5 h-5 text-bronze-500 flex-shrink-0 mt-0.5" />
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold text-stone-800">{caseItem.caseNumber}</h3>
                                {getStatusBadge(caseItem.status)}
                              </div>
                              <p className="text-stone-600 text-sm mb-2">{caseItem.title}</p>
                            </div>
                          </div>
                          <Button variant="ghost" size="sm">
                            {expandedCase === caseItem.id ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </Button>
                        </div>

                        <div className="ml-8 grid grid-cols-3 gap-4 text-sm">
                          <div className="flex items-center gap-2 text-stone-500">
                            <User className="w-4 h-4" />
                            <span className="truncate" title={caseItem.parties.plaintiff}>
                              {caseItem.parties.plaintiff}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-stone-500">
                            <AlertCircle className="w-4 h-4" />
                            <span className="truncate" title={caseItem.parties.defendant}>
                              {caseItem.parties.defendant}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-stone-500">
                            <Calendar className="w-4 h-4" />
                            <span>{formatDate(caseItem.createdAt)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Expanded Details */}
                      {expandedCase === caseItem.id && (
                        <div className="px-6 py-4 bg-stone-50 border-t border-stone-100">
                          <div className="ml-8 grid grid-cols-2 gap-6">
                            {/* Metadata */}
                            <div>
                              <h4 className="text-sm font-medium text-stone-700 mb-2">
                                Detalhes do Processamento
                              </h4>
                              <div className="space-y-2 text-sm">
                                {caseItem.metadata?.documentsCount && (
                                  <div className="flex items-center gap-2 text-stone-600">
                                    <FileText className="w-4 h-4" />
                                    <span>{caseItem.metadata.documentsCount} documentos</span>
                                  </div>
                                )}
                                {caseItem.metadata?.layersProcessed && (
                                  <div className="flex items-center gap-2 text-stone-600">
                                    <Layers className="w-4 h-4" />
                                    <span>{caseItem.metadata.layersProcessed}/5 layers processadas</span>
                                  </div>
                                )}
                                {caseItem.metadata?.processingTime && (
                                  <div className="flex items-center gap-2 text-stone-600">
                                    <Clock className="w-4 h-4" />
                                    <span>Tempo: {caseItem.metadata.processingTime}</span>
                                  </div>
                                )}
                                {caseItem.metadata?.structuredDocs && (
                                  <div className="flex items-center gap-2 text-stone-600">
                                    <Brain className="w-4 h-4" />
                                    <span>{caseItem.metadata.structuredDocs} docs estruturados</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Actions */}
                            <div>
                              <h4 className="text-sm font-medium text-stone-700 mb-2">
                                Acoes
                              </h4>
                              <div className="flex flex-wrap gap-2">
                                <Button variant="secondary" size="sm">
                                  <Eye className="w-4 h-4" />
                                  Ver Analise
                                </Button>
                                <Button variant="secondary" size="sm">
                                  <Brain className="w-4 h-4" />
                                  Gerar Documento
                                </Button>
                              </div>
                            </div>
                          </div>

                          {/* Extraction Summary */}
                          {caseItem.metadata?.extractionSummary && (
                            <div className="mt-4 ml-8">
                              <h4 className="text-sm font-medium text-stone-700 mb-2">
                                Resumo da Extracao
                              </h4>
                              <p className="text-sm text-stone-600 bg-white p-3 rounded-lg border border-stone-200">
                                {caseItem.metadata.extractionSummary}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
