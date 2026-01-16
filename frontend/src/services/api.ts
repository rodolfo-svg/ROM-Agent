import type {
  StreamChunk,
  ChatRequest,
  ApiResponse,
  ChatStreamOptions,
  ChatStreamWithRetryOptions,
  ReconnectionConfig,
  AttachedFile,
  UploadResult,
  FileInfo,
} from '@/types'

const API_BASE = '/api'

// ============================================================
// SSE RECONNECTION LOGIC
// ============================================================

/**
 * Configuracao padrao de reconexao SSE
 */
const DEFAULT_RECONNECTION: ReconnectionConfig = {
  maxRetries: 3,
  initialDelay: 1000, // 1s
  maxDelay: 10000, // 10s
  backoffMultiplier: 2,
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ============================================================
// CSRF TOKEN MANAGEMENT
// ============================================================

let csrfToken: string | null = null

/**
 * Busca CSRF token do backend
 * Token é armazenado em memória e reutilizado
 */
export async function getCsrfToken(): Promise<string | null> {
  if (csrfToken) {
    return csrfToken
  }

  try {
    const res = await fetch(`${API_BASE}/auth/csrf-token`, {
      credentials: 'include',
    })

    if (!res.ok) {
      console.error('❌ Falha ao buscar CSRF token:', res.status)
      return null
    }

    const data = await res.json()
    csrfToken = data.csrfToken || null

    if (csrfToken) {
      console.log('✅ CSRF token obtido com sucesso')
    }

    return csrfToken
  } catch (err) {
    console.error('❌ Erro ao buscar CSRF token:', err)
    return null
  }
}

/**
 * Limpa CSRF token armazenado (forçar nova busca)
 * Exportado para uso em logout e outras situações
 */
export function clearCsrfToken() {
  csrfToken = null
  console.log('🔄 CSRF token limpo - será renovado na próxima requisição')
}

// Generic fetch wrapper with CSRF support
// ✅ EXPORTADO para uso em páginas React
export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    // Buscar CSRF token se for requisição que modifica dados
    const methodsNeedingCsrf = ['POST', 'PUT', 'DELETE', 'PATCH']
    const method = (options.method || 'GET').toUpperCase()

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    }

    // Adicionar CSRF token se necessário
    if (methodsNeedingCsrf.includes(method)) {
      const token = await getCsrfToken()
      if (token) {
        headers['x-csrf-token'] = token
      }
    }

    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      credentials: 'include',
      headers,
    })

    const data = await res.json()

    if (!res.ok) {
      // Se 401 - não autenticado, redirecionar para login
      // EXCETO se for o próprio endpoint de login (para permitir mostrar erro de credenciais)
      if (res.status === 401 && endpoint !== '/auth/login') {
        console.warn('⚠️ Sessão expirada ou não autenticado - redirecionando para login')
        clearCsrfToken()
        // Redirecionar para login se não estiver já na página de login
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
          window.location.href = '/login'
        }
        return { success: false, error: 'Sessão expirada. Por favor, faça login novamente.' }
      }

      // Se 403 e usamos CSRF token, limpar e sugerir reload
      if (res.status === 403 && methodsNeedingCsrf.includes(method)) {
        console.warn('⚠️ CSRF token inválido - limpando cache')
        clearCsrfToken()
      }

      return { success: false, error: data.error || 'Erro desconhecido' }
    }

    return { success: true, data }
  } catch (err) {
    return { success: false, error: 'Erro de conexão' }
  }
}

/**
 * Chat streaming com SSE e reconexao automatica
 *
 * Wrapper para chatStream que adiciona logica de retry com backoff exponencial.
 * Use esta funcao quando precisar de resiliencia a falhas de conexao.
 *
 * @param message - Mensagem do usuario
 * @param options - Opcoes de streaming e reconexao
 * @param options.conversationId - ID da conversa existente
 * @param options.model - Modelo de IA a ser usado
 * @param options.messages - Historico de mensagens para contexto
 * @param options.signal - AbortSignal para cancelamento
 * @param options.attachedFiles - Arquivos anexados a mensagem
 * @param options.reconnection - Configuracao de reconexao personalizada
 * @yields StreamChunk - Chunks de streaming SSE
 *
 * @example
 * ```typescript
 * const controller = new AbortController()
 * for await (const chunk of chatStreamWithRetry('Ola', {
 *   conversationId: 'abc123',
 *   model: 'claude-sonnet-4-5',
 *   attachedFiles: [{ name: 'doc.pdf', size: 1024, mimeType: 'application/pdf' }],
 *   signal: controller.signal,
 * })) {
 *   if (chunk.type === 'chunk') console.log(chunk.content)
 * }
 * ```
 */
