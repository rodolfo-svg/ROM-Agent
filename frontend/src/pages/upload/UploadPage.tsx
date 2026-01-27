/**
 * UploadPage - Knowledge Base Upload
 *
 * Pagina para upload de documentos para a Knowledge Base com:
 * - Progress tracking em tempo real
 * - Integracao com IA (91 ferramentas de extracao)
 * - Geracao de documentos estruturados
 * - Listagem e busca de documentos
 * - Integracao com backend /api/kb/upload
 */

import { useState, useEffect, useCallback } from 'react'
import { Sidebar } from '@/components/layout'
import {
  Upload,
  FileText,
  Trash2,
  Search,
  Download,
  Eye,
  CheckCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  Brain,
  FolderOpen,
  Clock,
  Database
} from 'lucide-react'
import { Button } from '@/components/ui'
import { apiFetch, getCsrfToken } from '@/services/api'
import { useFileUpload, type FileInfo } from '@/hooks'
import { useUploadProgress } from '@/hooks/useUploadProgress'

// ============================================================
// TYPES
// ============================================================

interface KBDocument {
  id: string
  name: string
  type: string
  size: number
  uploadedAt: string
  textLength?: number
  metadata?: {
    toolsUsed?: string[]
    structuredDocuments?: number
    structuredDocsPath?: string
    wordCount?: number
    isStructuredDocument?: boolean
    parentDocument?: string
    structuredType?: string
  }
}

// ============================================================
// COMPONENT
// ============================================================

