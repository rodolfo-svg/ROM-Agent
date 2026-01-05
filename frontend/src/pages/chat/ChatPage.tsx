import { useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useChatStore } from '@/stores/chatStore'
import { useArtifactStore } from '@/stores/artifactStore'
import { Sidebar } from '@/components/layout'
import { ChatInput, MessageItem, EmptyState } from '@/components/chat'
import { ArtifactPanel } from '@/components/artifacts'
import { chatStream } from '@/services/api'

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
    // Create conversation if needed
    let convId = activeConversationId
    if (!convId) {
      const conv = await createConversation()
      convId = conv.id
    }

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

      // Obter histórico completo da conversa para enviar ao backend
      const conversation = conversations.find(c => c.id === convId)
      const conversationMessages = conversation?.messages.map(m => ({
        role: m.role,
        content: m.content
      })) || []

      for await (const chunk of chatStream(content, {
        conversationId: convId,
        model: selectedModel,
        messages: conversationMessages, // CRÍTICO: Enviar histórico completo
        signal: abortControllerRef.current.signal,
      })) {
        if (chunk.type === 'chunk' && chunk.content) {
          fullContent += chunk.content
          updateMessage(assistantMsg.id, fullContent)
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

      {/* Artifact Panel */}
      <ArtifactPanel />
    </div>
  )
}
