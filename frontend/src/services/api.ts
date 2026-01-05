import type { StreamChunk, ChatRequest, ApiResponse } from '@/types'

const API_BASE = '/api'

// Generic fetch wrapper
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    const data = await res.json()

    if (!res.ok) {
      return { success: false, error: data.error || 'Erro desconhecido' }
    }

    return { success: true, data }
  } catch (err) {
    return { success: false, error: 'Erro de conexão' }
  }
}

// Chat streaming with SSE
export async function* chatStream(
  message: string,
  options: {
    conversationId?: string
    model?: string
    messages?: Array<{ role: string; content: string }> // Histórico da conversa
    signal?: AbortSignal
  } = {}
): AsyncGenerator<StreamChunk> {
  const { conversationId, model, messages = [], signal } = options

  try {
    const res = await fetch(`${API_BASE}/chat/stream`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify({
        message,
        conversationId,
        model,
        messages, // Enviar histórico completo para manter contexto
        stream: true,
      }),
      signal,
    })

    if (!res.ok) {
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

// File upload
export async function uploadFile(file: File): Promise<ApiResponse<{ id: string; name: string }>> {
  const formData = new FormData()
  formData.append('file', file)

  try {
    const res = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    })

    const data = await res.json()
    return res.ok ? { success: true, data } : { success: false, error: data.error }
  } catch (err) {
    return { success: false, error: 'Erro ao fazer upload' }
  }
}
