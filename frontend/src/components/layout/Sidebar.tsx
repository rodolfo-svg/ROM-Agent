import { useState, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Plus,
  MessageSquare,
  Search,
  Settings,
  LogOut,
  Trash2,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Upload,
  FileText,
  Users,
  Building2,
  Workflow,
  FolderOpen,
  FileCheck,
  LayoutDashboard,
  BarChart3
} from 'lucide-react'
import { useChatStore } from '@/stores/chatStore'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import { cn, groupConversationsByDate, truncate } from '@/utils'
import { Button, Avatar } from '@/components/ui'

const navigationItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, adminOnly: false },
  { path: '/upload', label: 'Upload & KB', icon: Upload, adminOnly: false },
  { path: '/prompts', label: 'Prompts Jurídicos', icon: FileText, adminOnly: false },
  { path: '/multi-agent', label: 'Multi-Agent', icon: Workflow, adminOnly: false },
  { path: '/case-processor', label: 'Processos', icon: FolderOpen, adminOnly: false },
  { path: '/certidoes', label: 'Certidões', icon: FileCheck, adminOnly: false },
  { path: '/reports', label: 'Relatórios', icon: BarChart3, adminOnly: true },
  { path: '/users', label: 'Usuários', icon: Users, adminOnly: true },
  { path: '/partners', label: 'Parceiros', icon: Building2, adminOnly: true },
]

export function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchQuery, setSearchQuery] = useState('')
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const {
    conversations,
    activeConversationId,
    createConversation,
    selectConversation,
    deleteConversation
  } = useChatStore()

  const { user, logout } = useAuthStore()
  const { sidebarCollapsed, toggleSidebarCollapse } = useUIStore()

  // Filter and group conversations
  const filteredConversations = useMemo(() => {
    if (!searchQuery) return conversations
    return conversations.filter(c => 
      c.title.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [conversations, searchQuery])

  const groupedConversations = useMemo(() => 
    groupConversationsByDate(filteredConversations),
    [filteredConversations]
  )

  const handleNewChat = () => {
    const conv = createConversation()
    selectConversation(conv.id)
    navigate('/')
  }

  const handleSelect = (id: string) => {
    selectConversation(id)
    navigate(`/chat/${id}`)
  }

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (confirm('Excluir esta conversa?')) {
      deleteConversation(id)
    }
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  if (sidebarCollapsed) {
    return (
      <aside className="w-16 h-screen bg-white border-r border-stone-200 flex flex-col max-md:hidden">
        <div className="p-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNewChat}
            className="w-10 h-10"
          >
            <Plus className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex-1" />

        <div className="p-3 border-t border-stone-200">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebarCollapse}
            className="w-10 h-10"
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
      </aside>
    )
  }

  return (
    <>
      {/* Mobile backdrop */}
      {!sidebarCollapsed && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={toggleSidebarCollapse}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "w-[280px] h-screen bg-white border-r border-stone-200 flex flex-col",
        "max-md:fixed max-md:left-0 max-md:top-0 max-md:z-50",
        "max-md:transition-transform max-md:duration-300",
        sidebarCollapsed && "max-md:-translate-x-full"
      )}>
      {/* Header */}
      <div className="p-4 border-b border-stone-100">
        <div className="flex items-center gap-3 mb-4">
          <img
            src="/img/logo-rom-signature.png"
            alt="ROM"
            className="h-8 w-auto"
          />
          <span className="font-semibold text-stone-800">ROM Agent</span>
          <button
            onClick={toggleSidebarCollapse}
            className="ml-auto p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="px-2 py-3 border-b border-stone-100">
        <div className="space-y-0.5">
          {navigationItems
            .filter(item => !item.adminOnly || user?.role === 'admin')
            .map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.path
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-bronze-100 text-bronze-700'
                      : 'text-stone-600 hover:bg-stone-100'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </button>
              )
            })}
        </div>
      </nav>

      {/* Chat Section */}
      <div className="px-3 py-3 border-b border-stone-100">
        <Button
          variant="secondary"
          size="sm"
          className="w-full justify-start gap-2"
          onClick={handleNewChat}
        >
          <Plus className="w-4 h-4" />
          Nova conversa
        </Button>
      </div>

      {/* Search */}
      <div className="p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            type="text"
            placeholder="Buscar conversas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-3 bg-stone-100 border-0 rounded-lg text-sm text-stone-700 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-bronze-400/30"
          />
        </div>
      </div>

      {/* Conversations list */}
      <nav className="flex-1 overflow-y-auto px-2">
        {groupedConversations.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="w-10 h-10 text-stone-300 mx-auto mb-2" />
            <p className="text-sm text-stone-400">
              {searchQuery ? 'Nenhuma conversa encontrada' : 'Nenhuma conversa ainda'}
            </p>
          </div>
        ) : (
          groupedConversations.map(group => (
            <div key={group.label} className="mb-4">
              <h3 className="px-3 py-2 text-xs font-medium text-stone-400 uppercase tracking-wider">
                {group.label}
              </h3>
              <ul className="space-y-0.5">
                {group.items.map(conv => (
                  <li key={conv.id}>
                    <button
                      onClick={() => handleSelect(conv.id)}
                      onMouseEnter={() => setHoveredId(conv.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      className={cn(
                        'w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition-colors',
                        activeConversationId === conv.id
                          ? 'bg-bronze-100 text-stone-800'
                          : 'text-stone-600 hover:bg-stone-100'
                      )}
                    >
                      <MessageSquare className="w-4 h-4 flex-shrink-0 text-stone-400" />
                      <span className="flex-1 text-sm truncate">
                        {truncate(conv.title, 28)}
                      </span>
                      {(hoveredId === conv.id || activeConversationId === conv.id) && (
                        <button
                          onClick={(e) => handleDelete(e, conv.id)}
                          className="p-1 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </nav>

      {/* User section */}
      <div className="p-3 border-t border-stone-200">
        <div className="flex items-center gap-3 px-2 py-2">
          <Avatar name={user?.name || user?.email} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-stone-700 truncate">
              {user?.name || user?.email}
            </p>
            <p className="text-xs text-stone-400 truncate">
              {user?.email}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigate('/settings')}
              className="p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={handleLogout}
              className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </aside>
    </>
  )
}
