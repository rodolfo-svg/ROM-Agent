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
  Sparkles,
  Paperclip
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

  // User message - Modern clean design with soft gradient
  if (message.role === 'user') {
    return (
      <div className="flex justify-end mb-6 animate-fade-in">
        <div className="max-w-[80%] bg-gradient-to-br from-bronze-500/90 via-bronze-600/90 to-amber-600/90 text-white px-4 py-3 rounded-2xl rounded-br-md shadow-md hover:shadow-lg transition-shadow">
          <p className="text-[15px] leading-relaxed whitespace-pre-wrap">
            {message.content}
          </p>
          {/* Attached files indicator */}
          {message.attachedFiles && message.attachedFiles.length > 0 && (
            <div className="mt-2 pt-2 border-t border-white/20">
              <div className="flex items-center gap-2 text-xs text-white/90">
                <Paperclip className="w-3.5 h-3.5" />
                <span>
                  {message.attachedFiles.length} arquivo{message.attachedFiles.length > 1 ? 's' : ''} anexado{message.attachedFiles.length > 1 ? 's' : ''}
                </span>
              </div>
              <div className="mt-1.5 space-y-1">
                {message.attachedFiles.map((file, idx) => (
                  <div key={idx} className="text-xs text-white/80 truncate">
                    📄 {file.name}
                  </div>
                ))}
              </div>
            </div>
          )}
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
              // Custom code block with copy button - Modern clean theme
              pre: ({ children }) => (
                <div className="relative group my-4">
                  <pre className="relative p-5 bg-white border-2 border-stone-200 text-stone-800 rounded-xl overflow-x-auto shadow-sm hover:border-bronze-300 transition-colors">
                    {children}
                  </pre>
                  <button
                    onClick={() => {
                      const code = (children as any)?.props?.children
                      if (code) copyToClipboard(String(code))
                    }}
                    className="absolute top-3 right-3 p-2 bg-white border border-stone-300 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:scale-105 text-stone-600 hover:text-bronze-600 hover:border-bronze-400 shadow-md hover:shadow-lg"
                    title="Copiar código"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              ),
              // Inline code - Clean and readable
              code: ({ className, children, ...props }) => {
                const isInline = !className
                if (isInline) {
                  return (
                    <code className="px-2 py-0.5 bg-bronze-50 text-bronze-900 rounded border border-bronze-200 text-sm font-mono font-medium" {...props}>
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

        {/* Artifacts - Clean modern design */}
        {artifacts.length > 0 && (
          <div className="mt-4 space-y-3">
            {artifacts.map((artifact) => (
              <div
                key={artifact.id}
                onClick={() => setActiveArtifact(artifact)}
                className="relative cursor-pointer group overflow-hidden rounded-xl border-2 border-stone-200 bg-white hover:bg-bronze-50/30 hover:border-bronze-400 transition-all duration-300 shadow-md hover:shadow-xl"
              >
                {/* Header */}
                <div className="relative px-4 py-3 border-b-2 border-stone-200 group-hover:border-bronze-300 bg-gradient-to-r from-stone-50 to-bronze-50/50 flex items-center justify-between transition-colors">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-white border border-bronze-200 text-bronze-600 group-hover:text-bronze-700 group-hover:border-bronze-400 transition-all">
                      {getArtifactIcon(artifact.type)}
                    </div>
                    <span className="text-sm font-semibold text-stone-800 group-hover:text-bronze-900 transition-colors">
                      {artifact.title}
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setActiveArtifact(artifact)
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gradient-to-r from-bronze-600 to-bronze-700 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 hover:from-bronze-700 hover:to-bronze-800 hover:scale-105 shadow-md"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Abrir
                  </button>
                </div>

                {/* Preview */}
                <div className="relative px-4 py-3 max-h-32 overflow-hidden bg-white">
                  <pre className="text-xs text-stone-700 font-mono leading-relaxed whitespace-pre-wrap">
                    {artifact.content ? artifact.content.slice(0, 400) : '(conteúdo vazio)'}
                    {artifact.content && artifact.content.length > 400 && '...'}
                  </pre>
                  {/* Fade effect at bottom */}
                  <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white via-white/90 to-transparent pointer-events-none" />
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
