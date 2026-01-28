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

    // Aguardar 1000ms antes de conectar (dar tempo para sessão ser criada)
    const connectTime = Date.now();
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
        console.log('[SSE] Session complete recebido:', result);
        setProgress(prev => ({
          ...prev,
          percent: 100,
          completed: true,
          stage: 'Concluído',
          result: result.summary
        }));
        console.log('[SSE] Fechando conexão (sessão completa)');
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

        // Se já completou, fechar imediatamente
        if (progress.completed) {
          console.log('[SSE] Fechando conexão (já completado)');
          eventSource.close();
          return;
        }

        // Se readyState = CLOSED (2), não tentar reconectar
        if (eventSource.readyState === 2) {
          console.log('[SSE] Conexão permanentemente fechada');
          eventSource.close();
          return;
        }

        // Se readyState = CONNECTING (0), deixar EventSource tentar reconectar
        // Mas se já tentou por > 10 segundos, desistir
        const elapsed = Date.now() - connectTime;
        if (elapsed > 10000) {
          console.error('[SSE] Timeout de reconexão (10s), desistindo');
          setProgress(prev => ({
            ...prev,
            error: 'Timeout de conexão SSE. Upload continua em background.',
            stage: 'Processando em background'
          }));
          eventSource.close();
        }
      };

      // Evento de conexão aberta
      eventSource.onopen = () => {
        console.log('[SSE] Conexão estabelecida com sucesso');
      };
    }, 1000);

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