export async function* chatStreamWithRetry(
  message: string,
  options: ChatStreamWithRetryOptions = {}
): AsyncGenerator<StreamChunk> {
  const config = { ...DEFAULT_RECONNECTION, ...options.reconnection }
  let attempt = 0
  let delay = config.initialDelay

  while (attempt <= config.maxRetries) {
    try {
      // Try to stream
      for await (const chunk of chatStream(message, options)) {
        yield chunk

        // Reset on successful stream
        if (chunk.type === 'done') {
          return
        }
      }
      return // Stream completed successfully
    } catch (err: any) {
      // Don't retry if aborted by user
      if (err.name === 'AbortError' || options.signal?.aborted) {
        yield { type: 'error', error: 'Conexao interrompida' }
        return
      }

      attempt++

      if (attempt > config.maxRetries) {
        yield {
          type: 'error',
          error: `Falha na conexao apos ${config.maxRetries} tentativas. Tente novamente.`
        }
        return
      }

      // Exponential backoff
      console.warn(`SSE falhou (tentativa ${attempt}/${config.maxRetries}), reconectando em ${delay}ms...`)
      yield {
        type: 'chunk',
        content: `\n\nReconectando (tentativa ${attempt}/${config.maxRetries})...\n\n`
      }

      await sleep(delay)
      delay = Math.min(delay * config.backoffMultiplier, config.maxDelay)
    }
  }
}

/**
 * Chat streaming com SSE (Server-Sent Events)
 *
 * Funcao principal de streaming que conecta ao backend via SSE.
 * Para resiliencia a falhas, use chatStreamWithRetry.
 *
 * @param message - Mensagem do usuario
 * @param options - Opcoes de streaming
 * @param options.conversationId - ID da conversa existente
 * @param options.model - Modelo de IA a ser usado
 * @param options.messages - Historico de mensagens para contexto
 * @param options.signal - AbortSignal para cancelamento
 * @param options.attachedFiles - Arquivos anexados a mensagem
 * @yields StreamChunk - Chunks de streaming SSE
 *
 * @example
 * ```typescript
 * for await (const chunk of chatStream('Ola')) {
 *   switch (chunk.type) {
 *     case 'chunk':
 *       process.stdout.write(chunk.content || '')
 *       break
 *     case 'artifact':
 *       console.log('Artifact:', chunk.artifact)
 *       break
 *     case 'done':
 *       console.log('Stream completo')
 *       break
 *     case 'error':
 *       console.error('Erro:', chunk.error)
 *       break
 *   }
 * }
 * ```
 */
export async function* chatStream(
  message: string,
  options: ChatStreamOptions = {}
): AsyncGenerator<StreamChunk> {
  const { conversationId, model, messages = [], signal, attachedFiles } = options

  try {
    // Buscar CSRF token (mesmo que /chat/stream esteja em exempt, boa prática incluir)
    const token = await getCsrfToken()

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
    }

    if (token) {
      headers['x-csrf-token'] = token
    }

    // Preparar dados de arquivos anexados para envio
    const fileData = attachedFiles?.map(f => ({
      fileId: f.fileId,
      name: f.name,
      size: f.size,
      mimeType: f.mimeType,
    }))

    const res = await fetch(`${API_BASE}/chat/stream`, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: JSON.stringify({
        message,
        conversationId,
        model,
        messages, // Enviar historico completo para manter contexto
        attachedFiles: fileData, // Arquivos anexados
        stream: true,
      }),
      signal,
    })

    if (!res.ok) {
      // Se 401 - não autenticado, redirecionar para login
      if (res.status === 401) {
        clearCsrfToken()
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
          window.location.href = '/login'
        }
        yield { type: 'error', error: 'Sessão expirada. Por favor, faça login novamente.' }
        return
      }
      const error = await res.json().catch(() => ({ error: 'Erro desconhecido' }))
      yield { type: 'error', error: error.error || `Erro ${res.status}` }
      return
    }

    const reader = res.body?.getReader()
    if (!reader) {
      yield { type: 'error', error: 'Streaming não suportado' }
      return
    }

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim()
          if (data === '[DONE]') {
            yield { type: 'done' }
            return
          }

          try {
            const parsed = JSON.parse(data)
            
            if (parsed.content) {
              yield { type: 'chunk', content: parsed.content }
            } else if (parsed.artifact) {
              yield { type: 'artifact', artifact: parsed.artifact }
            } else if (parsed.error) {
              yield { type: 'error', error: parsed.error }
            }
          } catch (e) {
            // Non-JSON data, treat as content
            yield { type: 'chunk', content: data }
          }
        }
      }
    }

    yield { type: 'done' }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return
    }
    yield { type: 'error', error: err.message || 'Erro de conexão' }
  }
}

