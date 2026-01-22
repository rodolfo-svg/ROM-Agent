import { useState, useRef, useEffect, KeyboardEvent, useCallback } from 'react'
import { Send, Square, Paperclip, ChevronDown, X } from 'lucide-react'
import { useChatStore } from '@/stores/chatStore'
import { cn } from '@/utils'
import { AI_MODELS } from '@/types'

interface ChatInputProps {
  onSend: (message: string, files?: File[]) => void
  isLoading?: boolean
  onStop?: () => void
  /** Callback para abrir file picker externo (useFileUpload) */
  onAttachClick?: () => void
  /** Indica se ha arquivos anexados externamente */
  hasAttachments?: boolean
}

export function ChatInput({ onSend, isLoading, onStop, onAttachClick, hasAttachments }: ChatInputProps) {
  const [message, setMessage] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [showModelDropdown, setShowModelDropdown] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const { selectedModel, setModel } = useChatStore()
  const currentModel = AI_MODELS.find(m => m.id === selectedModel) || AI_MODELS[0]

  // Auto-resize textarea with debounce to prevent reflows
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const textarea = textareaRef.current
      if (textarea) {
        // Use requestAnimationFrame to batch DOM operations
        requestAnimationFrame(() => {
          textarea.style.height = 'auto'
          textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px'
        })
      }
    }, 50) // 50ms debounce

    return () => clearTimeout(timeoutId)
  }, [message])

  const handleSubmit = useCallback(() => {
    // Allow submit if has message, local files, or external attachments
    if (message.trim() || files.length > 0 || hasAttachments) {
      onSend(message.trim(), files.length > 0 ? files : undefined)
      setMessage('')
      setFiles([])
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    }
  }, [message, files, hasAttachments, onSend])

  // Handle attach button click - use external handler if provided
  const handleAttachClick = useCallback(() => {
    if (onAttachClick) {
      onAttachClick()
    } else {
      fileInputRef.current?.click()
    }
  }, [onAttachClick])

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!isLoading) handleSubmit()
    }
  }, [isLoading, handleSubmit])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    setFiles(prev => [...prev, ...selectedFiles])
    e.target.value = ''
  }, [])

  const removeFile = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }, [])

  // Optimize onChange handler to prevent recreation (v2.0 - force rebuild)
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value)
  }, [])

  return (
    <div className="border-t border-stone-200 bg-white p-4 max-md:p-3">
      <div className="max-w-3xl mx-auto w-full">
        {/* Files preview */}
        {files.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {files.map((file, index) => (
              <div
                key={index}
                className="flex items-center gap-2 px-3 py-1.5 bg-stone-100 rounded-lg text-sm"
              >
                <Paperclip className="w-3.5 h-3.5 text-stone-500" />
                <span className="text-stone-700 max-w-[150px] truncate">{file.name}</span>
                <button
                  onClick={() => removeFile(index)}
                  className="p-0.5 text-stone-400 hover:text-stone-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input container */}
        <div className="relative flex items-end gap-2 bg-stone-100 rounded-2xl border border-stone-200 focus-within:border-bronze-400 focus-within:ring-4 focus-within:ring-bronze-400/10 transition-all">
          {/* File upload button */}
          <button
            onClick={handleAttachClick}
            className={cn(
              "p-3 transition-colors",
              hasAttachments
                ? "text-bronze-600 hover:text-bronze-700"
                : "text-stone-400 hover:text-stone-600"
            )}
            title={hasAttachments ? "Arquivos anexados" : "Anexar arquivo"}
          >
            <Paperclip className="w-5 h-5" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            accept=".pdf,.doc,.docx,.txt,.md,.json,.csv"
          />

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Escreva sua mensagem..."
            rows={1}
            className="flex-1 py-3 bg-transparent resize-none text-stone-800 placeholder:text-stone-400 focus:outline-none text-[15px] leading-relaxed max-h-[200px]"
          />

          {/* Model selector */}
          <div className="relative pb-2">
            <button
              onClick={() => setShowModelDropdown(!showModelDropdown)}
              className="flex items-center gap-1 px-2 py-1 text-xs text-stone-500 hover:text-stone-700 hover:bg-stone-200 rounded transition-colors"
            >
              {currentModel.name.split(' ').pop()}
              <ChevronDown className="w-3 h-3" />
            </button>

            {showModelDropdown && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowModelDropdown(false)}
                />
                <div className="absolute bottom-full right-0 mb-2 w-56 bg-white rounded-xl border border-stone-200 shadow-lg z-20 py-1">
                  {AI_MODELS.map(model => (
                    <button
                      key={model.id}
                      onClick={() => {
                        setModel(model.id)
                        setShowModelDropdown(false)
                      }}
                      className={cn(
                        'w-full px-4 py-2.5 text-left hover:bg-stone-50 transition-colors',
                        selectedModel === model.id && 'bg-stone-50'
                      )}
                    >
                      <div className="text-sm font-medium text-stone-800">
                        {model.name}
                      </div>
                      <div className="text-xs text-stone-500">
                        {model.description}
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Send/Stop button */}
          {isLoading ? (
            <button
              onClick={onStop}
              className="p-3 text-stone-500 hover:text-stone-700 transition-colors"
            >
              <Square className="w-5 h-5 fill-current" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!message.trim() && files.length === 0 && !hasAttachments}
              className={cn(
                'p-3 transition-colors',
                message.trim() || files.length > 0 || hasAttachments
                  ? 'text-stone-700 hover:text-stone-900'
                  : 'text-stone-300'
              )}
            >
              <Send className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-stone-400 mt-3">
          ROM Agent pode cometer erros. Verifique informações importantes.
        </p>
      </div>
    </div>
  )
}