export function UploadPage() {
  // State
  const [kbDocuments, setKbDocuments] = useState<KBDocument[]>([])
  const [loadingDocuments, setLoadingDocuments] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showStructured, setShowStructured] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null)
  const [currentUploadId, setCurrentUploadId] = useState<string | null>(null)

  // SSE Progress tracking (progresso em tempo real via Server-Sent Events)
  const sseProgress = useUploadProgress(currentUploadId)

  // File upload hook - APENAS para gerenciar estado de arquivos anexados
  // Upload real é feito via handleFileUpload customizado
  const {
    attachedFiles,
    removeFile,
    clearFiles,
  } = useFileUpload({
    endpoint: 'kb',
    maxFiles: 20,
    maxSizeBytes: 500 * 1024 * 1024,
    allowedTypes: [],
    onUploadComplete: () => {}, // Não usado (upload customizado)
    onUploadError: () => {}, // Não usado (upload customizado)
  })

  // ============================================================
  // FETCH DOCUMENTS
  // ============================================================

  const fetchDocuments = useCallback(async () => {
    setLoadingDocuments(true)
    try {
      const response = await apiFetch<{ documents: KBDocument[] }>('/kb/documents')
      if (response.success && response.data?.documents) {
        setKbDocuments(response.data.documents)
      }
    } catch (error) {
      console.error('[UploadPage] Error fetching documents:', error)
    } finally {
      setLoadingDocuments(false)
    }
  }, [])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  // Detectar conclusão do upload via SSE e atualizar lista
  useEffect(() => {
    if (sseProgress.completed && !sseProgress.error) {
      console.log('[UploadPage] Upload concluído via SSE, atualizando lista...')
      fetchDocuments()
      // Reset uploadId após 2 segundos para permitir visualização do 100%
      setTimeout(() => {
        setCurrentUploadId(null)
      }, 2000)
    }
  }, [sseProgress.completed, sseProgress.error, fetchDocuments])

  // ============================================================
  // HANDLERS
  // ============================================================

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    if (selectedFiles.length === 0) return

    try {
      // Criar FormData com arquivos
      const formData = new FormData()
      selectedFiles.forEach(file => {
        formData.append('files', file)
      })

      // Obter CSRF token
      const csrfToken = getCsrfToken()

      console.log(`[UploadPage] Enviando ${selectedFiles.length} arquivo(s) para /api/kb/upload`)

      // POST para /api/kb/upload (retorna uploadId imediatamente)
      const response = await fetch('/api/kb/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
        headers: {
          'x-csrf-token': csrfToken
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      if (data.success && data.uploadId) {
        console.log(`[UploadPage] Upload iniciado: ${data.uploadId}`)
        // Definir uploadId para iniciar tracking via SSE
        setCurrentUploadId(data.uploadId)
      } else {
        console.error('[UploadPage] Resposta sem uploadId:', data)
        throw new Error(data.error || 'Falha ao iniciar upload')
      }
    } catch (error) {
      console.error('[UploadPage] Erro no upload:', error)
      alert(`Erro no upload: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
    } finally {
      // Reset input
      if (e.target) {
        e.target.value = ''
      }
    }
  }

  const handleDelete = async (docId: string) => {
    if (deleteLoading) return

    setDeleteLoading(docId)
    try {
      const response = await apiFetch(`/kb/documents/${docId}`, {
        method: 'DELETE',
      })

      if (response.success) {
        setKbDocuments(prev => prev.filter(d => d.id !== docId))
      } else {
        console.error('[UploadPage] Delete error:', response.error)
      }
    } catch (error) {
      console.error('[UploadPage] Delete error:', error)
    } finally {
      setDeleteLoading(null)
    }
  }

  const handleDownload = async (doc: KBDocument) => {
    try {
      // Open download in new tab
      window.open(`/api/kb/documents/${doc.id}/download`, '_blank')
    } catch (error) {
      console.error('[UploadPage] Download error:', error)
    }
  }

  const handleView = async (doc: KBDocument) => {
    try {
      // Open preview in new tab (could be improved with modal)
      window.open(`/api/kb/documents/${doc.id}/preview`, '_blank')
    } catch (error) {
      console.error('[UploadPage] View error:', error)
    }
  }

  // ============================================================
  // FILTERING
  // ============================================================

  const filteredDocuments = kbDocuments.filter(doc => {
    // Filter by search query
    const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase())

    // Filter structured documents
    if (!showStructured && doc.metadata?.isStructuredDocument) {
      return false
    }

    return matchesSearch
  })

  // Separate main documents and structured
  const mainDocuments = filteredDocuments.filter(d => !d.metadata?.isStructuredDocument)
  const structuredDocuments = filteredDocuments.filter(d => d.metadata?.isStructuredDocument)

  // Stats
  const totalDocs = mainDocuments.length
  const totalStructured = kbDocuments.filter(d => d.metadata?.isStructuredDocument).length
  const totalSize = kbDocuments.reduce((acc, d) => acc + d.size, 0)

  // ============================================================
  // RENDER HELPERS
  // ============================================================

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getFileIcon = (doc: KBDocument) => {
    if (doc.metadata?.isStructuredDocument) {
      return <Brain className="w-5 h-5 text-purple-500 flex-shrink-0" />
    }
    return <FileText className="w-5 h-5 text-bronze-500 flex-shrink-0" />
  }

  const getStatusBadge = (status: FileInfo['status']) => {
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
            Concluido
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
              <h1 className="text-2xl font-semibold text-stone-800 mb-2">
                Knowledge Base
              </h1>
              <p className="text-stone-500">
                Upload de documentos com extracao automatica por IA
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchDocuments}
              disabled={loadingDocuments}
            >
              <RefreshCw className={`w-4 h-4 ${loadingDocuments ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-6 mt-4">
            <div className="flex items-center gap-2 text-sm text-stone-600">
              <Database className="w-4 h-4" />
              <span>{totalDocs} documentos</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-stone-600">
              <Brain className="w-4 h-4" />
              <span>{totalStructured} docs estruturados</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-stone-600">
              <FolderOpen className="w-4 h-4" />
              <span>{formatFileSize(totalSize)} total</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-5xl mx-auto">
            {/* Upload Area */}
            <div className="bg-white rounded-xl shadow-soft p-8 mb-6">
              <div
                className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
                  currentUploadId && !sseProgress.completed
                    ? 'border-bronze-400 bg-bronze-50/50'
                    : 'border-stone-300 hover:border-bronze-400 hover:bg-bronze-50/50'
                }`}
              >
                <input
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                  disabled={currentUploadId !== null && !sseProgress.completed}
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  {currentUploadId && !sseProgress.completed ? (
                    <>
                      {sseProgress.error ? (
                        <>
                          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                          <p className="text-lg font-medium text-red-700 mb-2">
                            Erro no processamento
                          </p>
                          <p className="text-sm text-stone-600 mb-4">
                            {sseProgress.error}
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setCurrentUploadId(null)
                              fetchDocuments()
                            }}
                          >
                            Tentar novamente
                          </Button>
                        </>
                      ) : (
                        <>
                          <Loader2 className="w-12 h-12 text-bronze-500 mx-auto mb-4 animate-spin" />
                          <p className="text-lg font-medium text-stone-700 mb-2">
                            {sseProgress.stage}
                          </p>

                          {/* Barra de Progresso com Percentual */}
                          <div className="w-full max-w-md mx-auto mb-3">
                            <div className="w-full bg-stone-200 rounded-full h-3 overflow-hidden">
                              <div
                                className="bg-bronze-500 h-3 rounded-full transition-all duration-300 ease-out"
                                style={{ width: `${Math.min(sseProgress.percent, 100)}%` }}
                              />
                            </div>

                            {/* Percentual e Informações */}
                            <div className="flex justify-between items-center mt-2 text-sm text-stone-600">
                              <span className="truncate">{sseProgress.stage}</span>
                              <span className="font-semibold ml-2">{sseProgress.percent}%</span>
                            </div>
                          </div>

                          {/* Informação de Arquivo Atual (se múltiplos) */}
                          {sseProgress.totalFiles > 1 && (
                            <p className="text-xs text-stone-500 mt-2">
                              Arquivo {sseProgress.currentFile} de {sseProgress.totalFiles}
                              {sseProgress.fileName && `: ${sseProgress.fileName}`}
                            </p>
                          )}
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <Upload className="w-12 h-12 text-stone-400 mx-auto mb-4" />
                      <p className="text-lg font-medium text-stone-700 mb-2">
                        Clique ou arraste arquivos aqui
                      </p>
                      <p className="text-sm text-stone-500">
                        PDF, DOCX, TXT, imagens e outros formatos - Ate 500MB por arquivo
                      </p>
                      <p className="text-xs text-bronze-600 mt-2">
                        <Brain className="w-3 h-3 inline mr-1" />
                        Extracao automatica com 91 ferramentas de IA
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

              {/* Uploading Files */}
              {attachedFiles.length > 0 && (
                <div className="mt-4 space-y-2">
                  <h3 className="text-sm font-medium text-stone-700">Upload em andamento:</h3>
                  {attachedFiles.map((af) => (
                    <div
                      key={af.fileInfo.id}
                      className="flex items-center gap-3 p-3 bg-stone-50 rounded-lg"
                    >
                      <FileText className="w-4 h-4 text-stone-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-stone-800 truncate">
                            {af.fileInfo.name}
                          </p>
                          {getStatusBadge(af.fileInfo.status)}
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
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(af.fileInfo.id)}
                        className="text-stone-400 hover:text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  {attachedFiles.some(af => af.fileInfo.status === 'completed') && (
                    <Button variant="ghost" size="sm" onClick={clearFiles}>
                      Limpar lista
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Search and Filters */}
            <div className="mb-6 flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                <input
                  type="text"
                  placeholder="Buscar documentos..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-12 pl-12 pr-4 bg-white border border-stone-200 rounded-xl text-stone-700 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-bronze-400/30 focus:border-bronze-400"
                />
              </div>
              <Button
                variant={showStructured ? 'primary' : 'secondary'}
                onClick={() => setShowStructured(!showStructured)}
              >
                <Brain className="w-4 h-4" />
                Docs IA
              </Button>
            </div>

            {/* Files List */}
            <div className="bg-white rounded-xl shadow-soft overflow-hidden">
              <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
                <h2 className="font-semibold text-stone-800">
                  Documentos ({mainDocuments.length})
                </h2>
                {showStructured && structuredDocuments.length > 0 && (
                  <span className="text-sm text-purple-600">
                    + {structuredDocuments.length} documentos estruturados
                  </span>
                )}
              </div>

              {loadingDocuments ? (
                <div className="text-center py-12">
                  <Loader2 className="w-10 h-10 text-bronze-400 mx-auto mb-4 animate-spin" />
                  <p className="text-stone-500">Carregando documentos...</p>
                </div>
              ) : mainDocuments.length === 0 && !showStructured ? (
                <div className="text-center py-12">
                  <FolderOpen className="w-12 h-12 text-stone-300 mx-auto mb-3" />
                  <p className="text-stone-500">Nenhum documento encontrado</p>
                  <p className="text-sm text-stone-400 mt-1">
                    Faca upload de arquivos para comecar
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-stone-100">
                  {/* Main Documents */}
                  {mainDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      className="px-6 py-4 flex items-center gap-4 hover:bg-stone-50 transition-colors"
                    >
                      {getFileIcon(doc)}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-stone-800 truncate">{doc.name}</p>
                        <div className="flex items-center gap-4 text-sm text-stone-500 mt-1">
                          <span>{formatFileSize(doc.size)}</span>
                          <span>{formatDate(doc.uploadedAt)}</span>
                          {doc.metadata?.structuredDocuments && doc.metadata.structuredDocuments > 0 && (
                            <span className="text-purple-600">
                              <Brain className="w-3 h-3 inline mr-1" />
                              {doc.metadata.structuredDocuments} docs gerados
                            </span>
                          )}
                          {doc.textLength && (
                            <span>{doc.textLength.toLocaleString()} caracteres</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleView(doc)}
                          title="Visualizar"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(doc)}
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(doc.id)}
                          disabled={deleteLoading === doc.id}
                          className="text-red-500 hover:text-red-600 hover:bg-red-50"
                          title="Excluir"
                        >
                          {deleteLoading === doc.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}

                  {/* Structured Documents Section */}
                  {showStructured && structuredDocuments.length > 0 && (
                    <>
                      <div className="px-6 py-3 bg-purple-50 border-y border-purple-100">
                        <h3 className="text-sm font-medium text-purple-700 flex items-center gap-2">
                          <Brain className="w-4 h-4" />
                          Documentos Estruturados por IA ({structuredDocuments.length})
                        </h3>
                      </div>
                      {structuredDocuments.map((doc) => (
                        <div
                          key={doc.id}
                          className="px-6 py-4 flex items-center gap-4 hover:bg-purple-50/50 transition-colors bg-purple-50/20"
                        >
                          {getFileIcon(doc)}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-stone-800 truncate">{doc.name}</p>
                            <div className="flex items-center gap-4 text-sm text-stone-500 mt-1">
                              <span>{formatFileSize(doc.size)}</span>
                              {doc.metadata?.parentDocument && (
                                <span className="text-purple-600">
                                  Origem: {doc.metadata.parentDocument}
                                </span>
                              )}
                              {doc.metadata?.structuredType && (
                                <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">
                                  {doc.metadata.structuredType}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleView(doc)}
                              title="Visualizar"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownload(doc)}
                              title="Download"
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
