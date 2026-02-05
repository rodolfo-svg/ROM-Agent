/**
 * ExtractionJob Model
 *
 * Tracks V2 extraction and analysis jobs with real-time progress updates
 */

import { DataTypes } from 'sequelize';
import sequelize from '../config/sequelize.js';

const ExtractionJob = sequelize.define('ExtractionJob', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },

  documentId: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'document_id'
  },

  documentName: {
    type: DataTypes.STRING(500),
    allowNull: false,
    field: 'document_name'
  },

  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'user_id'
  },

  // Status tracking
  status: {
    type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed', 'cancelled'),
    allowNull: false,
    defaultValue: 'pending'
  },

  // Progress tracking
  progress: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {
      current: 0,
      total: 1,
      percentage: 0
    }
  },

  // Method and chunking
  method: {
    type: DataTypes.STRING(50),
    defaultValue: 'single-pass'
  },

  chunksTotal: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    field: 'chunks_total'
  },

  chunksCompleted: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'chunks_completed'
  },

  currentChunkDetails: {
    type: DataTypes.JSONB,
    defaultValue: {},
    field: 'current_chunk_details'
  },

  // Timestamps
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'created_at'
  },

  startedAt: {
    type: DataTypes.DATE,
    field: 'started_at'
  },

  completedAt: {
    type: DataTypes.DATE,
    field: 'completed_at'
  },

  cancelledAt: {
    type: DataTypes.DATE,
    field: 'cancelled_at'
  },

  // Results
  resultDocumentId: {
    type: DataTypes.STRING(255),
    field: 'result_document_id'
  },

  errorMessage: {
    type: DataTypes.TEXT,
    field: 'error_message'
  },

  // Metadata
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {}
  }

}, {
  tableName: 'extraction_jobs',
  timestamps: false, // We manage timestamps manually
  indexes: [
    { fields: ['user_id'] },
    { fields: ['document_id'] },
    { fields: ['status'] },
    { fields: ['created_at'] }
  ]
});

/**
 * Helper: Update progress
 */
ExtractionJob.prototype.updateProgress = async function(current, total, extraData = {}) {
  const percentage = Math.round((current / total) * 100);

  this.progress = {
    current,
    total,
    percentage,
    ...extraData
  };

  await this.save();
  return this;
};

/**
 * Helper: Mark as started
 */
ExtractionJob.prototype.markAsStarted = async function(method = 'single-pass', chunksTotal = 1) {
  this.status = 'processing';
  this.startedAt = new Date();
  this.method = method;
  this.chunksTotal = chunksTotal;

  await this.save();
  return this;
};

/**
 * Helper: Mark chunk completed
 */
ExtractionJob.prototype.markChunkCompleted = async function(chunkNumber, chunkDetails = {}) {
  this.chunksCompleted += 1;
  this.currentChunkDetails = {
    chunkNumber,
    ...chunkDetails
  };

  await this.updateProgress(this.chunksCompleted, this.chunksTotal, {
    currentChunkName: `Chunk ${chunkNumber + 1}/${this.chunksTotal}`,
    estimatedTimeRemaining: (this.chunksTotal - this.chunksCompleted) * 30 // 30s per chunk
  });

  return this;
};

/**
 * Helper: Mark as completed
 */
ExtractionJob.prototype.markAsCompleted = async function(resultDocumentId, metadata = {}) {
  this.status = 'completed';
  this.completedAt = new Date();
  this.resultDocumentId = resultDocumentId;
  this.metadata = {
    ...this.metadata,
    ...metadata
  };

  await this.updateProgress(this.chunksTotal, this.chunksTotal);

  await this.save();
  return this;
};

/**
 * Helper: Mark as failed
 */
ExtractionJob.prototype.markAsFailed = async function(errorMessage) {
  this.status = 'failed';
  this.completedAt = new Date();
  this.errorMessage = errorMessage;

  await this.save();
  return this;
};

/**
 * Static: Get active jobs for user
 */
ExtractionJob.getActiveJobsForUser = async function(userId) {
  return await ExtractionJob.findAll({
    where: {
      userId,
      status: ['pending', 'processing']
    },
    order: [['created_at', 'DESC']]
  });
};

/**
 * Static: Get recent jobs for user
 */
ExtractionJob.getRecentJobsForUser = async function(userId, limit = 20) {
  return await ExtractionJob.findAll({
    where: { userId },
    order: [['created_at', 'DESC']],
    limit
  });
};

export default ExtractionJob;
