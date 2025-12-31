import { ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { MobileMenuButton } from './MobileMenuButton'

interface PageLayoutProps {
  children: ReactNode
  className?: string
}

export function PageLayout({ children, className = '' }: PageLayoutProps) {
  return (
    <div className="h-screen flex bg-stone-50">
      <Sidebar />
      <MobileMenuButton />

      <div className={`flex-1 flex flex-col min-w-0 ${className}`}>
        {children}
      </div>
    </div>
  )
}
