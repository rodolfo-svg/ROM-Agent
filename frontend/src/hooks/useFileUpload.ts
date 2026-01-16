/**
 * ROM Agent - useFileUpload Hook (DEFINITIVO)
 *
 * Hook React PRODUCTION-READY para upload de arquivos com:
 * - CSRF token automatico
 * - Progress tracking em tempo real com velocidade e ETA
 * - Error handling robusto com mensagens localizadas (PT-BR)
 * - Retry automatico com backoff exponencial
 * - Validacao completa de tipo e tamanho
 * - Suporte a cancelamento
 * - TypeScript completo com generics
 * - Integracao com IA (33 ferramentas de extracao)
 * - Documentos estruturados (7 tipos)
 *
 * Endpoints suportados:
 * - /api/upload - Upload simples (chat)
 * - /api/kb/upload - Upload com extracao IA + documentos estruturados
 * - /api/upload-documents - Upload multiplo com extracao
 * - /api/case-processor/process - Processamento de processos judiciais
 * - /api/projects/:id/upload - Upload para projeto especifico
 *
 * @version 3.0.0
 * @author ROM Agent Team
 *
 * @example
 * ```tsx
 * // Uso basico
 * const { upload, state } = useFileUpload({
 *   maxSize: 10 * 1024 * 1024,
 *   allowedTypes: ['application/pdf'],
 *   onProgress: (progress) => console.log(`${progress}%`),
 *   onSuccess: (result) => console.log('Upload concluido:', result),
 *   onError: (error) => console.error('Erro:', error),
 * });
 *
 * // Upload com integracao IA
 * const { uploadFile } = useFileUpload({
 *   endpoint: 'kb',
 *   processWithAI: true,
 *   onUploadComplete: (file, info) => {
 *     console.log('Texto extraido:', info.extractedText);
 *     console.log('Documentos gerados:', info.structuredDocuments?.filesGenerated);
 *   },
 * });
 * ```
 */

import { useState, useCallback, useRef, useMemo } from 'react';
import { getCsrfToken, clearCsrfToken } from '@/services/api';

// ============================================================
// TYPES & INTERFACES
// ============================================================

/**
 * Status do upload
 */
export type UploadStatus =
  | 'idle'
  | 'validating'
  | 'uploading'
  | 'processing'
  | 'retrying'
  | 'success'
  | 'completed'
  | 'error'
  | 'cancelled'
  | 'pending';

/**
 * Resultado de validacao de arquivo
 */
export interface FileValidationResult {
  /** Se o arquivo e valido */
  valid: boolean;
  /** Lista de erros encontrados */
  errors: FileValidationError[];
  /** Arquivo validado */
  file: File;
}

/**
 * Erro de validacao de arquivo
 */
export interface FileValidationError {
  /** Codigo do erro */
  code: FileErrorCode;
  /** Mensagem descritiva */
  message: string;
  /** Valor atual (ex: tamanho do arquivo) */
  actual?: string | number;
  /** Valor esperado (ex: tamanho maximo) */
  expected?: string | number;
}

/**
 * Codigos de erro padronizados
 */
export type FileErrorCode =
  | 'FILE_TOO_LARGE'
  | 'FILE_TOO_SMALL'
  | 'INVALID_TYPE'
  | 'INVALID_EXTENSION'
  | 'EMPTY_FILE'
  | 'MAX_FILES_EXCEEDED'
  | 'NETWORK_ERROR'
  | 'SERVER_ERROR'
  | 'CSRF_ERROR'
  | 'AUTH_ERROR'
  | 'TIMEOUT'
  | 'CANCELLED'
  | 'MAX_RETRIES_EXCEEDED'
  | 'UNKNOWN_ERROR';

/**
 * Resultado de upload bem sucedido
 */
export interface UploadResult<T = DefaultUploadResponse> {
  /** Arquivo original */
  file: File;
  /** Resposta do servidor */
  response: T;
  /** Tempo total de upload em ms */
  duration: number;
}

/**
 * Resposta padrao do servidor (compativel com backend ROM)
 */
export interface DefaultUploadResponse {
  id: string;
  name: string;
  size?: number;
  type?: string;
  url?: string;
  // Dados de extracao IA (33 ferramentas)
  extractedText?: string;
  textLength?: number;
  wordCount?: number;
  toolsUsed?: string[];
  // Documentos estruturados gerados (7 tipos)
  structuredDocuments?: {
    filesGenerated: number;
    outputPath?: string;
    files?: Array<{
      name: string;
      path: string;
      type: string;
    }>;
  };
  // Metadados adicionais
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Informacoes de arquivo (compativel com versao anterior)
 */
export interface FileInfo {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
  url?: string;
  status: UploadStatus;
  progress: number;
  error?: string;
  // Dados de extracao IA (33 ferramentas)
  extractedText?: string;
  textLength?: number;
  wordCount?: number;
  toolsUsed?: string[];
  // Documentos estruturados gerados (7 tipos)
  structuredDocuments?: {
    filesGenerated: number;
    outputPath?: string;
    files?: Array<{
      name: string;
      path: string;
      type: string;
    }>;
  };
  // Metadados adicionais
  metadata?: Record<string, unknown>;
}

/**
 * Arquivo anexado (compativel com versao anterior)
 */
export interface AttachedFile {
  fileInfo: FileInfo;
  file: File;
}

/**
 * Progresso de upload
 */
export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
  speed?: number;
  estimatedTimeRemaining?: number | null;
}

/**
 * Erro de upload
 */
export interface UploadError {
  /** Codigo do erro */
  code: FileErrorCode;
  /** Mensagem descritiva */
  message: string;
  /** Arquivo relacionado */
  file?: File;
  /** Erro original (se houver) */
  originalError?: Error;
  /** Tentativa em que ocorreu */
  attempt?: number;
  /** Status HTTP (se aplicavel) */
  httpStatus?: number;
}

/**
 * Estado completo do hook
 */
export interface UploadState<T = DefaultUploadResponse> {
  /** Status atual */
  status: UploadStatus;
  /** Progresso (0-100) */
  progress: number;
  /** Bytes enviados */
  bytesUploaded: number;
  /** Bytes totais */
  bytesTotal: number;
  /** Velocidade atual em bytes/segundo */
  speed: number;
  /** Tempo estimado restante em segundos */
  estimatedTimeRemaining: number | null;
  /** Se esta fazendo upload */
  isUploading: boolean;
  /** Se pode cancelar */
  canCancel: boolean;
  /** Erro atual */
  error: UploadError | null;
  /** Resultados de uploads bem sucedidos */
  results: UploadResult<T>[];
  /** Tentativa atual (para retry) */
  currentAttempt: number;
  /** Maximo de tentativas */
  maxAttempts: number;
  /** Arquivos na fila */
  queue: File[];
  /** Arquivo atual sendo enviado */
  currentFile: File | null;
  /** Indice do arquivo atual na fila */
  currentIndex: number;
}

