// User types
export interface User {
  id: string
  email: string
  name: string
  role: 'admin' | 'user'
  createdAt: string
}

// Message types
export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: string
  isStreaming?: boolean
  model?: string
  feedback?: 'positive' | 'negative'
  artifacts?: string[] // artifact IDs
}

// Conversation types
export interface Conversation {
  id: string
  title: string
  messages: Message[]
  createdAt: string
  updatedAt: string
  model?: string
}

// Artifact types
export type ArtifactType = 'document' | 'code' | 'table' | 'chart' | 'html'

export interface Artifact {
  id: string
  title: string
  type: ArtifactType
  content: string
  language?: string
  messageId?: string
  createdAt: string
  updatedAt: string
}

// API types
export interface StreamChunk {
  type: 'chunk' | 'artifact' | 'done' | 'error'
  content?: string
  artifact?: {
    title: string
    type: ArtifactType
    content: string
    language?: string
  }
  error?: string
}

export interface ChatRequest {
  message: string
  conversationId?: string
  model?: string
  files?: File[]
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

// Model types
export interface AIModel {
  id: string
  name: string
  description: string
  maxTokens: number
  available: boolean
}

export const AI_MODELS: AIModel[] = [
  {
    id: 'claude-opus-4-5',
    name: 'Claude Opus 4.5',
    description: 'Mais inteligente e capaz',
    maxTokens: 200000,
    available: true,
  },
  {
    id: 'claude-sonnet-4-5',
    name: 'Claude Sonnet 4.5',
    description: 'Equilíbrio entre velocidade e qualidade',
    maxTokens: 200000,
    available: true,
  },
  {
    id: 'claude-haiku-4-5',
    name: 'Claude Haiku 4.5',
    description: 'Rápido e econômico',
    maxTokens: 200000,
    available: true,
  },
  {
    id: 'amazon-nova-pro',
    name: 'Amazon Nova Pro',
    description: 'Alternativa econômica',
    maxTokens: 100000,
    available: true,
  },
]
