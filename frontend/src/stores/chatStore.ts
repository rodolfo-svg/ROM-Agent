import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Message, Conversation } from '@/types'

interface ChatState {
  conversations: Conversation[]
  activeConversationId: string | null
  isStreaming: boolean
  selectedModel: string
  isLoading: boolean

  // Getters
  activeConversation: Conversation | null

  // Actions
  loadConversations: () => Promise<void>
  createConversation: () => Promise<Conversation>
  selectConversation: (id: string) => Promise<void>
  deleteConversation: (id: string) => Promise<void>
  renameConversation: (id: string, title: string) => Promise<void>

  addMessage: (message: Omit<Message, 'id' | 'createdAt'>) => Message
  updateMessage: (id: string, content: string) => void
  saveMessageToAPI: (message: Message) => Promise<void>
  setMessageFeedback: (id: string, feedback: 'positive' | 'negative') => void
  addArtifactToMessage: (messageId: string, artifactId: string) => void

  setStreaming: (value: boolean) => void
  setModel: (model: string) => void

  clearAll: () => void
}

const generateId = () => Math.random().toString(36).substring(2, 15)

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      conversations: [],
      activeConversationId: null,
      isStreaming: false,
      selectedModel: 'claude-sonnet-4-5',
      isLoading: false,

      get activeConversation() {
        const state = get()
        return state.conversations.find(c => c.id === state.activeConversationId) || null
      },

      // Carregar conversas do backend
      loadConversations: async () => {
        set({ isLoading: true })
        try {
          const res = await fetch('/api/conversations', {
            credentials: 'include',
          })

          if (res.ok) {
            const data = await res.json()

            if (data.success && data.conversations) {
              // Obter conversas atuais para preservar mensagens já carregadas
              const existingConversations = get().conversations
              const existingMessagesMap = new Map(
                existingConversations.map(c => [c.id, c.messages])
              )

              // Mapear formato do backend para frontend, preservando mensagens existentes
              const conversations = data.conversations.map((c: any) => ({
                id: c.id,
                title: c.title,
                // 🔥 CRÍTICO: Preservar mensagens já carregadas em vez de resetar para []
                messages: existingMessagesMap.get(c.id) || [],
                createdAt: c.created_at,
                updatedAt: c.updated_at,
                model: get().selectedModel,
              }))

              console.log('📥 loadConversations: Carregadas', conversations.length, 'conversas')
              console.log('   Mensagens preservadas:', conversations.filter((c: Conversation) => c.messages.length > 0).length)

              set({ conversations, isLoading: false })
            }
          }
        } catch (error) {
          console.error('Erro ao carregar conversas:', error)
          set({ isLoading: false })
        }
      },

      createConversation: async () => {
        try {
          const res = await fetch('/api/conversations', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: 'Nova conversa' }),
          })

          if (res.ok) {
            const data = await res.json()
            if (data.success && data.conversation) {
              const newConversation: Conversation = {
                id: data.conversation.id,
                title: data.conversation.title,
                messages: [],
                createdAt: data.conversation.created_at,
                updatedAt: data.conversation.updated_at,
                model: get().selectedModel,
              }

              set(state => ({
                conversations: [newConversation, ...state.conversations],
                activeConversationId: newConversation.id,
              }))

              return newConversation
            }
          }
        } catch (error) {
          console.error('Erro ao criar conversa:', error)
        }

        // Fallback para localStorage se API falhar
        const newConversation: Conversation = {
          id: generateId(),
          title: 'Nova conversa',
          messages: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          model: get().selectedModel,
        }

        set(state => ({
          conversations: [newConversation, ...state.conversations],
          activeConversationId: newConversation.id,
        }))

        return newConversation
      },

      selectConversation: async (id: string) => {
        console.log('🔄 selectConversation chamado:', id)
        set({ activeConversationId: id, isLoading: true })

        try {
          // Buscar mensagens da conversa se ainda não foram carregadas
          const conversation = get().conversations.find(c => c.id === id)
          console.log('   conversation found:', !!conversation)
          console.log('   current messages count:', conversation?.messages?.length || 0)

          if (conversation && conversation.messages.length === 0) {
            console.log('   Fetching messages from API...')
            const res = await fetch(`/api/conversations/${id}`, {
              credentials: 'include',
            })

            if (res.ok) {
              const data = await res.json()
              console.log('   API response:', data.success, 'messages count:', data.conversation?.messages?.length)

              if (data.success && data.conversation) {
                const messages = data.conversation.messages.map((m: any) => ({
                  id: m.id,
                  role: m.role,
                  content: m.content,
                  model: m.model,
                  createdAt: m.created_at,
                  isStreaming: false,
                }))

                console.log('   ✅ Loaded messages:', messages.length)

                set(state => ({
                  conversations: state.conversations.map(c =>
                    c.id === id ? { ...c, messages } : c
                  ),
                  isLoading: false,
                }))
                return
              }
            } else {
              console.log('   ⚠️ API request failed:', res.status)
            }
          } else if (conversation) {
            console.log('   Skipping fetch - messages already loaded:', conversation.messages.length)
          } else {
            console.log('   ⚠️ Conversation not found in store')
          }
        } catch (error) {
          console.error('Erro ao carregar mensagens:', error)
        }

        set({ isLoading: false })
      },

      deleteConversation: async (id: string) => {
        try {
          const res = await fetch(`/api/conversations/${id}`, {
            method: 'DELETE',
            credentials: 'include',
          })

          if (res.ok) {
            set(state => {
              const newConversations = state.conversations.filter(c => c.id !== id)
              const newActiveId = state.activeConversationId === id
                ? newConversations[0]?.id || null
                : state.activeConversationId

              return {
                conversations: newConversations,
                activeConversationId: newActiveId,
              }
            })
          }
        } catch (error) {
          console.error('Erro ao deletar conversa:', error)
        }
      },

      renameConversation: async (id: string, title: string) => {
        try {
          const res = await fetch(`/api/conversations/${id}`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title }),
          })

          if (res.ok) {
            set(state => ({
              conversations: state.conversations.map(c =>
                c.id === id ? { ...c, title, updatedAt: new Date().toISOString() } : c
              ),
            }))
          }
        } catch (error) {
          console.error('Erro ao renomear conversa:', error)
        }
      },

      addMessage: (message) => {
        const newMessage: Message = {
          ...message,
          id: generateId(),
          createdAt: new Date().toISOString(),
        }

        console.log('📝 addMessage:', message.role, '- content length:', message.content?.length || 0)

        set(state => {
          const activeId = state.activeConversationId
          if (!activeId) {
            console.log('   ⚠️ No activeConversationId!')
            return state
          }

          // Update conversation title from first user message
          const conversation = state.conversations.find(c => c.id === activeId)
          const shouldUpdateTitle = conversation?.messages.length === 0 && message.role === 'user'
          const newTitle = shouldUpdateTitle
            ? message.content.slice(0, 50) + (message.content.length > 50 ? '...' : '')
            : undefined

          // Auto-rename via API se for primeira mensagem
          if (shouldUpdateTitle && newTitle) {
            get().renameConversation(activeId, newTitle)
          }

          const updatedConversations = state.conversations.map(c =>
            c.id === activeId
              ? {
                  ...c,
                  messages: [...c.messages, newMessage],
                  title: newTitle || c.title,
                  updatedAt: new Date().toISOString(),
                }
              : c
          )

          // Log para debug
          const updatedConv = updatedConversations.find(c => c.id === activeId)
          console.log('   ✅ Message added. Total messages now:', updatedConv?.messages?.length || 0)

          return { conversations: updatedConversations }
        })

        // Salvar no backend de forma assíncrona
        get().saveMessageToAPI(newMessage)

        return newMessage
      },

      saveMessageToAPI: async (message: Message) => {
        const activeId = get().activeConversationId
        if (!activeId) return

        try {
          await fetch(`/api/conversations/${activeId}/messages`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              role: message.role,
              content: message.content,
              model: message.model,
            }),
          })
        } catch (error) {
          console.error('Erro ao salvar mensagem:', error)
        }
      },

      updateMessage: (id: string, content: string) => {
        set(state => ({
          conversations: state.conversations.map(c =>
            c.id === state.activeConversationId
              ? {
                  ...c,
                  messages: c.messages.map(m =>
                    m.id === id ? { ...m, content, isStreaming: false } : m
                  ),
                  updatedAt: new Date().toISOString(),
                }
              : c
          ),
        }))

        // Atualizar no backend também
        const message = get().activeConversation?.messages.find(m => m.id === id)
        if (message) {
          get().saveMessageToAPI({ ...message, content })
        }
      },

      setMessageFeedback: (id: string, feedback: 'positive' | 'negative') => {
        set(state => ({
          conversations: state.conversations.map(c =>
            c.id === state.activeConversationId
              ? {
                  ...c,
                  messages: c.messages.map(m =>
                    m.id === id ? { ...m, feedback } : m
                  ),
                }
              : c
          ),
        }))
      },

      addArtifactToMessage: (messageId: string, artifactId: string) => {
        set(state => ({
          conversations: state.conversations.map(c =>
            c.id === state.activeConversationId
              ? {
                  ...c,
                  messages: c.messages.map(m =>
                    m.id === messageId
                      ? { ...m, artifacts: [...(m.artifacts || []), artifactId] }
                      : m
                  ),
                }
              : c
          ),
        }))
      },

      setStreaming: (value: boolean) => set({ isStreaming: value }),

      setModel: (model: string) => set({ selectedModel: model }),

      clearAll: () => set({ conversations: [], activeConversationId: null }),
    }),
    {
      name: 'rom-chat',
      partialize: (state) => ({
        // Manter cache local mas não substituir dados da API
        activeConversationId: state.activeConversationId,
        selectedModel: state.selectedModel,
      }),
    }
  )
)
