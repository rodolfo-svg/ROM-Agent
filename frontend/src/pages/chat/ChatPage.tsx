import { useEffect, useRef, lazy, Suspense } from 'react'
import { useParams } from 'react-router-dom'
import { useChatStore } from '@/stores/chatStore'
import { useArtifactStore } from '@/stores/artifactStore'
import { Sidebar } from '@/components/layout'
import { ChatInput, MessageItem, EmptyState } from '@/components/chat'
import { chatStream } from '@/services/api'

// Lazy load ArtifactPanel (682KB bundle reduction)
const ArtifactPanel = lazy(() => import('@/components/artifacts').then(m => ({ default: m.ArtifactPanel })))

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
    // Usar estado direto do Zustand para evitar stale closures
    const state = useChatStore.getState()
    const conv = state.conversations.find(c => c.id === activeConversationId)

    if (activeConversationId && conv && conv.messages.length === 0) {
      console.log('📌 useEffect: Carregando mensagens para conversa ativa:', activeConversationId)
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

  // Handle sending message
  const handleSend = async (content: string, files?: File[]) => {
    // 📎 Handle file uploads first
    if (files && files.length > 0) {
      if (files.length > 1) {
        console.warn(`⚠️ ${files.length} arquivos selecionados, mas apenas o primeiro será enviado`)
      }
      console.log(`📤 Uploading 1 file: ${files[0].name}...`)

      try {
        const formData = new FormData()
        // Backend aceita apenas UM arquivo por vez com nome 'file' (singular)
        formData.append('file', files[0])

        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          credentials: 'include',
          body: formData
        })

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json()
          throw new Error(errorData.error || 'Erro no upload')
        }

        const uploadResult = await uploadResponse.json()
        console.log('✅ Upload success:', uploadResult)

        // Add file info to message content
        const fileName = files[0].name
        content = content ? `${content}\n\n📎 Arquivo: ${fileName}` : `📎 Arquivo: ${fileName}`

      } catch (error: any) {
        console.error('❌ Upload error:', error)
        addMessage({
          role: 'assistant',
          content: `❌ Erro ao fazer upload: ${error.message}`
        })
        return // Stop here if upload fails
      }
    }

    // Create conversation if needed
    let convId = activeConversationId
    if (!convId) {
      const conv = await createConversation()
      convId = conv.id
    }

    // 🔥 CRÍTICO: Garantir que as mensagens estejam carregadas antes de enviar
    // Pegar estado inicial para verificar se precisa carregar
    let currentState = useChatStore.getState()
    let conversation = currentState.conversations.find(c => c.id === convId)

    // Se a conversa existe mas não tem mensagens carregadas, carregar agora
    if (conversation && conversation.messages.length === 0) {
      console.log('⏳ Mensagens não carregadas, carregando do backend...')
      await selectConversation(convId)
      // Atualizar referência após carregar
      currentState = useChatStore.getState()
      conversation = currentState.conversations.find(c => c.id === convId)
      console.log('✅ Mensagens carregadas:', conversation?.messages?.length || 0)
    }

    // ⚠️ DEBUG: Ver estado do histórico
    console.log('🔍 FRONTEND DEBUG:')
    console.log('   convId:', convId)
    console.log('   conversation found:', !!conversation)
    console.log('   conversation.messages length:', conversation?.messages?.length || 0)
    console.log('   conversation.messages:', conversation?.messages)
    console.log('   conversations array length:', currentState.conversations.length)
    console.log('   activeConversationId from state:', currentState.activeConversationId)

    const conversationMessages = conversation?.messages
      .filter(m => m.content && m.content.trim() !== '') // Excluir mensagens vazias
      .map(m => ({
        role: m.role,
        content: m.content
      })) || []

    console.log('   conversationMessages to send:', conversationMessages.length)
    console.log('')

    // Add user message
    addMessage({ role: 'user', content })

    // Add placeholder for assistant
    const assistantMsg = addMessage({
      role: 'assistant',
      content: '',
      isStreaming: true,
      model: selectedModel,
    })

    setStreaming(true)
    let fullContent = ''

    try {
      abortControllerRef.current = new AbortController()

      for await (const chunk of chatStream(content, {
        conversationId: convId,
        model: selectedModel,
        messages: conversationMessages, // ✅ Histórico correto (sem mensagens atuais)
        signal: abortControllerRef.current.signal,
      })) {
        if (chunk.type === 'chunk' && chunk.content) {
          fullContent += chunk.content
          updateMessage(assistantMsg.id, fullContent)
        } else if (chunk.type === 'tool_executing') {
          // Typing indicator durante tool execution
          const toolMessage = (chunk as any).message || '⏳ Processando...'
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
        // Remove the assistant message
        // ... and regenerate
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

        {/* Input - Sticky at bottom with safe-area */}
        <div className="flex-shrink-0 pb-safe">
          <ChatInput
            onSend={handleSend}
            isLoading={isStreaming}
            onStop={handleStop}
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
