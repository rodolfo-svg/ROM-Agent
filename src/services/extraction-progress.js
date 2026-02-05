/**
 * Extraction Progress Service
 *
 * Manages real-time progress updates for V2 extraction/analysis jobs
 * Emits WebSocket events to frontend for live progress tracking
 */

import ExtractionJob from '../models/ExtractionJob.js';

class ExtractionProgressService {
  constructor() {
    this.io = null; // Socket.IO instance (set during server init)
    this.activeJobs = new Map(); // jobId -> { intervals, callbacks }
  }

  /**
   * Initialize with Socket.IO instance
   */
  initialize(socketIOInstance) {
    this.io = socketIOInstance;
    console.log('[ExtractionProgress] Service initialized with Socket.IO');
  }

  /**
   * Create new extraction job
   */
  async createJob(documentId, documentName, userId, metadata = {}) {
    const job = await ExtractionJob.create({
      documentId,
      documentName,
      userId,
      status: 'pending',
      metadata
    });

    console.log(`[ExtractionProgress] Created job ${job.id} for document ${documentName}`);

    // Emit to user
    this.emitToUser(userId, 'extraction_job_created', {
      jobId: job.id,
      documentId,
      documentName,
      status: 'pending'
    });

    return job;
  }

  /**
   * Start extraction job
   */
  async startJob(jobId, method = 'single-pass', chunksTotal = 1) {
    const job = await ExtractionJob.findByPk(jobId);
    if (!job) {
      console.error(`[ExtractionProgress] Job ${jobId} not found`);
      return null;
    }

    await job.markAsStarted(method, chunksTotal);

    console.log(`[ExtractionProgress] Started job ${jobId} with method=${method}, chunks=${chunksTotal}`);

    // Emit to user
    this.emitToUser(job.userId, 'extraction_started', {
      jobId: job.id,
      documentName: job.documentName,
      method,
      chunksTotal
    });

    return job;
  }

  /**
   * Update chunk progress
   */
  async updateChunkProgress(jobId, chunkNumber, chunkDetails = {}) {
    const job = await ExtractionJob.findByPk(jobId);
    if (!job) {
      console.error(`[ExtractionProgress] Job ${jobId} not found`);
      return null;
    }

    await job.markChunkCompleted(chunkNumber, chunkDetails);

    console.log(`[ExtractionProgress] Job ${jobId} completed chunk ${chunkNumber + 1}/${job.chunksTotal}`);

    // Emit real-time progress
    this.emitToUser(job.userId, 'extraction_progress', {
      jobId: job.id,
      documentName: job.documentName,
      status: 'processing',
      progress: job.progress,
      chunksCompleted: job.chunksCompleted,
      chunksTotal: job.chunksTotal,
      currentChunkDetails: job.currentChunkDetails
    });

    return job;
  }

  /**
   * Complete extraction job
   */
  async completeJob(jobId, resultDocumentId, metadata = {}) {
    const job = await ExtractionJob.findByPk(jobId);
    if (!job) {
      console.error(`[ExtractionProgress] Job ${jobId} not found`);
      return null;
    }

    await job.markAsCompleted(resultDocumentId, metadata);

    console.log(`[ExtractionProgress] Job ${jobId} completed successfully`);

    // Emit completion
    this.emitToUser(job.userId, 'extraction_complete', {
      jobId: job.id,
      documentName: job.documentName,
      resultDocumentId,
      metadata: job.metadata,
      totalTime: job.completedAt - job.startedAt,
      totalCost: metadata.totalCost || 0
    });

    // Cleanup active tracking
    this.activeJobs.delete(jobId);

    return job;
  }

  /**
   * Fail extraction job
   */
  async failJob(jobId, errorMessage) {
    const job = await ExtractionJob.findByPk(jobId);
    if (!job) {
      console.error(`[ExtractionProgress] Job ${jobId} not found`);
      return null;
    }

    await job.markAsFailed(errorMessage);

    console.error(`[ExtractionProgress] Job ${jobId} failed: ${errorMessage}`);

    // Emit failure
    this.emitToUser(job.userId, 'extraction_failed', {
      jobId: job.id,
      documentName: job.documentName,
      error: errorMessage
    });

    // Cleanup active tracking
    this.activeJobs.delete(jobId);

    return job;
  }

  /**
   * Get active jobs for user
   */
  async getActiveJobs(userId) {
    return await ExtractionJob.getActiveJobsForUser(userId);
  }

  /**
   * Get recent jobs for user
   */
  async getRecentJobs(userId, limit = 20) {
    return await ExtractionJob.getRecentJobsForUser(userId, limit);
  }

  /**
   * Emit event to specific user
   */
  emitToUser(userId, eventName, data) {
    if (!this.io) {
      console.warn('[ExtractionProgress] Socket.IO not initialized, skipping emit');
      return;
    }

    // Emit to user's room (requires user to join room on connection)
    this.io.to(`user:${userId}`).emit(eventName, data);
  }

  /**
   * Emit event to all users in a room
   */
  emitToRoom(roomName, eventName, data) {
    if (!this.io) {
      console.warn('[ExtractionProgress] Socket.IO not initialized, skipping emit');
      return;
    }

    this.io.to(roomName).emit(eventName, data);
  }
}

// Singleton
export const extractionProgressService = new ExtractionProgressService();
export default extractionProgressService;
