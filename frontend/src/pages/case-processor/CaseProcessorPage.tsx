import { apiFetch } from '@/services/api'
import { useState, useEffect } from 'react'
import { Sidebar } from '@/components/layout'
import { FolderOpen, Upload, Search, FileText, Calendar, User, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui'

interface Case {
  id: string
  caseNumber: string
  title: string
  status: string
  createdAt: string
  parties: { plaintiff: string; defendant: string }
}

export function CaseProcessorPage() {
  const [cases, setCases] = useState<Case[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    fetchCases()
  }, [])

  const fetchCases = async () => {
    try {
      const response = await apiFetch('/case-processor/cases', {
        credentials: 'include',
      })
      const data = await response.json()
      if (data.success) {
        setCases(data.cases || [])
      }
    } catch (error) {
      console.error('Failed to fetch cases:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleProcessCase = async (files: FileList) => {
    setProcessing(true)

    try {
      const formData = new FormData()
      Array.from(files).forEach(file => formData.append('files', file))

      const response = await apiFetch('/case-processor/process', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })

      const data = await response.json()
      if (data.success) {
        await fetchCases()
      }
    } catch (error) {
      console.error('Processing error:', error)
    } finally {
      setProcessing(false)
    }
  }

  const filteredCases = cases.filter(c =>
    c.caseNumber.includes(searchQuery) ||
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="h-screen flex bg-stone-50">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="bg-white border-b border-stone-200 px-8 py-6">
          <h1 className="text-2xl font-semibold text-stone-800 mb-2">Processos Judiciais</h1>
          <p className="text-stone-500">Gerencie e analise processos judiciais</p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-6xl mx-auto">
            {/* Upload Area */}
            <div className="bg-white rounded-xl shadow-soft p-6 mb-6">
              <div className="border-2 border-dashed border-stone-300 rounded-xl p-8 text-center hover:border-bronze-400 hover:bg-bronze-50/50 transition-colors">
                <input
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => e.target.files && handleProcessCase(e.target.files)}
                  className="hidden"
                  id="case-upload"
                  disabled={processing}
                />
                <label htmlFor="case-upload" className="cursor-pointer">
                  <Upload className="w-10 h-10 text-stone-400 mx-auto mb-3" />
                  <p className="text-lg font-medium text-stone-700 mb-1">
                    {processing ? 'Processando...' : 'Upload de Processo'}
                  </p>
                  <p className="text-sm text-stone-500">
                    Envie PDFs de processos judiciais para análise automática
                  </p>
                </label>
              </div>
            </div>

            {/* Search */}
            <div className="mb-6">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                <input
                  type="text"
                  placeholder="Buscar por número ou nome do processo..."
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
                  <div className="w-10 h-10 border-2 border-bronze-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-stone-500">Carregando processos...</p>
                </div>
              ) : filteredCases.length === 0 ? (
                <div className="text-center py-12">
                  <FolderOpen className="w-12 h-12 text-stone-300 mx-auto mb-3" />
                  <p className="text-stone-500">Nenhum processo encontrado</p>
                </div>
              ) : (
                <div className="divide-y divide-stone-100">
                  {filteredCases.map((caseItem) => (
                    <div key={caseItem.id} className="px-6 py-5 hover:bg-stone-50 transition-colors cursor-pointer">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-start gap-3">
                          <FileText className="w-5 h-5 text-bronze-500 flex-shrink-0 mt-0.5" />
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-stone-800">{caseItem.caseNumber}</h3>
                              <span className="px-2 py-0.5 bg-bronze-100 text-bronze-700 text-xs rounded-full">
                                {caseItem.status}
                              </span>
                            </div>
                            <p className="text-stone-600 text-sm mb-2">{caseItem.title}</p>
                          </div>
                        </div>
                      </div>

                      <div className="ml-8 grid grid-cols-3 gap-4 text-sm">
                        <div className="flex items-center gap-2 text-stone-500">
                          <User className="w-4 h-4" />
                          <span>{caseItem.parties.plaintiff}</span>
                        </div>
                        <div className="flex items-center gap-2 text-stone-500">
                          <AlertCircle className="w-4 h-4" />
                          <span>{caseItem.parties.defendant}</span>
                        </div>
                        <div className="flex items-center gap-2 text-stone-500">
                          <Calendar className="w-4 h-4" />
                          <span>{new Date(caseItem.createdAt).toLocaleDateString('pt-BR')}</span>
                        </div>
                      </div>
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