/**
 * Tipo de endpoint
 */
export type UploadEndpoint =
  | 'simple'         // /api/upload - Chat simples
  | 'kb'             // /api/kb/upload - Knowledge Base com IA
  | 'documents'      // /api/upload-documents - Multiplos docs com IA
  | 'case-processor' // /api/case-processor/process - Processos judiciais
  | 'project'        // /api/projects/:id/upload - Projeto especifico
  | 'custom';        // Endpoint customizado

/**
 * Configuracao de retry
 */
export interface RetryConfig {
  /** Numero maximo de tentativas */
  maxRetries: number;
  /** Delay inicial em ms */
  initialDelay: number;
  /** Delay maximo em ms */
  maxDelay: number;
  /** Multiplicador de backoff */
  backoffMultiplier: number;
  /** Codigos de erro que permitem retry */
  retryableCodes: FileErrorCode[];
}

/**
 * Opcoes do hook (UNIFICADO - combina API antiga e nova)
 */
export interface UseFileUploadOptions<T = DefaultUploadResponse> {
  // === OPCOES DE ENDPOINT (API LEGADA) ===

  /**
   * Tipo de endpoint a usar
   * @default 'kb' (com extracao IA)
   */
  endpoint?: UploadEndpoint;

  /**
   * URL customizada (quando endpoint='custom')
   */
  customEndpoint?: string;

  /**
   * ID do projeto (quando endpoint='project')
   */
  projectId?: string;

  /**
   * Processar com extracao IA (33 ferramentas)
   * @default true
   */
  processWithAI?: boolean;

  // === OPCOES DE CONFIGURACAO ===

  /**
   * Metodo HTTP
   * @default 'POST'
   */
  method?: 'POST' | 'PUT' | 'PATCH';

  /**
   * Nome do campo no FormData
   * @default 'file' ou 'files' dependendo do endpoint
   */
  fieldName?: string;

  /**
   * Tamanho maximo em bytes
   * @default 50 * 1024 * 1024 (50MB)
   */
  maxSize?: number;

  /**
   * Alias para maxSize (compatibilidade)
   */
  maxSizeBytes?: number;

  /**
   * Tamanho minimo em bytes
   * @default 1
   */
  minSize?: number;

  /**
   * Numero maximo de arquivos
   * @default 5
   */
  maxFiles?: number;

  /**
   * Tipos MIME permitidos (suporta wildcards como 'image/*')
   * @default [] (tipos padrao ROM)
   */
  allowedTypes?: string[];

  /**
   * Extensoes permitidas (sem ponto, ex: ['pdf', 'docx'])
   * @default [] (todas permitidas)
   */
  allowedExtensions?: string[];

  /**
   * Timeout em ms
   * @default 120000 (2 minutos)
   */
  timeout?: number;

  /**
   * Headers adicionais
   */
  headers?: Record<string, string>;

  /**
   * Dados adicionais para enviar no FormData
   */
  additionalData?: Record<string, string | Blob>;

  /**
   * Configuracao de retry
   */
  retry?: Partial<RetryConfig>;

  /**
   * Incluir CSRF token automaticamente
   * @default true
   */
  withCsrf?: boolean;

  /**
   * Incluir credenciais (cookies)
   * @default true
   */
  withCredentials?: boolean;

  /**
   * Validar arquivo antes de upload
   * @default true
   */
  validateBeforeUpload?: boolean;

  // === CALLBACKS (API NOVA) ===

  /**
   * Callback de progresso detalhado
   */
  onProgress?: (progress: number, bytesUploaded: number, bytesTotal: number) => void;

  /**
   * Callback de sucesso (por arquivo)
   */
  onSuccess?: (result: UploadResult<T>) => void;

  /**
   * Callback de erro
   */
  onError?: (error: UploadError) => void;

  /**
   * Callback quando upload e cancelado
   */
  onCancel?: (file: File | null) => void;

  /**
   * Callback quando comeca upload
   */
  onStart?: (file: File) => void;

  /**
   * Callback quando todos os uploads terminam
   */
  onComplete?: (results: UploadResult<T>[], errors: UploadError[]) => void;

  /**
   * Callback antes de iniciar retry
   */
  onRetry?: (attempt: number, maxAttempts: number, error: UploadError) => void;

  // === CALLBACKS (API LEGADA - COMPATIBILIDADE) ===

  /**
   * Callback quando upload inicia (legado)
   */
  onUploadStart?: (file: File) => void;

  /**
   * Callback de progresso (legado)
   */
  onUploadProgress?: (file: File, progress: UploadProgress) => void;

  /**
   * Callback quando upload completa (legado)
   */
  onUploadComplete?: (file: File, fileInfo: FileInfo) => void;

  /**
   * Callback de erro (legado)
   */
  onUploadError?: (file: File, error: string) => void;

  // === CUSTOMIZACAO ===

  /**
   * Callback de validacao customizada
   * Retornar array de erros ou array vazio se valido
   */
  customValidation?: (file: File) => FileValidationError[];

  /**
   * Transformar resposta do servidor
   */
  transformResponse?: (response: unknown) => T;
}

/**
 * Retorno do hook (UNIFICADO)
 */
export interface UseFileUploadReturn<T = DefaultUploadResponse> {
  // === ESTADO COMPLETO (API NOVA) ===
  /** Estado detalhado */
  state: UploadState<T>;

  // === ESTADO SIMPLES (API LEGADA) ===
  /** Arquivos anexados */
  attachedFiles: AttachedFile[];
  /** Se esta fazendo upload */
  isUploading: boolean;
  /** Progresso (0-100) */
  uploadProgress: number;
  /** Mensagem de erro */
  error: string | null;

  // === ACOES (API NOVA) ===

  /**
   * Upload de um arquivo (retorna Promise com resultado tipado)
   */
  upload: (file: File) => Promise<UploadResult<T>>;

  /**
   * Upload de multiplos arquivos (sequencial, com resultados tipados)
   */
  uploadMultiple: (files: File[] | FileList) => Promise<{
    results: UploadResult<T>[];
    errors: UploadError[];
  }>;

  /**
   * Cancelar upload em andamento
   */
  cancel: () => void;

  /**
   * Resetar estado para inicial
   */
  reset: () => void;

  // === ACOES (API LEGADA - COMPATIBILIDADE) ===

  /**
   * Upload de arquivo (retorna FileInfo)
   */
  uploadFile: (file: File) => Promise<FileInfo | null>;

  /**
   * Upload de multiplos arquivos (retorna FileInfo[])
   */
  uploadFiles: (files: File[]) => Promise<FileInfo[]>;

  /**
   * Remove arquivo por ID
   */
  removeFile: (fileId: string) => void;

