import { useState, useEffect } from 'react'
import { Sidebar } from '@/components/layout'
import { Users as UsersIcon, Search, Plus, Edit, Trash2, Shield, Mail } from 'lucide-react'
import { Button, Avatar } from '@/components/ui'
import { apiFetch } from '@/services/api'

interface User {
  id: string
  name: string
  email: string
  role: 'admin' | 'user' | 'viewer'
  oab?: string
  createdAt: string
  lastLoginAt?: string
}

export function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'user' as User['role'],
    oab: '',
    password: '',
  })

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const response = await apiFetch<{ users: User[] }>('/users')
      if (response.success && response.data) {
        setUsers(response.data.users || [])
      }
    } catch (error) {
      console.error('Failed to fetch users:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const url = editingUser ? `/users/${editingUser.id}` : '/users'
      const method = editingUser ? 'PUT' : 'POST'

      const response = await apiFetch<{ user: User }>(url, {
        method,
        body: JSON.stringify(formData),
      })

      if (response.success) {
        setShowModal(false)
        setEditingUser(null)
        setFormData({ name: '', email: '', role: 'user', oab: '', password: '' })
        await fetchUsers()
      }
    } catch (error) {
      console.error('Save error:', error)
    }
  }

  const handleEdit = (user: User) => {
    setEditingUser(user)
    setFormData({
      name: user.name,
      email: user.email,
      role: user.role,
      oab: user.oab || '',
      password: '',
    })
    setShowModal(true)
  }

  const handleDelete = async (userId: string) => {
    if (!confirm('Tem certeza que deseja excluir este usuário?')) return

    try {
      await apiFetch(`/users/${userId}`, { method: 'DELETE' })
      await fetchUsers()
    } catch (error) {
      console.error('Delete error:', error)
    }
  }

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-700'
      case 'user': return 'bg-blue-100 text-blue-700'
      case 'viewer': return 'bg-gray-100 text-gray-700'
      default: return 'bg-stone-100 text-stone-700'
    }
  }

  return (
    <div className="h-screen flex bg-stone-50">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="bg-white border-b border-stone-200 px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-stone-800 mb-2">Gerenciamento de Usuários</h1>
              <p className="text-stone-500">Gerencie usuários e permissões do sistema</p>
            </div>
            <Button onClick={() => { setEditingUser(null); setFormData({ name: '', email: '', role: 'user', oab: '', password: '' }); setShowModal(true) }} className="gap-2">
              <Plus className="w-4 h-4" />
              Novo Usuário
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
                  placeholder="Buscar usuários..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-12 pl-12 pr-4 bg-white border border-stone-200 rounded-xl text-stone-700 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-bronze-400/30 focus:border-bronze-400"
                />
              </div>
            </div>

            {/* Users List */}
            <div className="bg-white rounded-xl shadow-soft overflow-hidden">
              <div className="px-6 py-4 border-b border-stone-100">
                <h2 className="font-semibold text-stone-800">Usuários ({filteredUsers.length})</h2>
              </div>

              {loading ? (
                <div className="text-center py-12">
                  <div className="w-10 h-10 border-2 border-bronze-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-stone-500">Carregando usuários...</p>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-12">
                  <UsersIcon className="w-12 h-12 text-stone-300 mx-auto mb-3" />
                  <p className="text-stone-500">Nenhum usuário encontrado</p>
                </div>
              ) : (
                <div className="divide-y divide-stone-100">
                  {filteredUsers.map((user) => (
                    <div key={user.id} className="px-6 py-5 flex items-center gap-4 hover:bg-stone-50 transition-colors">
                      <Avatar name={user.name} size="md" />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-stone-800">{user.name}</h3>
                          <span className={`px-2 py-0.5 text-xs rounded-full ${getRoleBadgeColor(user.role)}`}>
                            {user.role}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-stone-500">
                          <span className="flex items-center gap-1">
                            <Mail className="w-4 h-4" />
                            {user.email}
                          </span>
                          {user.oab && (
                            <span className="flex items-center gap-1">
                              <Shield className="w-4 h-4" />
                              {user.oab}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(user)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(user.id)}
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-semibold text-stone-800 mb-4">
              {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
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
                <label className="block text-sm font-medium text-stone-700 mb-2">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full h-11 px-4 bg-stone-50 border border-stone-200 rounded-xl text-stone-700 focus:outline-none focus:ring-2 focus:ring-bronze-400/30"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">Função</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as User['role'] })}
                  className="w-full h-11 px-4 bg-stone-50 border border-stone-200 rounded-xl text-stone-700 focus:outline-none focus:ring-2 focus:ring-bronze-400/30"
                  required
                >
                  <option value="viewer">Visualizador</option>
                  <option value="user">Usuário</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">OAB (opcional)</label>
                <input
                  type="text"
                  value={formData.oab}
                  onChange={(e) => setFormData({ ...formData, oab: e.target.value })}
                  className="w-full h-11 px-4 bg-stone-50 border border-stone-200 rounded-xl text-stone-700 focus:outline-none focus:ring-2 focus:ring-bronze-400/30"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  Senha {editingUser && '(deixe em branco para não alterar)'}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full h-11 px-4 bg-stone-50 border border-stone-200 rounded-xl text-stone-700 focus:outline-none focus:ring-2 focus:ring-bronze-400/30"
                  required={!editingUser}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={() => setShowModal(false)} className="flex-1">
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1">
                  {editingUser ? 'Salvar' : 'Criar'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
