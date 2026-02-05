-- Migration: Create extraction_jobs table for real-time progress tracking
-- Created: 2026-02-05
-- Purpose: Track V2 extraction/analysis jobs with real-time progress updates

CREATE TABLE IF NOT EXISTS extraction_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id VARCHAR(255) NOT NULL,
  document_name VARCHAR(500) NOT NULL,
  user_id UUID NOT NULL,

  -- Status tracking
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed', 'cancelled'

  -- Progress tracking
  progress JSONB NOT NULL DEFAULT '{"current": 0, "total": 1, "percentage": 0}'::jsonb,

  -- Method and chunking info
  method VARCHAR(50) DEFAULT 'single-pass', -- 'single-pass' or 'chunking'
  chunks_total INTEGER DEFAULT 1,
  chunks_completed INTEGER DEFAULT 0,
  current_chunk_details JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  cancelled_at TIMESTAMP,

  -- Results
  result_document_id VARCHAR(255), -- ID of the extracted/analyzed document
  error_message TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Foreign keys
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_extraction_jobs_user_id ON extraction_jobs(user_id);
CREATE INDEX idx_extraction_jobs_document_id ON extraction_jobs(document_id);
CREATE INDEX idx_extraction_jobs_status ON extraction_jobs(status);
CREATE INDEX idx_extraction_jobs_created_at ON extraction_jobs(created_at DESC);

-- Comments
COMMENT ON TABLE extraction_jobs IS 'Tracks V2 extraction and analysis jobs with real-time progress';
COMMENT ON COLUMN extraction_jobs.status IS 'Current job status: pending, processing, completed, failed, cancelled';
COMMENT ON COLUMN extraction_jobs.progress IS 'Progress details: { current, total, percentage, currentChunkName, estimatedTimeRemaining }';
COMMENT ON COLUMN extraction_jobs.method IS 'Extraction method: single-pass or chunking';
COMMENT ON COLUMN extraction_jobs.metadata IS 'Additional metadata: { originalSize, extractedSize, cost, model, etc }';
