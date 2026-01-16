import { apiFetch } from '@/services/api'
import { useState, useEffect, useRef } from 'react'
import { Sidebar } from '@/components/layout'
import { FileCheck, Search, Download, Eye, Calendar, CheckCircle, Clock, Upload, FileText, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui'
import { useFileUpload, type FileInfo } from '@/hooks'

interface Certidao {
  id: string
  type: string
  personName: string
  cpfCnpj: string
  status: 'pending' | 'completed' | 'error'
  createdAt: string
  completedAt?: string
  document?: string
  // Dados de upload com IA
  uploadedFiles?: {
    id: string
    name: string
    extractedData?: string
    structuredDocs?: number
  }[]
}

export function CertidoesPage() {
  const [certidoes, setCertidoes] = useState<Certidao[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({
    type: 'criminal',
    personName: '',
    cpfCnpj: '',
  })

  // File upload with AI integration
  const fileInputRef = useRef<HTMLInputElement>(null)
  const {
    attachedFiles,
    isUploading,
    uploadProgress,
    error: uploadError,
    uploadFile,
    uploadFiles,
    removeFile,
    clearFiles,
    getExtractedData,
  } = useFileUpload({
    endpoint: 'kb', // Use KB endpoint with AI extraction
    maxFiles: 10,
    maxSizeBytes: 500 * 1024 * 1024, // 500MB para documentos jurídicos grandes
    allowedTypes: ['application/pdf', 'image/png', 'image/jpeg'],
    onUploadComplete: (file, fileInfo) => {
      console.log(`Upload completo: ${file.name}`, fileInfo)
      if (fileInfo.structuredDocuments?.filesGenerated) {
        console.log(`Documentos estruturados gerados: ${fileInfo.structuredDocuments.filesGenerated}`)
      }
    },
    onUploadError: (file, error) => {
      console.error(`Erro no upload de ${file.name}:`, error)
    },
  })

  useEffect(() => {
    fetchCertidoes()
  }, [])

  const fetchCertidoes = async () => {
    try {
      const response = await apiFetch('/certidoes', {
        credentials: 'include',
      })
      const data = await response.json()
      if (data.success) {
        setCertidoes(data.certidoes || [])
      }
    } catch (error) {
      console.error('Failed to fetch certidoes:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      // Incluir dados dos arquivos processados pela IA
      const extractedData = getExtractedData()
      const uploadedFilesData = attachedFiles
        .filter(af => af.fileInfo.status === 'completed')
        .map(af => ({
          id: af.fileInfo.id,
          name: af.fileInfo.name,
          extractedData: af.fileInfo.extractedText?.substring(0, 1000), // Resumo
          structuredDocs: af.fileInfo.structuredDocuments?.filesGenerated,
          toolsUsed: af.fileInfo.toolsUsed,
        }))

      const requestData = {
        ...formData,
        uploadedFiles: uploadedFilesData,
        hasDocuments: uploadedFilesData.length > 0,
      }

      const response = await apiFetch('/certidoes/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(requestData),
      })

      if (response.success) {
        setShowModal(false)
        setFormData({ type: 'criminal', personName: '', cpfCnpj: '' })
        clearFiles() // Limpar arquivos anexados
        await fetchCertidoes()
      }
    } catch (error) {
      console.error('Request error:', error)
    }
  }

  const filteredCertidoes = certidoes.filter(c =>
    c.personName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.cpfCnpj.includes(searchQuery)
  )

  return (
    <div className="h-screen flex bg-stone-50">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="bg-white border-b border-stone-200 px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-stone-800 mb-2">Certidões Judiciais</h1>
              <p className="text-stone-500">Solicite e gerencie certidões judiciais</p>
            </div>
            <Button onClick={() => setShowModal(true)} className="gap-2">
              <FileCheck className="w-4 h-4" />
              Nova Solicitação
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-6xl mx-auto">
            {/* Search */}
            <div className="mb-6">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                <input
                  type="text"
                  placeholder="Buscar por nome ou CPF/CNPJ..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-12 pl-12 pr-4 bg-white border border-stone-200 rounded-xl text-stone-700 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-bronze-400/30 focus:border-bronze-400"
                />
              </div>
            </div>

            {/* Certidoes List */}
            <div className="bg-white rounded-xl shadow-soft overflow-hidden">
              <div className="px-6 py-4 border-b border-stone-100">
                <h2 className="font-semibold text-stone-800">Solicitações ({filteredCertidoes.length})</h2>
              </div>

              {loading ? (
                <div className="text-center py-12">
                  <div className="w-10 h-10 border-2 border-bronze-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-stone-500">Carregando certidões...</p>
                </div>
              ) : filteredCertidoes.length === 0 ? (
                <div className="text-center py-12">
                  <FileCheck className="w-12 h-12 text-stone-300 mx-auto mb-3" />
                  <p className="text-stone-500">Nenhuma certidão encontrada</p>
                </div>
              ) : (
                <div className="divide-y divide-stone-100">
                  {filteredCertidoes.map((certidao) => (
                    <div key={certidao.id} className="px-6 py-5 hover:bg-stone-50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          <FileCheck className="w-5 h-5 text-bronze-500 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-stone-800">{certidao.personName}</h3>
                              {certidao.status === 'completed' && (
                                <CheckCircle className="w-4 h-4 text-green-500" />
                              )}
                              {certidao.status === 'pending' && (
                                <Clock className="w-4 h-4 text-bronze-500" />
                              )}
                            </div>
                            <p className="text-sm text-stone-600 mb-2">
                              {certidao.type} • {certidao.cpfCnpj}
                            </p>
                            <div className="flex items-center gap-4 text-sm text-stone-500">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                {new Date(certidao.createdAt).toLocaleDateString('pt-BR')}
                              </span>
                              {certidao.completedAt && (
                                <span>Concluída em {new Date(certidao.completedAt).toLocaleDateString('pt-BR')}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {certidao.status === 'completed' && (
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm">
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Download className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-semibold text-stone-800 mb-4">Nova Solicitação</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">Tipo de Certidão</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full h-11 px-4 bg-stone-50 border border-stone-200 rounded-xl text-stone-700 focus:outline-none focus:ring-2 focus:ring-bronze-400/30"
                  required
                >
                  <option value="criminal">Criminal</option>
                  <option value="civil">Cível</option>
                  <option value="trabalhista">Trabalhista</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">Nome Completo</label>
                <input
                  type="text"
                  value={formData.personName}
                  onChange={(e) => setFormData({ ...formData, personName: e.target.value })}
                  className="w-full h-11 px-4 bg-stone-50 border border-stone-200 rounded-xl text-stone-700 focus:outline-none focus:ring-2 focus:ring-bronze-400/30"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">CPF/CNPJ</label>
                <input
                  type="text"
                  value={formData.cpfCnpj}
                  onChange={(e) => setFormData({ ...formData, cpfCnpj: e.target.value })}
                  className="w-full h-11 px-4 bg-stone-50 border border-stone-200 rounded-xl text-stone-700 focus:outline-none focus:ring-2 focus:ring-bronze-400/30"
                  required
                />
              </div>

              {/* Upload de Documentos com IA */}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  Documentos (opcional)
                </label>
                <div
                  className={`border-2 border-dashed rounded-xl p-4 text-center transition-colors cursor-pointer ${
                    isUploading
                      ? 'border-bronze-400 bg-bronze-50/50'
                      : 'border-stone-300 hover:border-bronze-400 hover:bg-bronze-50/30'
                  }`}
                  onClick={() => !isUploading && fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const files = Array.from(e.target.files || [])
                      if (files.length > 0) {
                        await uploadFiles(files)
                      }
                      e.target.value = ''
                    }}
                    disabled={isUploading}
                  />
                  {isUploading ? (
                    <div className="py-2">
                      <Loader2 className="w-8 h-8 text-bronze-500 mx-auto mb-2 animate-spin" />
                      <p className="text-sm text-stone-600">Processando com IA... {uploadProgress}%</p>
                      <div className="w-full h-2 bg-stone-200 rounded-full mt-2">
                        <div
                          className="h-2 bg-bronze-500 rounded-full transition-all"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="py-2">
                      <Upload className="w-8 h-8 text-stone-400 mx-auto mb-2" />
                      <p className="text-sm text-stone-600">Clique para anexar documentos</p>
                      <p className="text-xs text-stone-400 mt-1">PDF ou imagens - processado com IA</p>
                    </div>
                  )}
                </div>

                {/* Lista de arquivos anexados */}
                {attachedFiles.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {attachedFiles.map((af) => (
                      <div
                        key={af.fileInfo.id}
                        className={`flex items-center gap-3 p-2 rounded-lg ${
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
                          <p className="text-sm text-stone-700 truncate">{af.fileInfo.name}</p>
                          {af.fileInfo.status === 'completed' && af.fileInfo.structuredDocuments && (
                            <p className="text-xs text-green-600">
                              {af.fileInfo.structuredDocuments.filesGenerated} docs gerados
                            </p>
                          )}
                          {af.fileInfo.status === 'error' && (
                            <p className="text-xs text-red-600">{af.fileInfo.error}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFile(af.fileInfo.id)}
                          className="p-1 hover:bg-stone-200 rounded"
                        >
                          <X className="w-4 h-4 text-stone-500" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {uploadError && (
                  <p className="text-sm text-red-600 mt-2">{uploadError}</p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={() => setShowModal(false)} className="flex-1">
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1">
                  Solicitar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
