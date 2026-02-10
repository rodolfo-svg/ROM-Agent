import React, { useState, useEffect, useCallback } from 'react'
import { AlertCircle, CheckCircle, Loader2, X, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui'

interface ExtractionProgressBarProps {
  jobId: string
  onComplete?: (result: any) => void
  onError?: (error: string) => void
  onDismiss?: () => void
}

interface JobStatus {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  documentId: string
  documentName: string
  userId: string
  progress?: number
  chunksCompleted?: number
  chunksTotal?: number
  currentChunkDetails?: any
  metadata?: Record<string, any>
  error?: string
  startedAt?: string
  completedAt?: string
  createdAt?: string
}

export function ExtractionProgressBar({
  jobId,
  onComplete,
  onError,
  onDismiss
}: ExtractionProgressBarProps) {
  const [job, setJob] = useState<JobStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchJobStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/extraction-jobs/${jobId}`, {
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()

      if (data.success && data.job) {
        setJob(data.job)

        if (data.job.status === 'completed') {
          onComplete?.(data.job)
        }

        if (data.job.status === 'failed') {
          const errorMsg = data.job.error || 'Extraction failed'
          setError(errorMsg)
          onError?.(errorMsg)
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error fetching job status'
      setError(errorMsg)
      onError?.(errorMsg)
    }
  }, [jobId, onComplete, onError])

  useEffect(() => {
    fetchJobStatus()

    const pollInterval = setInterval(fetchJobStatus, 5000)

    return () => clearInterval(pollInterval)
  }, [fetchJobStatus])

  if (!job) {
    return null
  }

  const isComplete = job.status === 'completed'
  const isFailed = job.status === 'failed'
  const isCancelled = job.status === 'cancelled'
  const isProcessing = job.status === 'processing' || job.status === 'pending'

  const progress = job.progress || 0
  const statusLabel = {
    pending: 'Aguardando...',
    processing: 'Processando...',
    completed: 'Concluído',
    failed: 'Erro',
    cancelled: 'Cancelado'
  }[job.status]

  return (
    <div
      className={`p-4 rounded-lg border ${
        isFailed
          ? 'bg-red-50 border-red-200'
          : isCancelled
          ? 'bg-stone-50 border-stone-200'
          : isComplete
          ? 'bg-green-50 border-green-200'
          : 'bg-blue-50 border-blue-200'
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {isProcessing && (
            <Loader2 className="w-5 h-5 text-blue-500 animate-spin flex-shrink-0" />
          )}
          {isComplete && (
            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
          )}
          {(isFailed || isCancelled) && (
            <AlertCircle className={`w-5 h-5 flex-shrink-0 ${isFailed ? 'text-red-500' : 'text-stone-500'}`} />
          )}

          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate text-stone-800">
              {job.documentName}
            </p>
            <p className={`text-xs mt-1 ${
              isFailed ? 'text-red-600' : 'text-stone-600'
            }`}>
              {isFailed && error ? error : statusLabel}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
          {/* Botão cancelar extração (só aparece quando em andamento) */}
          {isProcessing && (
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                if (!job?.id) return;
                if (!confirm(`Cancelar extração de "${job.documentName}"?`)) return;

                setDeleting(true);
                try {
                  const response = await fetch(`/api/extraction-jobs/${job.id}/cancel`, {
                    method: 'POST',
                    credentials: 'include'
                  });
                  const data = await response.json();

                  if (data.success) {
                    onDismiss?.();
                  }
                } catch (err) {
                  console.error('Erro ao cancelar:', err);
                } finally {
                  setDeleting(false);
                }
              }}
              disabled={deleting}
              className="text-orange-400 hover:text-orange-600"
              title="Cancelar extração"
            >
              {deleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <X className="w-4 h-4" />
              )}
            </Button>
          )}

          {/* Botão deletar documento (só aparece quando completou ou falhou) */}
          {(isComplete || isFailed) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                if (!job?.documentId) return;
                if (!confirm(`Deletar documento "${job.documentName}"?`)) return;

                setDeleting(true);
                try {
                  const response = await fetch(`/api/kb/documents/${job.documentId}`, {
                    method: 'DELETE',
                    credentials: 'include'
                  });
                  const data = await response.json();

                  if (data.success) {
                    onDismiss?.();
                  }
                } catch (err) {
                  console.error('Erro ao deletar:', err);
                } finally {
                  setDeleting(false);
                }
              }}
              disabled={deleting}
              className="text-red-400 hover:text-red-600"
              title="Deletar documento"
            >
              {deleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </Button>
          )}

          {/* Botão fechar/ocultar */}
          {isComplete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="text-stone-400 hover:text-stone-600"
              title="Ocultar"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {isProcessing && (
        <div className="space-y-2">
          <div className="w-full bg-stone-200 rounded-full h-2 overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                job.status === 'processing'
                  ? 'bg-blue-500'
                  : 'bg-stone-400'
              }`}
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>

          <div className="flex justify-between items-center text-xs text-stone-600">
            <span>
              {job.chunksTotal && job.chunksCompleted !== undefined
                ? `Chunk ${job.chunksCompleted}/${job.chunksTotal}`
                : 'Processando'}
            </span>
            <span className="font-medium">{Math.round(progress)}%</span>
          </div>
        </div>
      )}

      {isComplete && (
        <div className="text-xs text-green-700 space-y-1">
          <p>Extração concluída com sucesso!</p>
          {job.metadata?.totalCost && (
            <p>Custo: ${job.metadata.totalCost.toFixed(4)}</p>
          )}
        </div>
      )}

      {isFailed && (
        <div className="text-xs text-red-700">
          <p>{error || 'Erro desconhecido'}</p>
        </div>
      )}

      {isCancelled && (
        <div className="text-xs text-stone-700">
          <p>Extração foi cancelada</p>
        </div>
      )}
    </div>
  )
}

export default ExtractionProgressBar
