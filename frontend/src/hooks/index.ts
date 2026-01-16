/**
 * ROM Agent - Hooks Index
 *
 * Central export for all React hooks
 */

// Online Status Hook
export {
  useOnlineStatus,
  useIsOnline,
  type OnlineStatusState,
  type UseOnlineStatusOptions,
  type UseOnlineStatusReturn,
} from './useOnlineStatus';

// File Upload Hook (DEFINITIVO v3.0)
export {
  // Main hook
  useFileUpload,
  // Convenience hooks
  usePdfUpload,
  useImageUpload,
  useDocumentUpload,
  useKbUpload,
  useCaseProcessorUpload,
  // Types
  type UploadStatus,
  type FileValidationResult,
  type FileValidationError,
  type FileErrorCode,
  type UploadResult,
  type DefaultUploadResponse,
  type FileInfo,
  type AttachedFile,
  type UploadProgress,
  type UploadError,
  type UploadState,
  type UploadEndpoint,
  type RetryConfig,
  type UseFileUploadOptions,
  type UseFileUploadReturn,
} from './useFileUpload';