  /**
   * Limpa todos os arquivos
   */
  clearFiles: () => void;

  /**
   * Obtem arquivos para chat API
   */
  getAttachedFilesForChat: () => { id: string; name: string; type: string }[];

  /**
   * Obtem dados extraidos (IA)
   */
  getExtractedData: () => {
    id: string;
    name: string;
    extractedText?: string;
    structuredDocs?: number;
  }[];

  /**
   * Ref para input de arquivo
   */
  inputRef: React.RefObject<HTMLInputElement | null>;

  /**
   * Abre seletor de arquivo
   */
  openFilePicker: () => void;

  // === VALIDACAO ===

  /**
   * Validar arquivo sem fazer upload
   */
  validate: (file: File) => FileValidationResult;

  /**
   * Validar multiplos arquivos
   */
  validateMultiple: (files: File[] | FileList) => FileValidationResult[];

  // === UTILITARIOS ===

  /**
   * Verificar se tipo e permitido
   */
  isTypeAllowed: (mimeType: string) => boolean;

  /**
   * Verificar se extensao e permitida
   */
  isExtensionAllowed: (filename: string) => boolean;

  /**
   * Formatar tamanho em bytes para string legivel
   */
  formatSize: (bytes: number) => string;

  /**
   * Obter extensao do arquivo
   */
  getExtension: (filename: string) => string;
}

// ============================================================
// CONSTANTS
// ============================================================

/** Tipos MIME padrao aceitos pelo ROM Agent */
const DEFAULT_ALLOWED_TYPES = [
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/json',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
];

/** Configuracao padrao de retry */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  retryableCodes: ['NETWORK_ERROR', 'SERVER_ERROR', 'TIMEOUT'],
};

/** Estado inicial */
const INITIAL_STATE: UploadState = {
  status: 'idle',
  progress: 0,
  bytesUploaded: 0,
  bytesTotal: 0,
  speed: 0,
  estimatedTimeRemaining: null,
  isUploading: false,
  canCancel: false,
  error: null,
  results: [],
  currentAttempt: 0,
  maxAttempts: DEFAULT_RETRY_CONFIG.maxRetries + 1,
  queue: [],
  currentFile: null,
  currentIndex: -1,
};

/** Mensagens de erro em portugues */
const ERROR_MESSAGES: Record<FileErrorCode, string> = {
  FILE_TOO_LARGE: 'Arquivo muito grande',
  FILE_TOO_SMALL: 'Arquivo muito pequeno',
  INVALID_TYPE: 'Tipo de arquivo nao permitido',
  INVALID_EXTENSION: 'Extensao de arquivo nao permitida',
  EMPTY_FILE: 'Arquivo vazio',
  MAX_FILES_EXCEEDED: 'Numero maximo de arquivos excedido',
  NETWORK_ERROR: 'Erro de conexao. Verifique sua internet',
  SERVER_ERROR: 'Erro no servidor. Tente novamente mais tarde',
  CSRF_ERROR: 'Erro de seguranca. Recarregue a pagina',
  AUTH_ERROR: 'Sessao expirada. Faca login novamente',
  TIMEOUT: 'Tempo limite excedido',
  CANCELLED: 'Upload cancelado',
  MAX_RETRIES_EXCEEDED: 'Numero maximo de tentativas excedido',
  UNKNOWN_ERROR: 'Erro desconhecido',
};

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Espera por um tempo determinado
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Formata bytes para string legivel
 */
function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Obtem extensao do arquivo
 */
function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop()?.toLowerCase() || '' : '';
}

/**
 * Verifica se tipo MIME corresponde ao padrao (suporta wildcards)
 */
function mimeTypeMatches(mimeType: string, pattern: string): boolean {
  if (pattern === '*' || pattern === '*/*') {
    return true;
  }

  if (pattern.endsWith('/*')) {
    const category = pattern.slice(0, -2);
    return mimeType.startsWith(`${category}/`);
  }

  return mimeType === pattern;
}

/**
 * Cria erro padronizado
 */
function createUploadError(
  code: FileErrorCode,
  file?: File,
  originalError?: Error,
  httpStatus?: number,
  attempt?: number
): UploadError {
  return {
    code,
    message: ERROR_MESSAGES[code],
    file,
    originalError,
    httpStatus,
    attempt,
  };
}

/**
 * Gera ID unico
 */
