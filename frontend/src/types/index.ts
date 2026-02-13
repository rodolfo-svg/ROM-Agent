// ============================================================
// FILE TYPES
// ============================================================

/**
 * Informacoes de um arquivo anexado
 * Usado para rastrear arquivos enviados junto com mensagens
 */
export interface FileInfo {
  /** Identificador unico do arquivo */
  id: string
  /** Nome original do arquivo */
  name: string
  /** Tamanho do arquivo em bytes */
  size: number
  /** Tipo MIME do arquivo (ex: application/pdf) */
  type: string
  /** Caminho do arquivo no servidor */
  path?: string
  /** Data de upload (ISO 8601) */
  uploadedAt?: string
  /** Texto extraído do arquivo (se disponível) */
  extractedText?: string
  /** Tamanho do texto extraído */
  textLength?: number
  /** Número de palavras do texto extraído */
  wordCount?: number
}

/**
 * Resultado de upload de arquivo
 * Retornado pela API apos upload bem-sucedido
 */
export interface UploadResult {
  /** Indica se o upload foi bem-sucedido */
  success: boolean
  /** ID do arquivo no servidor */
  fileId?: string
  /** Nome do arquivo */
  fileName?: string
  /** Tamanho do arquivo em bytes */
  fileSize?: number
  /** Tipo MIME */
  mimeType?: string
  /** URL para acessar o arquivo (se disponivel) */
  url?: string
  /** Mensagem de erro (se houver) */
  error?: string
}

/**
 * Arquivo anexado para envio com mensagem de chat
 * Pode ser um File nativo ou referencia a arquivo ja uploadado
 */
export interface AttachedFile {
  /** Arquivo nativo (para upload) */
  file?: File
  /** ID do arquivo ja uploadado */
  fileId?: string
  /** Nome do arquivo */
  name: string
  /** Tamanho em bytes */
  size: number
  /** Tipo MIME */
  type: string
  /** Status do upload */
  status?: 'pending' | 'uploading' | 'uploaded' | 'error'
  /** Progresso do upload (0-100) */
  progress?: number
  /** Mensagem de erro (se houver) */
  error?: string
}

// ============================================================
// USER TYPES
// ============================================================

/**
 * Usuario do sistema
 */
export interface User {
  /** Identificador unico do usuario */
  id: string
  /** Email do usuario */
  email: string
  /** Nome do usuario */
  name: string
  /** Papel do usuario no sistema */
  role: 'admin' | 'user'
  /** Data de criacao da conta (ISO 8601) */
  createdAt: string
}

// ============================================================
// MESSAGE TYPES
// ============================================================

/**
 * Mensagem de chat
 */
export interface Message {
  /** Identificador unico da mensagem */
  id: string
  /** Papel do remetente */
  role: 'user' | 'assistant' | 'system'
  /** Conteudo da mensagem */
  content: string
  /** Data de criacao (ISO 8601) */
  createdAt: string
  /** Indica se a mensagem esta em streaming */
  isStreaming?: boolean
  /** Modelo usado para gerar a resposta */
  model?: string
  /** Feedback do usuario sobre a resposta */
  feedback?: 'positive' | 'negative'
  /** IDs dos artefatos associados */
  artifacts?: string[]
  /** Arquivos anexados a mensagem */
  attachedFiles?: FileInfo[]
}

// ============================================================
// CONVERSATION TYPES
// ============================================================

/**
 * Conversa de chat
 */
export interface Conversation {
  /** Identificador unico da conversa */
  id: string
  /** Titulo da conversa */
  title: string
  /** Lista de mensagens */
  messages: Message[]
  /** Data de criacao (ISO 8601) */
  createdAt: string
  /** Data de ultima atualizacao (ISO 8601) */
  updatedAt: string
  /** Modelo padrao usado na conversa */
  model?: string
  /** ID do usuario (admin only) */
  userId?: string | null
  /** Nome do usuario (admin only) */
  userName?: string | null
  /** Email do usuario (admin only) */
  userEmail?: string | null
}

// ============================================================
// ARTIFACT TYPES
// ============================================================

/**
 * Tipos de artefato suportados
 */
export type ArtifactType = 'document' | 'code' | 'table' | 'chart' | 'html'

/**
 * Artefato gerado pela IA
 */
export interface Artifact {
  /** Identificador unico do artefato */
  id: string
  /** Titulo do artefato */
  title: string
  /** Tipo do artefato */
  type: ArtifactType
  /** Conteudo do artefato */
  content: string
  /** Linguagem de programacao (para type='code') */
  language?: string
  /** ID da mensagem associada */
  messageId?: string
  /** Data de criacao (ISO 8601) */
  createdAt: string
  /** Data de ultima atualizacao (ISO 8601) */
  updatedAt: string
}

// ============================================================
// API TYPES
// ============================================================

/**
 * Chunk de streaming SSE
 */