// Chat without streaming (fallback)
export async function chat(
  message: string,
  options: { conversationId?: string; model?: string } = {}
): Promise<ApiResponse<{ content: string; artifacts?: any[] }>> {
  return apiFetch('/chat', {
    method: 'POST',
    body: JSON.stringify({
      message,
      conversationId: options.conversationId,
      model: options.model,
      stream: false,
    }),
  })
}

// Auth API
export const auth = {
  login: (email: string, password: string) =>
    apiFetch<{ user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  logout: () =>
    apiFetch('/auth/logout', {
      method: 'POST',
    }),

  me: () => apiFetch<{ user: any }>('/auth/me'),
}

// Info API
export const info = {
  get: () => apiFetch<{ version: string; uptime: number }>('/info'),
  health: () => apiFetch<{ status: string }>('/health'),
}

// Feedback API
export const feedback = {
  send: (messageId: string, type: 'positive' | 'negative', comment?: string) =>
    apiFetch('/feedback', {
      method: 'POST',
      body: JSON.stringify({ messageId, type, comment }),
    }),
}

// ============================================================
// FILE UPLOAD
// ============================================================

/**
 * Tipo de resposta do upload de arquivo
 */
export interface UploadFileResponse {
  /** ID do arquivo no servidor */
  id: string
  /** Nome do arquivo */
  name: string
  /** Tamanho em bytes */
  size?: number
  /** Tipo MIME */
  mimeType?: string
  /** URL do arquivo (se disponivel) */
  url?: string
}

/**
 * Faz upload de um arquivo para o servidor
 *
 * @param file - Arquivo nativo do browser
 * @returns Promise com resultado do upload
 *
 * @example
 * ```typescript
 * const input = document.querySelector('input[type="file"]')
 * const file = input.files[0]
 * const result = await uploadFile(file)
 * if (result.success) {
 *   console.log('Arquivo enviado:', result.data?.id)
 * } else {
 *   console.error('Erro:', result.error)
 * }
 * ```
 */
export async function uploadFile(file: File): Promise<ApiResponse<UploadFileResponse>> {
  const formData = new FormData()
  formData.append('file', file)

  try {
    // Buscar CSRF token para upload
    const token = await getCsrfToken()

    const headers: Record<string, string> = {}
    if (token) {
      headers['x-csrf-token'] = token
    }

    const res = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      credentials: 'include',
      headers, // CSRF token adicionado
      body: formData, // FormData - nao incluir Content-Type (browser define automaticamente)
    })

    const data = await res.json()

    // Se 401 - nao autenticado, redirecionar para login
    if (res.status === 401) {
      clearCsrfToken()
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        window.location.href = '/login'
      }
      return { success: false, error: 'Sessao expirada. Por favor, faca login novamente.' }
    }

    return res.ok ? { success: true, data } : { success: false, error: data.error }
  } catch (err) {
    return { success: false, error: 'Erro ao fazer upload' }
  }
}

/**
 * Converte File nativo para AttachedFile
 *
 * @param file - Arquivo nativo
 * @param fileId - ID do arquivo apos upload (opcional)
 * @returns AttachedFile
 */
export function fileToAttachedFile(file: File, fileId?: string): AttachedFile {
  return {
    file,
    fileId,
    name: file.name,
    size: file.size,
    mimeType: file.type || 'application/octet-stream',
    status: fileId ? 'uploaded' : 'pending',
  }
}

/**
 * Converte AttachedFile para FileInfo (apos upload)
 *
 * @param attached - Arquivo anexado
 * @returns FileInfo ou undefined se nao tiver ID
 */
export function attachedFileToFileInfo(attached: AttachedFile): FileInfo | undefined {
  if (!attached.fileId) return undefined

  return {
    id: attached.fileId,
    name: attached.name,
    size: attached.size,
    mimeType: attached.mimeType,
  }
}
