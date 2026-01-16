import { useEffect, useRef, useState, lazy, Suspense } from 'react'
import { useParams } from 'react-router-dom'
import { useChatStore } from '@/stores/chatStore'
import { useArtifactStore } from '@/stores/artifactStore'
import { Sidebar } from '@/components/layout'
import { ChatInput, MessageItem, EmptyState } from '@/components/chat'
import { chatStream } from '@/services/api'
import { useFileUpload, type FileInfo, type AttachedFile } from '@/hooks/useFileUpload'
import { X, Paperclip, File, FileText, Image, Loader2 } from 'lucide-react'

// Lazy load ArtifactPanel (682KB bundle reduction)
const ArtifactPanel = lazy(() => import('@/components/artifacts').then(m => ({ default: m.ArtifactPanel })))

// ============================================================
// ATTACHED FILES UI COMPONENT
// ============================================================

interface AttachedFilesPreviewProps {
  attachedFiles: AttachedFile[]
  onRemove: (fileId: string) => void
  isUploading: boolean
  uploadProgress: number
}

function AttachedFilesPreview({ attachedFiles, onRemove, isUploading, uploadProgress }: AttachedFilesPreviewProps) {
  if (attachedFiles.length === 0) return null

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <Image className="w-4 h-4" />
    if (type === 'application/pdf') return <FileText className="w-4 h-4" />
    return <File className="w-4 h-4" />
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="px-4 pb-2 max-md:px-3">
      <div className="flex flex-wrap gap-2">
        {attachedFiles.map((af) => (
          <div
            key={af.fileInfo.id}
            className={`
              relative flex items-center gap-2 px-3 py-2 rounded-lg border
              ${af.fileInfo.status === 'error'
                ? 'bg-red-50 border-red-200 text-red-700'
                : af.fileInfo.status === 'uploading'
                  ? 'bg-amber-50 border-amber-200'
                  : 'bg-stone-100 border-stone-200'
              }
            `}
          >
            {/* File Icon */}
            <span className="text-stone-500">
              {af.fileInfo.status === 'uploading' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                getFileIcon(af.fileInfo.type)
              )}
            </span>

            {/* File Info */}
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium truncate max-w-[150px] max-md:max-w-[100px]">
                {af.fileInfo.name}
              </span>
              <span className="text-xs text-stone-500">
                {af.fileInfo.status === 'uploading'
                  ? `${af.fileInfo.progress}%`
                  : af.fileInfo.status === 'error'
                    ? af.fileInfo.error
                    : formatFileSize(af.fileInfo.size)
                }
              </span>
            </div>

            {/* Progress Bar (during upload) */}
            {af.fileInfo.status === 'uploading' && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-stone-200 rounded-b-lg overflow-hidden">
                <div
                  className="h-full bg-amber-500 transition-all duration-300"
                  style={{ width: `${af.fileInfo.progress}%` }}
                />
              </div>
            )}

            {/* Remove Button */}
            <button
              onClick={() => onRemove(af.fileInfo.id)}
              className="ml-1 p-1 rounded-full hover:bg-stone-200 text-stone-400 hover:text-stone-600 transition-colors"
              title="Remover arquivo"
              disabled={af.fileInfo.status === 'uploading'}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export function ChatPage() {
  const { conversationId } = useParams()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const {
    conversations,
    activeConversationId,
    loadConversations,
    createConversation,
    selectConversation,
    addMessage,
    updateMessage,
    isStreaming,
    setStreaming,
    selectedModel,
  } = useChatStore()

  const { artifacts, addArtifact } = useArtifactStore()

  // File upload hook - uses simple endpoint for chat
  const {
    attachedFiles,
    isUploading,
    uploadProgress,
    error: uploadError,
    uploadFile,
    removeFile,
    clearFiles,
    getAttachedFilesForChat,
    getExtractedData,
    inputRef,
    openFilePicker,
  } = useFileUpload({
    endpoint: 'simple', // Use /api/upload for chat
    maxFiles: 5,
    maxSizeBytes: 500 * 1024 * 1024, // 500MB para documentos jurídicos grandes
    onUploadComplete: (file, fileInfo) => {
      console.log(`[ChatPage] File uploaded: ${file.name}`, fileInfo)
    },
    onUploadError: (file, error) => {
      console.error(`[ChatPage] Upload error for ${file.name}:`, error)
    },
  })

  // Get active conversation
  const activeConversation = conversations.find(c => c.id === activeConversationId)

  // Scroll to bottom on new messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [activeConversation?.messages])

  // Load conversations from API on mount
  useEffect(() => {
    loadConversations()
  }, [])

  // Handle URL param for conversation
  useEffect(() => {
    if (conversationId && conversationId !== activeConversationId) {
      selectConversation(conversationId)
    }
  }, [conversationId])

  // Load messages for active conversation (fix: ensure messages are loaded)
  useEffect(() => {
    // Use direct Zustand state to avoid stale closures
    const state = useChatStore.getState()
    const conv = state.conversations.find(c => c.id === activeConversationId)

    if (activeConversationId && conv && conv.messages.length === 0) {
      console.log('Loading messages for active conversation:', activeConversationId)
      selectConversation(activeConversationId)
    }
  }, [activeConversationId, conversations.length])

  // Create initial conversation if none exists (after loading)
  useEffect(() => {
    if (!activeConversation && conversations.length === 0) {
      createConversation()
    }
  }, [conversations.length])

  // Get artifacts for a message
  const getArtifactsForMessage = (messageId: string) => {
    return artifacts.filter(a => a.messageId === messageId)
  }

  // Handle file selection from input
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    for (const file of Array.from(files)) {
      await uploadFile(file)
    }

    // Clear input for same file re-selection
    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  // Handle sending message with attachments
  const handleSend = async (content: string, files?: File[]) => {
    // Handle new file uploads from ChatInput (drag & drop, paste, etc.)
    if (files && files.length > 0) {
      for (const file of files) {
        await uploadFile(file)
      }
    }

    // Get completed attached files
    const completedFiles = attachedFiles.filter(af => af.fileInfo.status === 'completed')

    // Build message content with file references
    let messageContent = content
    if (completedFiles.length > 0) {
      const fileNames = completedFiles.map(af => af.fileInfo.name).join(', ')
      messageContent = content
        ? `${content}\n\n📎 Arquivos anexados: ${fileNames}`
        : `📎 Arquivos anexados: ${fileNames}`
    }

    // Don't send empty messages without files
    if (!messageContent.trim() && completedFiles.length === 0) {
      return
    }

    // Create conversation if needed
    let convId = activeConversationId
    if (!convId) {
      const conv = await createConversation()
      convId = conv.id
    }

    // Ensure messages are loaded before sending
    let currentState = useChatStore.getState()
    let conversation = currentState.conversations.find(c => c.id === convId)

    // If conversation exists but messages aren't loaded, load now
    if (conversation && conversation.messages.length === 0) {
      console.log('Loading messages from backend...')
      await selectConversation(convId)
      currentState = useChatStore.getState()
      conversation = currentState.conversations.find(c => c.id === convId)
      console.log('Messages loaded:', conversation?.messages?.length || 0)
    }

    // Prepare history (existing messages, excluding empty ones)
    const conversationMessages = conversation?.messages
      .filter(m => m.content && m.content.trim() !== '')
      .map(m => ({
        role: m.role,
        content: m.content
      })) || []

    // Prepare attached files for API
    const attachedFilesForApi = getAttachedFilesForChat()

    // Add user message
    addMessage({ role: 'user', content: messageContent })

    // Add placeholder for assistant
    const assistantMsg = addMessage({
      role: 'assistant',
      content: '',
      isStreaming: true,
      model: selectedModel,
    })

    // Clear attached files after sending
    clearFiles()

    setStreaming(true)
    let fullContent = ''

    try {
      abortControllerRef.current = new AbortController()

      for await (const chunk of chatStream(messageContent, {
        conversationId: convId,
        model: selectedModel,
        messages: conversationMessages,
        signal: abortControllerRef.current.signal,
        attachedFiles: attachedFilesForApi, // ✅ ATIVADO: Backend processa arquivos anexados
      })) {
        if (chunk.type === 'chunk' && chunk.content) {
          fullContent += chunk.content
          updateMessage(assistantMsg.id, fullContent)
        } else if ((chunk as any).type === 'tool_executing') {
          // Typing indicator during tool execution
          const toolMessage = (chunk as any).message || 'Processando...'
          updateMessage(assistantMsg.id, toolMessage)
        } else if (chunk.type === 'artifact' && chunk.artifact) {
          // Create artifact
          const artifact = addArtifact({
            title: chunk.artifact.title,
            type: chunk.artifact.type,
            content: chunk.artifact.content,
            language: chunk.artifact.language,
            messageId: assistantMsg.id,
          })

          // Link artifact to message
          useChatStore.getState().addArtifactToMessage(assistantMsg.id, artifact.id)
        } else if (chunk.type === 'error') {
          fullContent = `❌ ${chunk.error}`
          updateMessage(assistantMsg.id, fullContent)
        }
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        updateMessage(assistantMsg.id, `❌ Erro: ${error.message}`)
      }
    } finally {
      setStreaming(false)
      abortControllerRef.current = null
    }
  }

  // Handle stop streaming
  const handleStop = () => {
    abortControllerRef.current?.abort()
    setStreaming(false)
  }

  // Handle regenerate
  const handleRegenerate = async (messageId: string) => {
    const messages = activeConversation?.messages || []
    const messageIndex = messages.findIndex(m => m.id === messageId)

    if (messageIndex > 0) {
      const userMessage = messages[messageIndex - 1]
      if (userMessage.role === 'user') {
        // Remove the assistant message and regenerate
        await handleSend(userMessage.content)
      }
    }
  }

  return (
    <div className="h-screen flex bg-stone-50 overflow-hidden">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 max-md:w-full">
        {/* Messages - Fixed height with safe-area insets for mobile */}
        <div className="flex-1 overflow-y-auto overscroll-contain webkit-overflow-scrolling-touch pb-safe">
          {!activeConversation || activeConversation.messages.length === 0 ? (
            <EmptyState onSuggestionClick={handleSend} />
          ) : (
            <div className="max-w-3xl mx-auto px-4 py-6 max-md:px-3 max-md:py-4">
              {activeConversation.messages.map((message, index) => (
                <MessageItem
                  key={message.id}
                  message={message}
                  artifacts={getArtifactsForMessage(message.id)}
                  onRegenerate={
                    message.role === 'assistant' && !message.isStreaming
                      ? () => handleRegenerate(message.id)
                      : undefined
                  }
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Attached Files Preview */}
        <AttachedFilesPreview
          attachedFiles={attachedFiles}
          onRemove={removeFile}
          isUploading={isUploading}
          uploadProgress={uploadProgress}
        />

        {/* Upload Error */}
        {uploadError && (
          <div className="px-4 pb-2 max-md:px-3">
            <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
              {uploadError}
            </div>
          </div>
        )}

        {/* Hidden File Input */}
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileSelect}
          accept=".pdf,.txt,.csv,.json,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.webp"
        />

        {/* Input - Sticky at bottom with safe-area */}
        <div className="flex-shrink-0 pb-safe">
          <ChatInput
            onSend={handleSend}
            isLoading={isStreaming || isUploading}
            onStop={handleStop}
            onAttachClick={openFilePicker}
            hasAttachments={attachedFiles.length > 0}
          />
        </div>
      </div>

      {/* Artifact Panel - Lazy Loaded */}
      <Suspense fallback={null}>
        <ArtifactPanel />
      </Suspense>
    </div>
  )
}