function generateId(): string {
  return `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Obtem URL do endpoint
 */
function getEndpointUrl(
  endpoint: UploadEndpoint,
  customEndpoint?: string,
  projectId?: string
): string {
  switch (endpoint) {
    case 'simple':
      return '/api/upload';
    case 'kb':
      return '/api/kb/upload';
    case 'documents':
      return '/api/upload-documents';
    case 'case-processor':
      return '/api/case-processor/process';
    case 'project':
      if (!projectId) throw new Error('projectId required for project endpoint');
      return `/api/projects/${projectId}/upload`;
    case 'custom':
      if (!customEndpoint)
        throw new Error('customEndpoint required for custom endpoint');
      return customEndpoint;
    default:
      return '/api/kb/upload';
  }
}

/**
 * Obtem nome do campo no FormData
 */
function getFormFieldName(endpoint: UploadEndpoint): string {
  switch (endpoint) {
    case 'simple':
      return 'file';
    default:
      return 'files';
  }
}

/**
 * Processa resposta do servidor baseado no tipo de endpoint
 */
function processServerResponse(
  response: Record<string, unknown>,
  initialFileInfo: FileInfo,
  fileId: string
): FileInfo {
  let completedFileInfo: FileInfo = {
    ...initialFileInfo,
    status: 'completed',
    progress: 100,
  };

  // /api/kb/upload returns { documents: [...] }
  if (
    response.documents &&
    Array.isArray(response.documents) &&
    response.documents.length > 0
  ) {
    const doc = response.documents[0] as Record<string, unknown>;
    completedFileInfo = {
      ...completedFileInfo,
      id: (doc.id as string) || fileId,
      url: doc.path as string | undefined,
      extractedText: doc.extractedText as string | undefined,
      textLength: doc.textLength as number | undefined,
      wordCount: (doc.metadata as Record<string, unknown>)?.wordCount as number | undefined,
      toolsUsed: (doc.metadata as Record<string, unknown>)?.toolsUsed as string[] | undefined,
      structuredDocuments: doc.structuredDocs
        ? {
            filesGenerated: doc.structuredDocs as number,
            outputPath: (doc.metadata as Record<string, unknown>)?.structuredDocsPath as string | undefined,
            files: (doc.metadata as Record<string, unknown>)?.structuredDocsInKB as Array<{
              name: string;
              path: string;
              type: string;
            }> | undefined,
          }
        : undefined,
      metadata: doc.metadata as Record<string, unknown>,
    };
  }
  // /api/upload returns { file: {...}, message: '...' }
  else if (response.file) {
    const file = response.file as Record<string, unknown>;
    completedFileInfo = {
      ...completedFileInfo,
      id: (file.filename as string) || fileId,
      url: file.path as string | undefined,
      metadata: file as Record<string, unknown>,
    };
  }
  // /api/case-processor/process returns { success, case: {...} }
  else if (response.case) {
    const caseData = response.case as Record<string, unknown>;
    completedFileInfo = {
      ...completedFileInfo,
      id: (caseData.id as string) || fileId,
      metadata: caseData as Record<string, unknown>,
    };
  }
  // /api/projects/:id/upload returns { uploadedFiles: [...], kbUsage: {...} }
  else if (response.uploadedFiles && Array.isArray(response.uploadedFiles)) {
    const uploaded = response.uploadedFiles[0] as Record<string, unknown>;
    completedFileInfo = {
      ...completedFileInfo,
      id: (uploaded?.id as string) || fileId,
      url: uploaded?.path as string | undefined,
      metadata: { ...uploaded, kbUsage: response.kbUsage } as Record<string, unknown>,
    };
  }
  // Generic response with id
  else if (response.id) {
    completedFileInfo = {
      ...completedFileInfo,
      id: response.id as string,
      url: (response.url || response.path) as string | undefined,
      metadata: response as Record<string, unknown>,
    };
  }

  return completedFileInfo;
}

// ============================================================
// MAIN HOOK
// ============================================================

/**
 * Hook React DEFINITIVO para upload de arquivos
 *
 * @template T - Tipo da resposta do servidor
 * @param options - Opcoes de configuracao
 * @returns Objeto com estado e funcoes de upload
 *
 * @example
 * ```tsx
 * function UploadComponent() {
 *   const {
 *     upload,
 *     uploadFile,
 *     state,
 *     attachedFiles,
 *     validate,
 *     cancel,
 *   } = useFileUpload({
 *     endpoint: 'kb',
 *     maxSize: 10 * 1024 * 1024,
 *     allowedTypes: ['application/pdf'],
 *     onSuccess: (result) => console.log('Upload OK:', result.response.id),
 *     onUploadComplete: (file, info) => console.log('Texto:', info.extractedText),
 *   });
 *
 *   return (
 *     <div>
 *       <input
 *         type="file"
 *         onChange={(e) => {
 *           const file = e.target.files?.[0];
 *           if (file) upload(file);
 *         }}
 *       />
 *       {state.isUploading && (
 *         <div>
 *           <progress value={state.progress} max={100} />
 *           <span>{formatBytes(state.speed)}/s</span>
 *           <button onClick={cancel}>Cancelar</button>
 *         </div>
 *       )}
 *       {state.error && <p className="error">{state.error.message}</p>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useFileUpload<T = DefaultUploadResponse>(
  options: UseFileUploadOptions<T> = {}
): UseFileUploadReturn<T> {
  // ============================================================
  // OPTIONS WITH DEFAULTS
  // ============================================================

  const {
    // Endpoint options
    endpoint = 'kb',
    customEndpoint,
    projectId,
    processWithAI = true,

    // Config options
    method = 'POST',
    fieldName: customFieldName,
    maxSize: maxSizeOption,
    maxSizeBytes,
    minSize = 1,
    maxFiles = 5,
    allowedTypes = DEFAULT_ALLOWED_TYPES,
    allowedExtensions = [],
    timeout = 600000, // 10min para arquivos grandes (até 500MB)
    headers: customHeaders = {},
    additionalData = {},
    retry: retryOptions = {},
    withCsrf = true,
    withCredentials = true,
    validateBeforeUpload = true,

    // New API callbacks
    onProgress,
    onSuccess,
    onError,
    onCancel,
    onStart,
    onComplete,
    onRetry,

    // Legacy API callbacks
    onUploadStart,
    onUploadProgress,
    onUploadComplete,
    onUploadError,

    // Customization
    customValidation,
    transformResponse,
  } = options;

  // Resolve maxSize (suporta ambos nomes)
  const maxSize = maxSizeOption ?? maxSizeBytes ?? 50 * 1024 * 1024;

  // Resolve fieldName baseado no endpoint
  const fieldName = customFieldName ?? getFormFieldName(endpoint);

  // Merge retry config
  const retryConfig: RetryConfig = {
    ...DEFAULT_RETRY_CONFIG,
    ...retryOptions,
  };

  // ============================================================
  // STATE
  // ============================================================

  const [state, setState] = useState<UploadState<T>>({
    ...INITIAL_STATE,
    maxAttempts: retryConfig.maxRetries + 1,
  } as UploadState<T>);

  // Estado legado (para compatibilidade)
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [legacyError, setLegacyError] = useState<string | null>(null);

  // ============================================================
  // REFS
  // ============================================================

  /** XMLHttpRequest para upload com progresso */
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  /** Controller para cancelamento */
  const abortControllerRef = useRef<AbortController | null>(null);

  /** Timestamp do inicio do upload */
  const startTimeRef = useRef<number>(0);

  /** Bytes enviados no ultimo update de progresso */
  const lastBytesRef = useRef<number>(0);

  /** Timestamp do ultimo update de progresso */
  const lastTimeRef = useRef<number>(0);

  /** Flag para indicar se upload foi cancelado */
  const cancelledRef = useRef<boolean>(false);

  /** Erros acumulados em upload multiplo */
  const errorsRef = useRef<UploadError[]>([]);

  /** Ref para input de arquivo */
  const inputRef = useRef<HTMLInputElement>(null);

  // ============================================================
  // UTILITY METHODS
  // ============================================================

  /**
   * Formata tamanho em bytes
   */
  const formatSize = useCallback((bytes: number): string => {
    return formatBytes(bytes);
  }, []);

  /**
   * Obtem extensao do arquivo
   */
  const getExtension = useCallback((filename: string): string => {
    return getFileExtension(filename);
  }, []);

  /**
   * Verifica se tipo e permitido
   */
  const isTypeAllowed = useCallback(
    (mimeType: string): boolean => {
      if (allowedTypes.length === 0) {
        return true;
      }
      return allowedTypes.some((pattern) => mimeTypeMatches(mimeType, pattern));
    },
    [allowedTypes]
  );

  /**
   * Verifica se extensao e permitida
   */
  const isExtensionAllowed = useCallback(
    (filename: string): boolean => {
      if (allowedExtensions.length === 0) {
        return true;
      }
      const ext = getFileExtension(filename);
      return allowedExtensions.map((e) => e.toLowerCase()).includes(ext);
    },
    [allowedExtensions]
  );

  /**
   * Valida um arquivo
   */
  const validate = useCallback(
    (file: File): FileValidationResult => {
      const errors: FileValidationError[] = [];

      // Verificar arquivo vazio
      if (file.size === 0) {
        errors.push({
          code: 'EMPTY_FILE',
          message: ERROR_MESSAGES.EMPTY_FILE,
          actual: 0,
        });
      }

      // Verificar tamanho minimo
      if (file.size < minSize && file.size > 0) {
        errors.push({
          code: 'FILE_TOO_SMALL',
          message: `${ERROR_MESSAGES.FILE_TOO_SMALL}. Minimo: ${formatBytes(minSize)}`,
          actual: file.size,
          expected: minSize,
        });
      }

      // Verificar tamanho maximo
      if (file.size > maxSize) {
        errors.push({
          code: 'FILE_TOO_LARGE',
          message: `${ERROR_MESSAGES.FILE_TOO_LARGE}. Maximo: ${formatBytes(maxSize)}`,
          actual: file.size,
          expected: maxSize,
        });
      }

      // Verificar tipo MIME
      if (allowedTypes.length > 0 && !isTypeAllowed(file.type)) {
        errors.push({
          code: 'INVALID_TYPE',
          message: `${ERROR_MESSAGES.INVALID_TYPE}. Permitidos: ${allowedTypes.join(', ')}`,
          actual: file.type || 'desconhecido',
          expected: allowedTypes.join(', '),
        });
      }

      // Verificar extensao
      if (allowedExtensions.length > 0 && !isExtensionAllowed(file.name)) {
        errors.push({
          code: 'INVALID_EXTENSION',
          message: `${ERROR_MESSAGES.INVALID_EXTENSION}. Permitidas: ${allowedExtensions.join(', ')}`,
          actual: getFileExtension(file.name),
          expected: allowedExtensions.join(', '),
        });
      }

      // Verificar numero maximo de arquivos
      if (attachedFiles.length >= maxFiles) {
        errors.push({
          code: 'MAX_FILES_EXCEEDED',
          message: `${ERROR_MESSAGES.MAX_FILES_EXCEEDED}. Maximo: ${maxFiles}`,
          actual: attachedFiles.length + 1,
          expected: maxFiles,
        });
      }

      // Validacao customizada
      if (customValidation) {
        const customErrors = customValidation(file);
        errors.push(...customErrors);
      }

      return {
        valid: errors.length === 0,
        errors,
        file,
      };
    },
    [
      minSize,
      maxSize,
      maxFiles,
      allowedTypes,
      allowedExtensions,
      isTypeAllowed,
      isExtensionAllowed,
      attachedFiles.length,
      customValidation,
    ]
  );

  /**
   * Valida multiplos arquivos
   */
  const validateMultiple = useCallback(
    (files: File[] | FileList): FileValidationResult[] => {
      const fileArray = Array.from(files);
      return fileArray.map(validate);
    },
    [validate]
  );

  // ============================================================
  // CORE UPLOAD LOGIC
  // ============================================================

  /**
   * Converte File para Base64
   */
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove o prefixo "data:*/*;base64,"
        const base64 = result.split(',')[1] || result;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  /**
   * Executa upload de um arquivo (interno) - REFATORADO para fetch()
   */
  const executeUpload = useCallback(
    async (file: File, fileId: string, attempt: number = 1): Promise<T> => {
      console.log('🚀 [useFileUpload] Starting upload (fetch):', {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        fileId,
        attempt,
        endpoint,
        customEndpoint,
      });

      // Verificar Service Worker
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        console.warn('⚠️ [useFileUpload] Service Worker ATIVO detectado!', {
          scope: navigator.serviceWorker.controller.scriptURL
        });
      } else {
        console.log('✅ [useFileUpload] Nenhum Service Worker ativo');
      }

      // Criar AbortController para cancelamento
      const abortController = new AbortController();
      xhrRef.current = { abort: () => abortController.abort() } as any;

      try {
        // Preparar FormData
        const formData = new FormData();
        formData.append(fieldName, file);

        // Adicionar dados extras
        Object.entries(additionalData).forEach(([key, value]) => {
          formData.append(key, value);
        });

        // Adicionar flag de processamento IA se aplicavel
        if (processWithAI && endpoint !== 'simple') {
          formData.append('processWithAI', 'true');
        }

        // URL do upload
        const uploadUrl = getEndpointUrl(endpoint, customEndpoint, projectId);
        console.log('📡 [useFileUpload] Upload URL:', uploadUrl);
        console.log('📦 [useFileUpload] FormData field name:', fieldName);

        // Preparar headers
        const headers: Record<string, string> = { ...customHeaders };

        // Obter CSRF token
        if (withCsrf) {
          console.log('🔑 [useFileUpload] Getting CSRF token...');
          const csrfToken = await getCsrfToken();
          if (csrfToken) {
            console.log('✅ [useFileUpload] CSRF token obtained');
            headers['x-csrf-token'] = csrfToken;
          } else {
            console.warn('⚠️ [useFileUpload] No CSRF token returned');
          }
        }

        console.log('📤 [useFileUpload] Sending fetch() request...', {
          method,
          url: uploadUrl,
          timeout: `${timeout}ms`,
          withCredentials,
          fileSize: file.size
        });

        // Progress indeterminado (0 → 50 durante upload)
        console.log('🎬 [useFileUpload] Upload started');
        setState((prev) => ({
          ...prev,
          progress: 50,
          bytesUploaded: file.size / 2,
          bytesTotal: file.size,
        }));

        setAttachedFiles((prev) =>
          prev.map((af) =>
            af.fileInfo.id === fileId
              ? { ...af, fileInfo: { ...af.fileInfo, progress: 50 } }
              : af
          )
        );

        onProgress?.(50, file.size / 2, file.size);

        // Fazer upload com timeout
        const timeoutId = setTimeout(() => abortController.abort(), timeout);

        const response = await fetch(uploadUrl, {
          method,
          body: formData,
          headers,
          credentials: withCredentials ? 'include' : 'same-origin',
          signal: abortController.signal,
        });

        clearTimeout(timeoutId);

        console.log('📥 [useFileUpload] Response received:', {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok
        });

        // Tratar resposta
        if (response.status >= 200 && response.status < 300) {
          const responseText = await response.text();
          let result: any;

          try {
            result = JSON.parse(responseText);
            console.log('✅ [useFileUpload] Upload successful:', result);
          } catch (parseError) {
            console.error('❌ [useFileUpload] JSON parse error:', parseError);
            throw createUploadError(
              'SERVER_ERROR',
              file,
              parseError as Error,
              response.status,
              attempt
            );
          }

          // Transformar resposta se necessário
          if (transformResponse) {
            result = transformResponse(result);
          }

          // Progress 100%
          setState((prev) => ({
            ...prev,
            progress: 100,
            bytesUploaded: file.size,
            bytesTotal: file.size,
          }));

          setAttachedFiles((prev) =>
            prev.map((af) =>
              af.fileInfo.id === fileId
                ? { ...af, fileInfo: { ...af.fileInfo, progress: 100 } }
                : af
            )
          );

          onProgress?.(100, file.size, file.size);

          return result as T;

        } else if (response.status === 401) {
          console.error('❌ [useFileUpload] Auth error (401)');
          clearCsrfToken();
          if (
            typeof window !== 'undefined' &&
            !window.location.pathname.includes('/login')
          ) {
            window.location.href = '/login';
          }
          throw createUploadError('AUTH_ERROR', file, undefined, 401, attempt);

        } else if (response.status === 403) {
          console.error('❌ [useFileUpload] CSRF error (403)');
          clearCsrfToken();
          throw createUploadError('CSRF_ERROR', file, undefined, 403, attempt);

        } else {
          console.error('❌ [useFileUpload] Server error:', response.status, response.statusText);
          throw createUploadError('SERVER_ERROR', file, undefined, response.status, attempt);
        }

      } catch (error: any) {
        // Se falhar na primeira tentativa com timeout/network error, tenta Base64
        if (attempt === 1 && (error.name === 'AbortError' || error.code === 'ERR_NETWORK' || error.message?.includes('Failed to fetch'))) {
          console.warn(`⚠️ [useFileUpload] FormData upload failed, trying Base64 fallback...`);

          try {
            // Converter arquivo para Base64
            console.log('🔄 [useFileUpload] Converting file to Base64...');
            const base64Data = await fileToBase64(file);
            console.log('✅ [useFileUpload] Base64 conversion complete');

            // Obter CSRF token
            let csrfToken = '';
            if (withCsrf) {
              console.log('🔑 [useFileUpload] Getting CSRF token for Base64...');
              csrfToken = await getCsrfToken() || '';
            }

            console.log('📤 [useFileUpload] Sending Base64 request...');

            // Upload via Base64
            const base64Response = await fetch('/api/upload/base64', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
              },
              credentials: withCredentials ? 'include' : 'same-origin',
              body: JSON.stringify({
                filename: file.name,
                data: base64Data,
                mimetype: file.type
              }),
            });

            console.log('📥 [useFileUpload] Base64 response:', {
              status: base64Response.status,
              ok: base64Response.ok
            });

            if (base64Response.ok) {
              const result = await base64Response.json();
              console.log('✅ [useFileUpload] Base64 upload successful!', result);

              // Progress 100%
              setState((prev) => ({
                ...prev,
                progress: 100,
                bytesUploaded: file.size,
                bytesTotal: file.size,
              }));

              setAttachedFiles((prev) =>
                prev.map((af) =>
                  af.fileInfo.id === fileId
                    ? { ...af, fileInfo: { ...af.fileInfo, progress: 100 } }
                    : af
                )
              );

              return result as T;
            } else {
              throw new Error(`Base64 upload failed: ${base64Response.status}`);
            }
          } catch (base64Error: any) {
            console.error('❌ [useFileUpload] Base64 fallback also failed:', base64Error);
            // Se Base64 também falhar, propagar erro original
          }
        }

        // Tratamento de erros padrão
        if (error.name === 'AbortError') {
          console.warn('⚠️ [useFileUpload] Upload aborted/timeout');
          throw createUploadError('TIMEOUT', file, undefined, undefined, attempt);
        } else if (error.code === 'ERR_NETWORK' || error.message?.includes('Failed to fetch')) {
          console.error('❌ [useFileUpload] Network error:', error);
          throw createUploadError('NETWORK_ERROR', file, error, undefined, attempt);
        } else {
          console.error('❌ [useFileUpload] Unexpected error:', error);
          throw error;
        }
      }
    },
    [
      endpoint,
      customEndpoint,
      projectId,
      method,
      fieldName,
      timeout,
      withCredentials,
      withCsrf,
      customHeaders,
      additionalData,
      processWithAI,
      transformResponse,
      onProgress,
      onUploadProgress,
    ]
  );

  /**
   * Upload com retry
   */
  const uploadWithRetry = useCallback(
    async (file: File, fileId: string): Promise<T> => {
      let lastError: UploadError | null = null;
      let delay = retryConfig.initialDelay;

      for (let attempt = 1; attempt <= retryConfig.maxRetries + 1; attempt++) {
        if (cancelledRef.current) {
          throw createUploadError('CANCELLED', file, undefined, undefined, attempt);
        }

        try {
          setState((prev) => ({
            ...prev,
            status: attempt > 1 ? 'retrying' : 'uploading',
            currentAttempt: attempt,
          }));

          if (attempt > 1 && lastError) {
            onRetry?.(attempt, retryConfig.maxRetries + 1, lastError);
          }

          const result = await executeUpload(file, fileId, attempt);
          return result;
        } catch (error) {
          lastError = error as UploadError;

          const canRetry =
            attempt < retryConfig.maxRetries + 1 &&
            retryConfig.retryableCodes.includes(lastError.code) &&
            !cancelledRef.current;

          if (!canRetry) {
            if (attempt >= retryConfig.maxRetries + 1) {
              lastError = {
                ...lastError,
                code: 'MAX_RETRIES_EXCEEDED',
                message: `${ERROR_MESSAGES.MAX_RETRIES_EXCEEDED}. Ultimo erro: ${lastError.message}`,
              };
            }
            throw lastError;
          }

          await sleep(delay);
          delay = Math.min(delay * retryConfig.backoffMultiplier, retryConfig.maxDelay);
        }
      }

      throw lastError || createUploadError('UNKNOWN_ERROR', file);
    },
    [executeUpload, retryConfig, onRetry]
  );

  // ============================================================
  // PUBLIC METHODS
  // ============================================================

  /**
   * Cancela upload em andamento
   */
  const cancel = useCallback(() => {
    cancelledRef.current = true;

    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    const currentFile = state.currentFile;

    setState((prev) => ({
      ...prev,
      status: 'cancelled',
      isUploading: false,
      canCancel: false,
      error: createUploadError('CANCELLED', currentFile || undefined),
      queue: [],
      currentFile: null,
      currentIndex: -1,
    }));

    onCancel?.(currentFile);
  }, [state.currentFile, onCancel]);

  /**
   * Reseta estado
   */
  const reset = useCallback(() => {
    if (state.isUploading) {
      cancel();
    }

    cancelledRef.current = false;
    errorsRef.current = [];

    setState({
      ...INITIAL_STATE,
      maxAttempts: retryConfig.maxRetries + 1,
    } as UploadState<T>);

    setAttachedFiles([]);
    setLegacyError(null);
  }, [state.isUploading, cancel, retryConfig.maxRetries]);

  /**
   * Upload de um arquivo (API NOVA)
   */
  const upload = useCallback(
    async (file: File): Promise<UploadResult<T>> => {
      cancelledRef.current = false;
      errorsRef.current = [];

      const fileId = generateId();

      // Validar
      if (validateBeforeUpload) {
        setState((prev) => ({ ...prev, status: 'validating' }));

        const validation = validate(file);
        if (!validation.valid) {
          const error = createUploadError(validation.errors[0].code, file);
          error.message = validation.errors[0].message;

          setState((prev) => ({
            ...prev,
            status: 'error',
            error,
            isUploading: false,
            canCancel: false,
          }));

          setLegacyError(error.message);
          onError?.(error);
          onUploadError?.(file, error.message);
          throw error;
        }
      }

      // Criar FileInfo inicial
      const initialFileInfo: FileInfo = {
        id: fileId,
        name: file.name,
        size: file.size,
        type: file.type,
        uploadedAt: new Date().toISOString(),
        status: 'uploading',
        progress: 0,
      };

      // Adicionar aos arquivos anexados
      const attachedFile: AttachedFile = { fileInfo: initialFileInfo, file };
      setAttachedFiles((prev) => [...prev, attachedFile]);

      // Iniciar upload
      startTimeRef.current = Date.now();
      lastBytesRef.current = 0;
      lastTimeRef.current = Date.now();

      setState((prev) => ({
        ...prev,
        status: 'uploading',
        progress: 0,
        bytesUploaded: 0,
        bytesTotal: file.size,
        speed: 0,
        estimatedTimeRemaining: null,
        isUploading: true,
        canCancel: true,
        error: null,
        results: [],
        currentAttempt: 1,
        queue: [file],
        currentFile: file,
        currentIndex: 0,
      }));

      setLegacyError(null);

      onStart?.(file);
      onUploadStart?.(file);

      try {
        const response = await uploadWithRetry(file, fileId);
        const duration = Date.now() - startTimeRef.current;

        const result: UploadResult<T> = {
          file,
          response,
          duration,
        };

        // Processar resposta do servidor
        const completedFileInfo = processServerResponse(
          response as Record<string, unknown>,
          initialFileInfo,
          fileId
        );

        // Atualizar estado
        setState((prev) => ({
          ...prev,
          status: 'success',
          progress: 100,
          bytesUploaded: file.size,
          isUploading: false,
          canCancel: false,
          results: [result],
          currentFile: null,
          currentIndex: -1,
          queue: [],
        }));

        setAttachedFiles((prev) =>
          prev.map((af) =>
            af.fileInfo.id === fileId ? { ...af, fileInfo: completedFileInfo } : af
          )
        );

        onSuccess?.(result);
        onUploadComplete?.(file, completedFileInfo);
        onComplete?.([result], []);

        return result;
      } catch (error) {
        const uploadError = error as UploadError;

        setState((prev) => ({
          ...prev,
          status: 'error',
          isUploading: false,
          canCancel: false,
          error: uploadError,
          currentFile: null,
          currentIndex: -1,
          queue: [],
        }));

        setAttachedFiles((prev) =>
          prev.map((af) =>
            af.fileInfo.id === fileId
              ? {
                  ...af,
                  fileInfo: { ...af.fileInfo, status: 'error', error: uploadError.message },
                }
              : af
          )
        );

        setLegacyError(uploadError.message);
        onError?.(uploadError);
        onUploadError?.(file, uploadError.message);
        onComplete?.([], [uploadError]);

        throw uploadError;
      }
    },
    [
      validate,
      validateBeforeUpload,
      uploadWithRetry,
      onStart,
      onUploadStart,
      onSuccess,
      onUploadComplete,
      onError,
      onUploadError,
      onComplete,
    ]
  );

  /**
   * Upload de multiplos arquivos (API NOVA)
   */
  const uploadMultiple = useCallback(
    async (
      files: File[] | FileList
    ): Promise<{ results: UploadResult<T>[]; errors: UploadError[] }> => {
      const fileArray = Array.from(files);

      if (fileArray.length === 0) {
        return { results: [], errors: [] };
      }

      cancelledRef.current = false;
      errorsRef.current = [];

      const results: UploadResult<T>[] = [];
      const errors: UploadError[] = [];

      // Validar todos primeiro
      if (validateBeforeUpload) {
        setState((prev) => ({ ...prev, status: 'validating' }));

        const validations = validateMultiple(fileArray);
        const invalidFiles = validations.filter((v) => !v.valid);

        if (invalidFiles.length > 0) {
          invalidFiles.forEach((v) => {
            const error = createUploadError(v.errors[0].code, v.file);
            error.message = v.errors[0].message;
            errors.push(error);
            onError?.(error);
            onUploadError?.(v.file, error.message);
          });
        }
      }

      // Filtrar arquivos validos
      const validFiles = validateBeforeUpload
        ? fileArray.filter((f) => validate(f).valid)
        : fileArray;

      if (validFiles.length === 0) {
        setState((prev) => ({
          ...prev,
          status: errors.length > 0 ? 'error' : 'idle',
          error: errors[0] || null,
        }));

        setLegacyError(errors[0]?.message || null);
        onComplete?.([], errors);
        return { results, errors };
      }

      setState((prev) => ({
        ...prev,
        status: 'uploading',
        isUploading: true,
        canCancel: true,
        error: null,
        results: [],
        queue: validFiles,
        currentIndex: 0,
        currentFile: validFiles[0],
      }));

      // Upload sequencial
      for (let i = 0; i < validFiles.length; i++) {
        if (cancelledRef.current) {
          break;
        }

        const file = validFiles[i];

        try {
          const result = await upload(file);
          results.push(result);
        } catch (error) {
          const uploadError = error as UploadError;
          errors.push(uploadError);

          if (uploadError.code === 'CANCELLED') {
            break;
          }
        }
      }

      const finalStatus: UploadStatus = cancelledRef.current
        ? 'cancelled'
        : errors.length > 0 && results.length === 0
          ? 'error'
          : 'success';

      setState((prev) => ({
        ...prev,
        status: finalStatus,
        isUploading: false,
        canCancel: false,
        currentFile: null,
        currentIndex: -1,
        queue: [],
        error: errors[0] || null,
      }));

      setLegacyError(errors[0]?.message || null);
      onComplete?.(results, errors);

      return { results, errors };
    },
    [validate, validateMultiple, validateBeforeUpload, upload, onError, onUploadError, onComplete]
  );

  /**
   * Upload de arquivo (API LEGADA)
   */
  const uploadFile = useCallback(
    async (file: File): Promise<FileInfo | null> => {
      try {
        await upload(file);
        // Buscar o FileInfo atualizado
        const uploaded = attachedFiles.find(
          (af) => af.file === file || af.fileInfo.name === file.name
        );
        return uploaded?.fileInfo || null;
      } catch {
        return null;
      }
    },
    [upload, attachedFiles]
  );

  /**
   * Upload de multiplos arquivos (API LEGADA)
   */
  const uploadFiles = useCallback(
    async (files: File[]): Promise<FileInfo[]> => {
      const { results } = await uploadMultiple(files);
      return results.map((r) => {
        const response = r.response as DefaultUploadResponse;
        return {
          id: response.id || generateId(),
          name: r.file.name,
          size: r.file.size,
          type: r.file.type,
          uploadedAt: new Date().toISOString(),
          url: response.url,
          status: 'completed' as UploadStatus,
          progress: 100,
          extractedText: response.extractedText,
          textLength: response.textLength,
          wordCount: response.wordCount,
          toolsUsed: response.toolsUsed,
          structuredDocuments: response.structuredDocuments,
          metadata: response.metadata,
        };
      });
    },
    [uploadMultiple]
  );

  /**
   * Remove arquivo por ID
   */
  const removeFile = useCallback((fileId: string) => {
    setAttachedFiles((prev) => prev.filter((af) => af.fileInfo.id !== fileId));
    setLegacyError(null);
  }, []);

  /**
   * Limpa todos os arquivos
   */
  const clearFiles = useCallback(() => {
    setAttachedFiles([]);
    setLegacyError(null);

    setState((prev) => ({
      ...prev,
      status: 'idle',
      progress: 0,
      results: [],
      error: null,
    }));
  }, []);

  /**
   * Obtem arquivos para chat API
   */
  const getAttachedFilesForChat = useCallback(() => {
    return attachedFiles
      .filter((af) => af.fileInfo.status === 'completed')
      .map((af) => ({
        id: af.fileInfo.id,
        name: af.fileInfo.name,
        type: af.fileInfo.type,
        path: af.fileInfo.url, // ✅ CRÍTICO: Backend espera file.path
      }));
  }, [attachedFiles]);

  /**
   * Obtem dados extraidos (IA)
   */
  const getExtractedData = useCallback(() => {
    return attachedFiles
      .filter((af) => af.fileInfo.status === 'completed')
      .map((af) => ({
        id: af.fileInfo.id,
        name: af.fileInfo.name,
        extractedText: af.fileInfo.extractedText,
        structuredDocs: af.fileInfo.structuredDocuments?.filesGenerated,
      }));
  }, [attachedFiles]);

  /**
   * Abre seletor de arquivo
   */
  const openFilePicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  // ============================================================
  // MEMOIZED RETURN
  // ============================================================

  return useMemo(
    () => ({
      // Estado completo (API nova)
      state,

      // Estado simples (API legada)
      attachedFiles,
      isUploading: state.isUploading,
      uploadProgress: state.progress,
      error: legacyError,

      // Acoes (API nova)
      upload,
      uploadMultiple,
      cancel,
      reset,

      // Acoes (API legada)
      uploadFile,
      uploadFiles,
      removeFile,
      clearFiles,
      getAttachedFilesForChat,
      getExtractedData,
      inputRef,
      openFilePicker,

      // Validacao
      validate,
      validateMultiple,

      // Utilitarios
      isTypeAllowed,
      isExtensionAllowed,
      formatSize,
      getExtension,
    }),
    [
      state,
      attachedFiles,
      legacyError,
      upload,
      uploadMultiple,
      cancel,
      reset,
      uploadFile,
      uploadFiles,
      removeFile,
      clearFiles,
      getAttachedFilesForChat,
      getExtractedData,
      openFilePicker,
      validate,
      validateMultiple,
      isTypeAllowed,
      isExtensionAllowed,
      formatSize,
      getExtension,
    ]
  );
}

// ============================================================
// CONVENIENCE HOOKS
// ============================================================

/**
 * Hook simplificado para upload de PDF
 *
 * @example
 * ```tsx
 * const { upload, state } = usePdfUpload({
 *   onSuccess: (result) => console.log('PDF enviado:', result),
 * });
 * ```
 */
export function usePdfUpload<T = DefaultUploadResponse>(
  options: Omit<UseFileUploadOptions<T>, 'allowedTypes' | 'allowedExtensions'> = {}
): UseFileUploadReturn<T> {
  return useFileUpload<T>({
    ...options,
    allowedTypes: ['application/pdf'],
    allowedExtensions: ['pdf'],
  });
}

/**
 * Hook simplificado para upload de imagens
 *
 * @example
 * ```tsx
 * const { upload, state } = useImageUpload({
 *   maxSize: 5 * 1024 * 1024,
 *   onSuccess: (result) => console.log('Imagem enviada:', result),
 * });
 * ```
 */
export function useImageUpload<T = DefaultUploadResponse>(
  options: Omit<UseFileUploadOptions<T>, 'allowedTypes' | 'allowedExtensions'> = {}
): UseFileUploadReturn<T> {
  return useFileUpload<T>({
    ...options,
    allowedTypes: ['image/*'],
    allowedExtensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'],
  });
}

/**
 * Hook simplificado para upload de documentos
 *
 * @example
 * ```tsx
 * const { upload, state } = useDocumentUpload({
 *   onSuccess: (result) => console.log('Documento enviado:', result),
 * });
 * ```
 */
export function useDocumentUpload<T = DefaultUploadResponse>(
  options: Omit<UseFileUploadOptions<T>, 'allowedTypes' | 'allowedExtensions'> = {}
): UseFileUploadReturn<T> {
  return useFileUpload<T>({
    ...options,
    allowedTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv',
    ],
    allowedExtensions: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'csv'],
  });
}

