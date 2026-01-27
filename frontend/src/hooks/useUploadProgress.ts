import { useEffect, useState } from 'react';

export interface UploadProgress {
  percent: number;
  stage: string;
  currentFile: number;
  totalFiles: number;
  fileName: string;
  completed: boolean;
  error: string | null;
  result: any | null;
}

/**
 * Hook para acompanhar progresso de upload via SSE
 * @param uploadId - ID do upload retornado por /api/kb/upload
 * @returns Estado do progresso em tempo real
 */
export function useUploadProgress(uploadId: string | null) {
  const [progress, setProgress] = useState<UploadProgress>({
    percent: 0,
    stage: 'Aguardando...',
    currentFile: 0,
    totalFiles: 0,
    fileName: '',
    completed: false,
    error: null,
    result: null
  });

  useEffect(() => {
    if (!uploadId) return;

    // Conectar ao SSE de progresso
    const eventSource = new EventSource(
      `/api/upload-progress/${uploadId}/progress`,
      { withCredentials: true }
    );

    // Eventos de progresso (info, success, error)
    eventSource.onmessage = (event) => {
      try {
        const update = JSON.parse(event.data);

        if (update.type === 'info' || update.type === 'success') {
          setProgress(prev => ({
            ...prev,
            percent: update.data?.percent ?? prev.percent,
            stage: update.message || prev.stage,
            currentFile: update.data?.currentFile ?? prev.currentFile,
            totalFiles: update.data?.totalFiles ?? prev.totalFiles,
            fileName: update.data?.fileName || prev.fileName
          }));
        } else if (update.type === 'error') {
          setProgress(prev => ({
            ...prev,
            error: update.message,
            stage: 'Erro'
          }));
        }
      } catch (err) {
        console.error('Erro ao processar evento SSE:', err);
      }
    };

    // Evento de conclusão
    eventSource.addEventListener('session-complete', (e: any) => {
      try {
        const result = JSON.parse(e.data);
        setProgress(prev => ({
          ...prev,
          percent: 100,
          completed: true,
          stage: 'Concluído',
          result: result.summary
        }));
        eventSource.close();
      } catch (err) {
        console.error('Erro ao processar session-complete:', err);
      }
    });

    // Evento de falha
    eventSource.addEventListener('session-failed', (e: any) => {
      try {
        const error = JSON.parse(e.data);
        setProgress(prev => ({
          ...prev,
          error: error.error?.message || 'Erro desconhecido',
          completed: true,
          stage: 'Falha'
        }));
        eventSource.close();
      } catch (err) {
        console.error('Erro ao processar session-failed:', err);
      }
    });

    // Erro de conexão
    eventSource.onerror = (err) => {
      console.error('Erro na conexão SSE:', err);
      eventSource.close();
    };

    // Cleanup ao desmontar
    return () => {
      eventSource.close();
    };
  }, [uploadId]);

  return progress;
}
