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

    console.log(`[SSE] Conectando ao progresso: ${uploadId}`);

    // Aguardar 500ms antes de conectar (dar tempo para sessão ser criada)
    const connectTimeout = setTimeout(() => {
      // Conectar ao SSE de progresso
      const eventSource = new EventSource(
        `/api/upload-progress/${uploadId}/progress`,
        { withCredentials: true }
      );

      // Armazenar para cleanup
      (window as any).__activeEventSource = eventSource;

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
        console.error('[SSE] Erro na conexão:', err);
        console.error('[SSE] ReadyState:', eventSource.readyState);
        console.error('[SSE] URL:', eventSource.url);

        // Não fechar imediatamente - EventSource tenta reconectar automaticamente
        // Só fechar se completed ou tiver erro real
        if (progress.completed || eventSource.readyState === 2) {
          eventSource.close();
        }
      };

      // Evento de conexão aberta
      eventSource.onopen = () => {
        console.log('[SSE] Conexão estabelecida com sucesso');
      };
    }, 500);

    // Cleanup ao desmontar
    return () => {
      clearTimeout(connectTimeout);
      const es = (window as any).__activeEventSource;
      if (es) {
        es.close();
        delete (window as any).__activeEventSource;
      }
    };
  }, [uploadId]);

  return progress;
}
