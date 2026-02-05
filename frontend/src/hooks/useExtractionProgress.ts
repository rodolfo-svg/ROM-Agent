import { useState, useEffect, useCallback } from 'react';
import { getSocket } from '@/lib/socket';

interface ExtractionProgress {
  current: number;
  total: number;
  percentage: number;
  currentChunkName?: string;
  estimatedTimeRemaining?: number;
}

interface ExtractionJob {
  jobId: string;
  documentName: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: ExtractionProgress;
  chunksCompleted: number;
  chunksTotal: number;
  error?: string;
  metadata?: any;
}

export function useExtractionProgress(jobId: string | null) {
  const [job, setJob] = useState<ExtractionJob | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!jobId) return;

    const socket = getSocket();
    if (!socket) {
      console.error('[useExtractionProgress] Socket not initialized');
      setIsLoading(false);
      return;
    }

    // Subscribe to job updates
    socket.emit('subscribe_extraction', { jobId });

    // Listen for progress updates
    const handleProgress = (data: any) => {
      if (data.jobId === jobId) {
        setJob(data);
        setIsLoading(false);
      }
    };

    const handleComplete = (data: any) => {
      if (data.jobId === jobId) {
        setJob((prevJob) => ({
          ...prevJob,
          status: 'completed',
          progress: { current: 100, total: 100, percentage: 100 },
          metadata: data.metadata
        } as ExtractionJob));
        setIsLoading(false);
      }
    };

    const handleFailed = (data: any) => {
      if (data.jobId === jobId) {
        setJob((prevJob) => ({
          ...prevJob,
          status: 'failed',
          error: data.error
        } as ExtractionJob));
        setIsLoading(false);
      }
    };

    socket.on('extraction_progress', handleProgress);
    socket.on('extraction_complete', handleComplete);
    socket.on('extraction_failed', handleFailed);

    // Fetch initial job state
    fetch(`/api/extraction-jobs/${jobId}`, {
      credentials: 'include'
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setJob(data.job);
        }
        setIsLoading(false);
      })
      .catch(err => {
        console.error('[useExtractionProgress] Error fetching job:', err);
        setIsLoading(false);
      });

    return () => {
      socket.emit('unsubscribe_extraction', { jobId });
      socket.off('extraction_progress', handleProgress);
      socket.off('extraction_complete', handleComplete);
      socket.off('extraction_failed', handleFailed);
    };
  }, [jobId]);

  const cancelJob = useCallback(async () => {
    if (!jobId) return;

    try {
      const response = await fetch(`/api/extraction-jobs/${jobId}/cancel`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setJob(data.job);
      }
    } catch (error) {
      console.error('[useExtractionProgress] Error cancelling job:', error);
    }
  }, [jobId]);

  return { job, isLoading, cancelJob };
}