export interface StreamChunk {
  /** Tipo do chunk */
  type: 'chunk' | 'artifact' | 'artifact_start' | 'artifact_chunk' | 'artifact_complete' | 'done' | 'error' | 'tool_executing'
  /** Conteudo de texto (para type='chunk') */
  content?: string
  /** ID do artifact (para type='artifact_chunk') */
  id?: string
  /** Dados do artefato (para type='artifact' ou 'artifact_start' ou 'artifact_complete') */
  artifact?: {
    id?: string
    title: string
    type: ArtifactType
    content: string
    language?: string
    createdAt?: string
  }
  /** Mensagem de erro (para type='error') */
  error?: string
  /** Mensagem de status (para type='tool_executing') */
  message?: string
}

/**
 * Requisicao de chat
 */
export interface ChatRequest {
  /** Mensagem do usuario */
  message: string
  /** ID da conversa (opcional para nova conversa) */
  conversationId?: string
  /** Modelo a ser usado */
  model?: string
  /** Arquivos nativos para upload (deprecated - use attachedFiles) */
  files?: File[]
  /** Arquivos anexados */
  attachedFiles?: AttachedFile[]
}

/**
 * Resposta generica da API
 */
export interface ApiResponse<T> {
  /** Indica se a operacao foi bem-sucedida */
  success: boolean
  /** Dados retornados (se success=true) */
  data?: T
  /** Mensagem de erro (se success=false) */
  error?: string
}

// ============================================================
// CHAT STREAM OPTIONS
// ============================================================

/**
 * Opcoes para streaming de chat
 */
export interface ChatStreamOptions {
  /** ID da conversa existente */
  conversationId?: string
  /** Modelo a ser usado */
  model?: string
  /** Historico de mensagens para contexto */
  messages?: Array<{ role: string; content: string }>
  /** Signal para cancelamento */
  signal?: AbortSignal
  /** Arquivos anexados */
  attachedFiles?: AttachedFile[]
}

/**
 * Configuracao de reconexao SSE
 */
export interface ReconnectionConfig {
  /** Numero maximo de tentativas */
  maxRetries: number
  /** Delay inicial em ms */
  initialDelay: number
  /** Delay maximo em ms */
  maxDelay: number
  /** Multiplicador de backoff */
  backoffMultiplier: number
}

/**
 * Opcoes para streaming com retry
 */
export interface ChatStreamWithRetryOptions extends ChatStreamOptions {
  /** Configuracao de reconexao personalizada */
  reconnection?: Partial<ReconnectionConfig>
}

// ============================================================
// MODEL TYPES
// ============================================================

/**
 * Modelo de IA disponivel
 */
export interface AIModel {
  /** Identificador do modelo */
  id: string
  /** Nome de exibicao */
  name: string
  /** Descricao do modelo */
  description: string
  /** Limite maximo de tokens */
  maxTokens: number
  /** Indica se o modelo esta disponivel */
  available: boolean
}

/**
 * Lista de modelos de IA disponiveis
 */
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
    description: 'Equilibrio entre velocidade e qualidade',
    maxTokens: 200000,
    available: true,
  },
  {
    id: 'claude-haiku-4-5',
    name: 'Claude Haiku 4.5',
    description: 'Rapido e economico',
    maxTokens: 200000,
    available: true,
  },
  {
    id: 'amazon-nova-pro',
    name: 'Amazon Nova Pro',
    description: 'Alternativa economica',
    maxTokens: 100000,
    available: true,
  },
]

// ============================================================
// HOOK TYPES
// ============================================================

/**
 * Props para hook de upload de arquivo
 */
export interface UseFileUploadOptions {
  /** Callback chamado apos upload bem-sucedido */
  onSuccess?: (result: UploadResult) => void
  /** Callback chamado em caso de erro */
  onError?: (error: string) => void
  /** Callback de progresso */
  onProgress?: (progress: number) => void
  /** Tipos MIME aceitos */
  acceptedTypes?: string[]
  /** Tamanho maximo em bytes */
  maxSize?: number
}

/**
 * Retorno do hook useFileUpload
 */
export interface UseFileUploadReturn {
  /** Funcao para fazer upload */
  upload: (file: File) => Promise<UploadResult>
  /** Indica se esta fazendo upload */
  isUploading: boolean
  /** Progresso atual (0-100) */
  progress: number
  /** Erro atual (se houver) */
  error: string | null
  /** Limpa o erro */
  clearError: () => void
}

/**
 * Props para hook de arquivos anexados
 */
export interface UseAttachedFilesOptions {
  /** Numero maximo de arquivos */
  maxFiles?: number
  /** Tamanho maximo total em bytes */
  maxTotalSize?: number
}

/**
 * Retorno do hook useAttachedFiles
 */
export interface UseAttachedFilesReturn {
  /** Lista de arquivos anexados */
  files: AttachedFile[]
  /** Adiciona arquivo */
  addFile: (file: File) => void
  /** Remove arquivo por indice */
  removeFile: (index: number) => void
  /** Remove todos os arquivos */
  clearFiles: () => void
  /** Total de bytes dos arquivos */
  totalSize: number
  /** Indica se tem arquivos */
  hasFiles: boolean
}
