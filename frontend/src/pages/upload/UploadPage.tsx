import { useState } from 'react'
import { Sidebar } from '@/components/layout'
import { Upload, FileText, Trash2, Search, Download, Eye } from 'lucide-react'
import { Button } from '@/components/ui'

export function UploadPage() {
  const [files, setFiles] = useState<any[]>([])
  const [uploading, setUploading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    if (selectedFiles.length === 0) return

    setUploading(true)

    try {
      const formData = new FormData()
      for (const file of selectedFiles) {
        formData.append('files', file)
      }

      const response = await fetch('/api/kb/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })

      if (response.ok) {
        const data = await response.json()
        // API retorna array de documentos processados
        const newFiles = data.documents?.map((doc: any) => ({
          id: doc.id,
          name: doc.name,
          size: doc.size,
          uploadedAt: doc.uploadedAt,
          structuredDocs: doc.structuredDocs || 0
        })) || []
        setFiles(prev => [...prev, ...newFiles])
      }
    } catch (error) {
      console.error('Upload error:', error)
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (fileId: string) => {
    try {
      await fetch(`/api/upload/${fileId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      setFiles(prev => prev.filter(f => f.id !== fileId))
    } catch (error) {
      console.error('Delete error:', error)
    }
  }

  const filteredFiles = files.filter(f =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="h-screen flex bg-stone-50">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="bg-white border-b border-stone-200 px-8 py-6">
          <h1 className="text-2xl font-semibold text-stone-800 mb-2">Upload & Knowledge Base</h1>
          <p className="text-stone-500">Gerencie documentos e base de conhecimento</p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-5xl mx-auto">
            {/* Upload Area */}
            <div className="bg-white rounded-xl shadow-soft p-8 mb-6">
              <div className="border-2 border-dashed border-stone-300 rounded-xl p-12 text-center hover:border-bronze-400 hover:bg-bronze-50/50 transition-colors">
                <input
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                  disabled={uploading}
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Upload className="w-12 h-12 text-stone-400 mx-auto mb-4" />
                  <p className="text-lg font-medium text-stone-700 mb-2">
                    {uploading ? 'Enviando arquivos...' : 'Clique para fazer upload'}
                  </p>
                  <p className="text-sm text-stone-500">
                    PDF, DOCX, TXT e outros formatos suportados
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
                  placeholder="Buscar documentos..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-12 pl-12 pr-4 bg-white border border-stone-200 rounded-xl text-stone-700 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-bronze-400/30 focus:border-bronze-400"
                />
              </div>
            </div>

            {/* Files List */}
            <div className="bg-white rounded-xl shadow-soft overflow-hidden">
              <div className="px-6 py-4 border-b border-stone-100">
                <h2 className="font-semibold text-stone-800">Documentos ({filteredFiles.length})</h2>
              </div>

              {filteredFiles.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 text-stone-300 mx-auto mb-3" />
                  <p className="text-stone-500">Nenhum documento encontrado</p>
                </div>
              ) : (
                <div className="divide-y divide-stone-100">
                  {filteredFiles.map((file) => (
                    <div key={file.id} className="px-6 py-4 flex items-center gap-4 hover:bg-stone-50 transition-colors">
                      <FileText className="w-5 h-5 text-bronze-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-stone-800 truncate">{file.name}</p>
                        <p className="text-sm text-stone-500">
                          {(file.size / 1024).toFixed(2)} KB
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm">
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(file.id)}
                          className="text-red-500 hover:text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
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
