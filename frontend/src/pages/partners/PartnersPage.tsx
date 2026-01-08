import { useState, useEffect } from 'react'
import { Sidebar } from '@/components/layout'
import { Building2, Search, Plus, Edit, Trash2, Globe, Key } from 'lucide-react'
import { Button } from '@/components/ui'
import { apiFetch } from '@/services/api'

interface Partner {
  id: string
  name: string
  subdomain: string
  logoUrl?: string
  letterheadUrl?: string
  primaryColor?: string
  isActive: boolean
  createdAt: string
  userCount?: number
}

export function PartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    subdomain: '',
    logoUrl: '',
    letterheadUrl: '',
    primaryColor: '#8B7355',
    isActive: true,
  })

  useEffect(() => {
    fetchPartners()
  }, [])

  const fetchPartners = async () => {
    try {
      const response = await apiFetch<{ partners: Partner[] }>('/partners')
      if (response.success && response.data) {
        setPartners(response.data.partners || [])
      }
    } catch (error) {
      console.error('Failed to fetch partners:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const url = editingPartner ? `/partners/${editingPartner.id}` : '/partners'
      const method = editingPartner ? 'PUT' : 'POST'

      const response = await apiFetch<{ partner: Partner }>(url, {
        method,
        body: JSON.stringify(formData),
      })

      if (response.success) {
        setShowModal(false)
        setEditingPartner(null)
        setFormData({ name: '', subdomain: '', logoUrl: '', letterheadUrl: '', primaryColor: '#8B7355', isActive: true })
        await fetchPartners()
      }
    } catch (error) {
      console.error('Save error:', error)
    }
  }

  const handleEdit = (partner: Partner) => {
    setEditingPartner(partner)
    setFormData({
      name: partner.name,
      subdomain: partner.subdomain,
      logoUrl: partner.logoUrl || '',
      letterheadUrl: partner.letterheadUrl || '',
      primaryColor: partner.primaryColor || '#8B7355',
      isActive: partner.isActive,
    })
    setShowModal(true)
  }

  const handleDelete = async (partnerId: string) => {
    if (!confirm('Tem certeza que deseja excluir este parceiro? Todos os usuários associados serão desativados.')) return

    try {
      await apiFetch(`/partners/${partnerId}`, {
        method: 'DELETE',
      })
      await fetchPartners()
    } catch (error) {
      console.error('Delete error:', error)
    }
  }

  const filteredPartners = partners.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.subdomain.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="h-screen flex bg-stone-50">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="bg-white border-b border-stone-200 px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-stone-800 mb-2">Parceiros (Multi-Tenancy)</h1>
              <p className="text-stone-500">Gerencie escritórios e organizações parceiras</p>
            </div>
            <Button onClick={() => { setEditingPartner(null); setFormData({ name: '', subdomain: '', logoUrl: '', letterheadUrl: '', primaryColor: '#8B7355', isActive: true }); setShowModal(true) }} className="gap-2">
              <Plus className="w-4 h-4" />
              Novo Parceiro
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
                  placeholder="Buscar parceiros..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-12 pl-12 pr-4 bg-white border border-stone-200 rounded-xl text-stone-700 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-bronze-400/30 focus:border-bronze-400"
                />
              </div>
            </div>

            {/* Partners Grid */}
            {loading ? (
              <div className="text-center py-12">
                <div className="w-10 h-10 border-2 border-bronze-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-stone-500">Carregando parceiros...</p>
              </div>
            ) : filteredPartners.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl shadow-soft">
                <Building2 className="w-12 h-12 text-stone-300 mx-auto mb-3" />
                <p className="text-stone-500">Nenhum parceiro encontrado</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredPartners.map((partner) => (
                  <div
                    key={partner.id}
                    className="bg-white rounded-xl shadow-soft p-6 hover:shadow-lg transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-semibold"
                          style={{ backgroundColor: partner.primaryColor || '#8B7355' }}
                        >
                          {partner.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-semibold text-stone-800">{partner.name}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`px-2 py-0.5 text-xs rounded-full ${partner.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {partner.isActive ? 'Ativo' : 'Inativo'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(partner)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(partner.id)}
                          className="text-red-500 hover:text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2 text-sm text-stone-600">
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-stone-400" />
                        <span className="font-mono">{partner.subdomain}.iarom.com.br</span>
                      </div>
                      {partner.userCount !== undefined && (
                        <div className="flex items-center gap-2">
                          <Key className="w-4 h-4 text-stone-400" />
                          <span>{partner.userCount} usuário{partner.userCount !== 1 ? 's' : ''}</span>
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-semibold text-stone-800 mb-4">
              {editingPartner ? 'Editar Parceiro' : 'Novo Parceiro'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">Nome</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full h-11 px-4 bg-stone-50 border border-stone-200 rounded-xl text-stone-700 focus:outline-none focus:ring-2 focus:ring-bronze-400/30"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">Subdomínio</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={formData.subdomain}
                    onChange={(e) => setFormData({ ...formData, subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                    className="flex-1 h-11 px-4 bg-stone-50 border border-stone-200 rounded-xl text-stone-700 focus:outline-none focus:ring-2 focus:ring-bronze-400/30"
                    required
                    placeholder="exemplo"
                  />
                  <span className="text-sm text-stone-500">.iarom.com.br</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">Logo URL (opcional)</label>
                <input
                  type="url"
                  value={formData.logoUrl}
                  onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
                  className="w-full h-11 px-4 bg-stone-50 border border-stone-200 rounded-xl text-stone-700 focus:outline-none focus:ring-2 focus:ring-bronze-400/30"
                  placeholder="https://exemplo.com/logo.png"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">Timbre/Letterhead URL (opcional)</label>
                <input
                  type="url"
                  value={formData.letterheadUrl}
                  onChange={(e) => setFormData({ ...formData, letterheadUrl: e.target.value })}
                  className="w-full h-11 px-4 bg-stone-50 border border-stone-200 rounded-xl text-stone-700 focus:outline-none focus:ring-2 focus:ring-bronze-400/30"
                  placeholder="https://exemplo.com/timbre.png"
                />
                <p className="text-xs text-stone-500 mt-1">Imagem do timbre do escritório para documentos oficiais</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">Cor Primária</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={formData.primaryColor}
                    onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                    className="w-14 h-11 rounded-xl border border-stone-200 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={formData.primaryColor}
                    onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                    className="flex-1 h-11 px-4 bg-stone-50 border border-stone-200 rounded-xl text-stone-700 font-mono focus:outline-none focus:ring-2 focus:ring-bronze-400/30"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 rounded border-stone-300 text-bronze-600 focus:ring-bronze-400"
                />
                <label htmlFor="isActive" className="text-sm font-medium text-stone-700">
                  Parceiro ativo
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={() => setShowModal(false)} className="flex-1">
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1">
                  {editingPartner ? 'Salvar' : 'Criar'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