/**
 * Hook para upload com extracao IA (Knowledge Base)
 *
 * @example
 * ```tsx
 * const { uploadFile, getExtractedData } = useKbUpload({
 *   processWithAI: true,
 *   onUploadComplete: (file, info) => {
 *     console.log('Texto extraido:', info.extractedText);
 *     console.log('Ferramentas usadas:', info.toolsUsed);
 *   },
 * });
 * ```
 */
export function useKbUpload<T = DefaultUploadResponse>(
  options: Omit<UseFileUploadOptions<T>, 'endpoint'> = {}
): UseFileUploadReturn<T> {
  return useFileUpload<T>({
    ...options,
    endpoint: 'kb',
    processWithAI: true,
  });
}

/**
 * Hook para processamento de processos judiciais
 *
 * @example
 * ```tsx
 * const { uploadFile } = useCaseProcessorUpload({
 *   onUploadComplete: (file, info) => {
 *     console.log('Documentos gerados:', info.structuredDocuments?.filesGenerated);
 *   },
 * });
 * ```
 */
export function useCaseProcessorUpload<T = DefaultUploadResponse>(
  options: Omit<UseFileUploadOptions<T>, 'endpoint'> = {}
): UseFileUploadReturn<T> {
  return useFileUpload<T>({
    ...options,
    endpoint: 'case-processor',
    processWithAI: true,
  });
}

// ============================================================
// DEFAULT EXPORT
// ============================================================

export default useFileUpload;
