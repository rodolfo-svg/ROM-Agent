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
              // Custom code block with copy button
              pre: ({ children }) => (
                <div className="relative group">
                  <pre className="my-4 p-4 bg-stone-900 text-stone-100 rounded-xl overflow-x-auto">
                    {children}
                  </pre>
                  <button
                    onClick={() => {
                      const code = (children as any)?.props?.children
                      if (code) copyToClipboard(String(code))
                    }}
                    className="absolute top-2 right-2 p-2 bg-stone-800 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity text-stone-400 hover:text-white"
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

        {/* Artifacts */}
        {artifacts.length > 0 && (
          <div className="mt-4 space-y-3">
            {artifacts.map((artifact) => (
              <div
                key={artifact.id}
                onClick={() => setActiveArtifact(artifact)}
                className="artifact-card cursor-pointer group"
              >
                <div className="artifact-header">
                  <div className="flex items-center gap-2 text-stone-700">
                    {getArtifactIcon(artifact.type)}
                    <span className="text-sm font-medium">{artifact.title}</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setActiveArtifact(artifact)
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-stone-700 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Eye className="w-3 h-3" />
                    Abrir
                  </button>
                </div>
                <div className="artifact-preview">
                  <pre className="text-xs text-stone-600 font-mono leading-relaxed whitespace-pre-wrap">
                    {artifact.content ? artifact.content.slice(0, 400) : '(conteúdo vazio)'}
                    {artifact.content && artifact.content.length > 400 && '...'}
                  </pre>
                  <div className="artifact-fade" />
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
