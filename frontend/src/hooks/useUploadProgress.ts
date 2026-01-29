import { useEffect, useState, useRef } from 'react';

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
 * Hook para acompanhar progresso de upload via SSE com fallback para polling
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

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const sseFailedRef = useRef(false);

  useEffect(() => {
    if (!uploadId) return;

    console.log(`[PROGRESS] Iniciando monitoramento: ${uploadId}`);

    // Tentar SSE primeiro, com fallback para polling
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
        // Mas se já tentou por > 5 segundos, fazer fallback para polling
        const elapsed = Date.now() - connectTime;
        if (elapsed > 5000 && !sseFailedRef.current) {
          console.warn('[SSE] Timeout (5s), fazendo fallback para polling');
          sseFailedRef.current = true;
          eventSource.close();

          // Iniciar polling como fallback
          startPolling();
        }
      };

      // Evento de conexão aberta
      eventSource.onopen = () => {
        console.log('[SSE] Conexão estabelecida com sucesso');
      };
    }, 1000);

    // Função de polling como fallback
    const startPolling = () => {
      console.log('[POLLING] Iniciando polling como fallback');

      const poll = async () => {
        try {
          const response = await fetch(`/api/upload-progress/${uploadId}/status`, {
            credentials: 'include'
          });

          if (response.ok) {
            const data = await response.json();

            setProgress(prev => ({
              ...prev,
              percent: data.percent || prev.percent,
              stage: data.stage || prev.stage,
              currentFile: data.currentFile || prev.currentFile,
              totalFiles: data.totalFiles || prev.totalFiles,
              fileName: data.fileName || prev.fileName,
              completed: data.completed || false,
              result: data.result || null
            }));

            // Se completou, parar polling
            if (data.completed) {
              console.log('[POLLING] Upload completo, parando polling');
              if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
              }
            }
          }
        } catch (err) {
          console.error('[POLLING] Erro:', err);
        }
      };

      // Poll inicial imediato
      poll();

      // Poll a cada 2 segundos
      pollingIntervalRef.current = setInterval(poll, 2000);
    };

    // Cleanup ao desmontar
    return () => {
      clearTimeout(connectTimeout);

      // Limpar EventSource
      const es = (window as any).__activeEventSource;
      if (es) {
        es.close();
        delete (window as any).__activeEventSource;
      }

      // Limpar polling
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [uploadId]);

  return progress;
}
