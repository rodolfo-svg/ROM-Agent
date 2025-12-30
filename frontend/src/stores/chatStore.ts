import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Message, Conversation } from '@/types'

interface ChatState {
  conversations: Conversation[]
  activeConversationId: string | null
  isStreaming: boolean
  selectedModel: string
  
  // Getters
  activeConversation: Conversation | null
  
  // Actions
  createConversation: () => Conversation
  selectConversation: (id: string) => void
  deleteConversation: (id: string) => void
  renameConversation: (id: string, title: string) => void
  
  addMessage: (message: Omit<Message, 'id' | 'createdAt'>) => Message
  updateMessage: (id: string, content: string) => void
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

      get activeConversation() {
        const state = get()
        return state.conversations.find(c => c.id === state.activeConversationId) || null
      },

      createConversation: () => {
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

      selectConversation: (id: string) => {
        set({ activeConversationId: id })
      },

      deleteConversation: (id: string) => {
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
      },

      renameConversation: (id: string, title: string) => {
        set(state => ({
          conversations: state.conversations.map(c =>
            c.id === id ? { ...c, title, updatedAt: new Date().toISOString() } : c
          ),
        }))
      },

      addMessage: (message) => {
        const newMessage: Message = {
          ...message,
          id: generateId(),
          createdAt: new Date().toISOString(),
        }

        set(state => {
          const activeId = state.activeConversationId
          if (!activeId) return state

          // Update conversation title from first user message
          const conversation = state.conversations.find(c => c.id === activeId)
          const shouldUpdateTitle = conversation?.messages.length === 0 && message.role === 'user'
          const newTitle = shouldUpdateTitle 
            ? message.content.slice(0, 50) + (message.content.length > 50 ? '...' : '')
            : undefined

          return {
            conversations: state.conversations.map(c =>
              c.id === activeId
                ? {
                    ...c,
                    messages: [...c.messages, newMessage],
                    title: newTitle || c.title,
                    updatedAt: new Date().toISOString(),
                  }
                : c
            ),
          }
        })

        return newMessage
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
        conversations: state.conversations,
        activeConversationId: state.activeConversationId,
        selectedModel: state.selectedModel,
      }),
    }
  )
)
