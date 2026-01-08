import { apiFetch } from '@/services/api'
import { useState, useEffect } from 'react'
import { Sidebar } from '@/components/layout'
import { Search, FileText, Copy, Check, Tag, Edit, Trash2, Plus } from 'lucide-react'
import { Button } from '@/components/ui'
import { useAuthStore } from '@/stores/authStore'

interface Prompt {
  id: string
  title: string
  description: string
  category: string
  template: string
  tags: string[]
}

export function PromptsPage() {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'admin'

  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Modal states
  const [showModal, setShowModal] = useState(false)
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null)
  const [formData, setFormData] = useState({
    id: '',
    title: '',
    description: '',
    category: 'gerais',
    template: '',
    tags: [] as string[],
  })

  useEffect(() => {
    fetchPrompts()
  }, [])

  const fetchPrompts = async () => {
    try {
      const response = await apiFetch('/rom-prompts', {
        credentials: 'include',
      })
      const data = await response.json()

      if (data.success) {
        // Flatten all categories into single array
        const allPrompts = [
          ...(data.prompts.gerais || []),
          ...(data.prompts.judiciais || []),
          ...(data.prompts.extrajudiciais || [])
        ]
        setPrompts(allPrompts)
      }
    } catch (error) {
      console.error('Failed to fetch prompts:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async (template: string, id: string) => {
    await navigator.clipboard.writeText(template)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleEdit = (prompt: Prompt) => {
    setEditingPrompt(prompt)
    setFormData({
      id: prompt.id,
      title: prompt.title,
      description: prompt.description,
      category: prompt.category,
      template: prompt.template,
      tags: prompt.tags || [],
    })
    setShowModal(true)
  }

  const handleCreate = () => {
    setEditingPrompt(null)
    setFormData({
      id: '',
      title: '',
      description: '',
      category: 'gerais',
      template: '',
      tags: [],
    })
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const promptData = {
        prompt: {
          id: formData.id || formData.title.toLowerCase().replace(/\s+/g, '-'),
          title: formData.title,
          description: formData.description,
          template: formData.template,
          tags: formData.tags,
          category: formData.category,
        }
      }

      if (editingPrompt) {
        // Update existing
        const response = await apiFetch(`/rom-prompts/${formData.category}/${promptData.prompt.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(promptData),
        })

        if (response.ok) {
          setShowModal(false)
          await fetchPrompts()
        }
      } else {
        // Create new
        const response = await apiFetch(`/rom-prompts/${formData.category}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(promptData),
        })

        if (response.ok) {
          setShowModal(false)
          setFormData({ id: '', title: '', description: '', category: 'gerais', template: '', tags: [] })
          await fetchPrompts()
        }
      }
    } catch (error) {
      console.error('Save error:', error)
    }
  }

  const handleDelete = async (prompt: Prompt) => {
    if (!confirm(`Tem certeza que deseja excluir "${prompt.title}"?`)) return

    try {
      await apiFetch(`/rom-prompts/${prompt.category}/${prompt.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      await fetchPrompts()
    } catch (error) {
      console.error('Delete error:', error)
    }
  }

  const categories = ['all', ...new Set(prompts.map(p => p.category))]

  const filteredPrompts = prompts.filter(p => {
    const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  return (
    <div className="h-screen flex bg-stone-50">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="bg-white border-b border-stone-200 px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-stone-800 mb-2">Prompts Jurídicos</h1>
              <p className="text-stone-500">Biblioteca de templates especializados para documentos jurídicos</p>
            </div>
            {isAdmin && (
              <Button onClick={handleCreate} className="gap-2">
                <Plus className="w-4 h-4" />
                Novo Prompt
              </Button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-6xl mx-auto">
            {/* Filters */}
            <div className="bg-white rounded-xl shadow-soft p-6 mb-6">
              <div className="flex flex-col md:flex-row gap-4">
                {/* Search */}
                <div className="flex-1 relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                  <input
                    type="text"
                    placeholder="Buscar prompts..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-12 pl-12 pr-4 bg-stone-50 border border-stone-200 rounded-xl text-stone-700 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-bronze-400/30 focus:border-bronze-400"
                  />
                </div>

                {/* Category Filter */}
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="h-12 px-4 bg-stone-50 border border-stone-200 rounded-xl text-stone-700 focus:outline-none focus:ring-2 focus:ring-bronze-400/30 focus:border-bronze-400"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>
                      {cat === 'all' ? 'Todas as categorias' : cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Prompts Grid */}
            {loading ? (
              <div className="text-center py-12">
                <div className="w-10 h-10 border-2 border-bronze-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-stone-500">Carregando prompts...</p>
              </div>
            ) : filteredPrompts.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl shadow-soft">
                <FileText className="w-12 h-12 text-stone-300 mx-auto mb-3" />
                <p className="text-stone-500">Nenhum prompt encontrado</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredPrompts.map((prompt) => (
                  <div
                    key={prompt.id}
                    className="bg-white rounded-xl shadow-soft p-6 hover:shadow-lg transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <FileText className="w-5 h-5 text-bronze-500 flex-shrink-0" />
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopy(prompt.template, prompt.id)}
                          className="text-stone-500 hover:text-bronze-600"
                        >
                          {copiedId === prompt.id ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                        {isAdmin && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(prompt)}
                              className="text-stone-500 hover:text-bronze-600"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(prompt)}
                              className="text-red-500 hover:text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    <h3 className="font-semibold text-stone-800 mb-2">{prompt.title}</h3>
                    <p className="text-sm text-stone-500 mb-4 line-clamp-2">{prompt.description}</p>

                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-bronze-100 text-bronze-700 text-xs rounded-lg">
                        <Tag className="w-3 h-3" />
                        {prompt.category}
                      </span>
                      {prompt.tags?.slice(0, 2).map((tag, idx) => (
                        <span key={idx} className="px-2 py-1 bg-stone-100 text-stone-600 text-xs rounded-lg">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Edição/Criação */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold text-stone-800 mb-4">
              {editingPrompt ? 'Editar Prompt' : 'Novo Prompt'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-2">Título</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full h-11 px-4 bg-stone-50 border border-stone-200 rounded-xl text-stone-700 focus:outline-none focus:ring-2 focus:ring-bronze-400/30"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-2">Categoria</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full h-11 px-4 bg-stone-50 border border-stone-200 rounded-xl text-stone-700 focus:outline-none focus:ring-2 focus:ring-bronze-400/30"
                    required
                  >
                    <option value="gerais">Gerais</option>
                    <option value="judiciais">Judiciais</option>
                    <option value="extrajudiciais">Extrajudiciais</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">Descrição</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-700 focus:outline-none focus:ring-2 focus:ring-bronze-400/30 resize-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">Template/Conteúdo</label>
                <textarea
                  value={formData.template}
                  onChange={(e) => setFormData({ ...formData, template: e.target.value })}
                  rows={12}
                  className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-700 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-bronze-400/30 resize-none"
                  required
                  placeholder="Digite o template do prompt aqui..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">Tags (separadas por vírgula)</label>
                <input
                  type="text"
                  value={formData.tags.join(', ')}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })}
                  className="w-full h-11 px-4 bg-stone-50 border border-stone-200 rounded-xl text-stone-700 focus:outline-none focus:ring-2 focus:ring-bronze-400/30"
                  placeholder="exemplo: petição, trabalhista, inicial"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={() => setShowModal(false)} className="flex-1">
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1">
                  {editingPrompt ? 'Salvar Alterações' : 'Criar Prompt'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
