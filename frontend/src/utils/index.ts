import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

// Merge Tailwind classes
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Format date
export function formatDate(date: string | Date): string {
  const d = new Date(date)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'Agora'
  if (minutes < 60) return `${minutes}min`
  if (hours < 24) return `${hours}h`
  if (days < 7) return `${days}d`
  
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

// Format relative date for groups
export function getDateGroup(date: string | Date): string {
  const d = new Date(date)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const days = Math.floor(diff / 86400000)

  if (days === 0) return 'Hoje'
  if (days === 1) return 'Ontem'
  if (days < 7) return 'Esta semana'
  if (days < 30) return 'Este mês'
  return 'Anteriores'
}

// Group conversations by date
export function groupConversationsByDate<T extends { updatedAt: string }>(
  conversations: T[]
): { label: string; items: T[] }[] {
  const groups: Record<string, T[]> = {}

  for (const conv of conversations) {
    const group = getDateGroup(conv.updatedAt)
    if (!groups[group]) groups[group] = []
    groups[group].push(conv)
  }

  const order = ['Hoje', 'Ontem', 'Esta semana', 'Este mês', 'Anteriores']
  return order
    .filter(label => groups[label]?.length > 0)
    .map(label => ({ label, items: groups[label] }))
}

// Copy to clipboard
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Fallback for older browsers
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const success = document.execCommand('copy')
    document.body.removeChild(textarea)
    return success
  }
}

// Download file
export function downloadFile(content: string, filename: string, mimeType: string = 'text/plain') {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Truncate text
export function truncate(text: string, length: number): string {
  if (text.length <= length) return text
  return text.slice(0, length) + '...'
}

// Generate unique ID
export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

// Debounce function
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delay)
  }
}

// Extract language from code block
export function extractCodeLanguage(content: string): string | null {
  const match = content.match(/^```(\w+)/)
  return match ? match[1] : null
}

// Get file extension for artifact type
export function getArtifactExtension(type: string, language?: string): string {
  if (type === 'code' && language) {
    const extensions: Record<string, string> = {
      javascript: 'js',
      typescript: 'ts',
      python: 'py',
      java: 'java',
      cpp: 'cpp',
      csharp: 'cs',
      go: 'go',
      rust: 'rs',
      ruby: 'rb',
      php: 'php',
      swift: 'swift',
      kotlin: 'kt',
      html: 'html',
      css: 'css',
      json: 'json',
      yaml: 'yml',
      markdown: 'md',
      sql: 'sql',
      shell: 'sh',
      bash: 'sh',
    }
    return extensions[language.toLowerCase()] || 'txt'
  }

  const typeExtensions: Record<string, string> = {
    document: 'txt',
    table: 'csv',
    chart: 'json',
    html: 'html',
  }

  return typeExtensions[type] || 'txt'
}
