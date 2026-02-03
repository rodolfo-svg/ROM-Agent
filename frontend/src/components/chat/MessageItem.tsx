import { useState, memo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { 
  Copy, 
  Check, 
  ThumbsUp, 
  ThumbsDown, 
  RefreshCw,
  FileText,
  Code,
  Table,
  BarChart3,
  Eye,
  Sparkles
} from 'lucide-react'
import type { Message, Artifact } from '@/types'
import { useChatStore } from '@/stores/chatStore'
import { useArtifactStore } from '@/stores/artifactStore'
import { cn, copyToClipboard } from '@/utils'

interface MessageItemProps {
  message: Message
  artifacts?: Artifact[]
  onRegenerate?: () => void
}

export const MessageItem = memo(function MessageItem({ 
  message, 
  artifacts = [],
  onRegenerate 
}: MessageItemProps) {
  const [copied, setCopied] = useState(false)
  const { setMessageFeedback } = useChatStore()
  const { setActiveArtifact } = useArtifactStore()

  const handleCopy = async () => {
    await copyToClipboard(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleFeedback = (type: 'positive' | 'negative') => {
    setMessageFeedback(message.id, type)
  }

  const getArtifactIcon = (type: Artifact['type']) => {
    const icons = {
      document: FileText,
      code: Code,
      table: Table,
      chart: BarChart3,
      html: Code,
    }
    const Icon = icons[type] || FileText
    return <Icon className="w-4 h-4" />
  }

  // User message
  if (message.role === 'user') {
    return (
      <div className="flex justify-end mb-6 animate-fade-in">
        <div className="max-w-[80%] bg-stone-700 text-white px-4 py-3 rounded-2xl rounded-br-md">
          <p className="text-[15px] leading-relaxed whitespace-pre-wrap">
            {message.content}
          </p>
        </div>
      </div>
    )
  }

  // Assistant message
  return (
    <div className="flex gap-3 mb-6 animate-fade-in">
      {/* Avatar */}
      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-bronze-400 to-bronze-600 flex items-center justify-center flex-shrink-0">
        <Sparkles className="w-4 h-4 text-white" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Message content with Markdown */}
        <div className="prose-chat">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeHighlight]}
            components={{
              // Custom code block with copy button - Modern light theme
              pre: ({ children }) => (
                <div className="relative group my-4">
                  <div className="absolute inset-0 bg-gradient-to-br from-bronze-50 via-amber-50 to-orange-50 rounded-xl opacity-50" />
                  <pre className="relative p-5 bg-gradient-to-br from-stone-50 to-stone-100/80 backdrop-blur-sm text-stone-800 rounded-xl overflow-x-auto border border-stone-200/60 shadow-sm">
                    {children}
                  </pre>
                  <button
                    onClick={() => {
                      const code = (children as any)?.props?.children
                      if (code) copyToClipboard(String(code))
                    }}
                    className="absolute top-3 right-3 p-2 bg-white/90 backdrop-blur-sm border border-stone-200 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:scale-105 text-stone-600 hover:text-bronze-600 hover:border-bronze-300 shadow-sm"
                    title="Copiar código"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              ),
              // Inline code
              code: ({ className, children, ...props }) => {
                const isInline = !className
                if (isInline) {
                  return (
                    <code className="px-1.5 py-0.5 bg-stone-100 text-stone-800 rounded text-sm font-mono" {...props}>
                      {children}
                    </code>
                  )
                }
                return <code className={className} {...props}>{children}</code>
              },
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>

        {/* Artifacts - Modern elegant design */}
        {artifacts.length > 0 && (
          <div className="mt-4 space-y-3">
            {artifacts.map((artifact) => (
              <div
                key={artifact.id}
                onClick={() => setActiveArtifact(artifact)}
                className="relative cursor-pointer group overflow-hidden rounded-xl border border-stone-200/60 bg-gradient-to-br from-white via-stone-50/30 to-bronze-50/20 hover:from-bronze-50/30 hover:via-amber-50/20 hover:to-orange-50/20 transition-all duration-300 shadow-sm hover:shadow-md hover:border-bronze-300/40"
              >
                {/* Subtle gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white/40 to-bronze-100/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                {/* Header */}
                <div className="relative px-4 py-3 border-b border-stone-200/40 bg-gradient-to-r from-stone-50/50 to-transparent flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="text-bronze-600 group-hover:text-bronze-700 transition-colors">
                      {getArtifactIcon(artifact.type)}
                    </div>
                    <span className="text-sm font-medium text-stone-700 group-hover:text-stone-900 transition-colors">
                      {artifact.title}
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setActiveArtifact(artifact)
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gradient-to-r from-bronze-600 to-bronze-700 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 hover:from-bronze-700 hover:to-bronze-800 hover:scale-105 shadow-sm"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Abrir
                  </button>
                </div>

                {/* Preview */}
                <div className="relative px-4 py-3 max-h-32 overflow-hidden">
                  <pre className="text-xs text-stone-600 font-mono leading-relaxed whitespace-pre-wrap">
                    {artifact.content ? artifact.content.slice(0, 400) : '(conteúdo vazio)'}
                    {artifact.content && artifact.content.length > 400 && '...'}
                  </pre>
                  {/* Fade effect at bottom */}
                  <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white via-white/80 to-transparent pointer-events-none" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Streaming indicator */}
        {message.isStreaming && (
          <div className="flex items-center gap-1.5 mt-3">
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
          </div>
        )}

        {/* Actions */}
        {!message.isStreaming && (
          <div className="flex items-center gap-1 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleCopy}
              className="p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
              title="Copiar"
            >
              {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
            </button>
            
            {onRegenerate && (
              <button
                onClick={onRegenerate}
                className="p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
                title="Regenerar"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}

            <div className="w-px h-4 bg-stone-200 mx-1" />

            <button
              onClick={() => handleFeedback('positive')}
              className={cn(
                'p-1.5 rounded-lg transition-colors',
                message.feedback === 'positive'
                  ? 'text-green-600 bg-green-50'
                  : 'text-stone-400 hover:text-stone-600 hover:bg-stone-100'
              )}
              title="Útil"
            >
              <ThumbsUp className="w-4 h-4" />
            </button>
            
            <button
              onClick={() => handleFeedback('negative')}
              className={cn(
                'p-1.5 rounded-lg transition-colors',
                message.feedback === 'negative'
                  ? 'text-red-600 bg-red-50'
                  : 'text-stone-400 hover:text-stone-600 hover:bg-stone-100'
              )}
              title="Não útil"
            >
              <ThumbsDown className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
})
