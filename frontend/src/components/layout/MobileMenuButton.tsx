import { Menu } from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'

export function MobileMenuButton() {
  const { sidebarCollapsed, toggleSidebarCollapse } = useUIStore()

  return (
    <button
      onClick={toggleSidebarCollapse}
      className="md:hidden fixed top-4 left-4 z-30 p-2.5 bg-white border border-stone-200 rounded-lg shadow-sm hover:bg-stone-50 transition-colors"
      aria-label="Menu"
    >
      <Menu className="w-5 h-5 text-stone-600" />
    </button>
  )
}
