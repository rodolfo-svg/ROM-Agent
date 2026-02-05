/**
 * ════════════════════════════════════════════════════════════════
 * ROM AGENT - EXTRACTION JOBS ROUTES
 * ════════════════════════════════════════════════════════════════
 * REST API for managing V2 extraction/analysis jobs
 * - GET /api/extraction-jobs - List user jobs
 * - GET /api/extraction-jobs/active - Get active jobs
 * - GET /api/extraction-jobs/:id - Get job details
 * - DELETE /api/extraction-jobs/:id - Delete job
 * - POST /api/extraction-jobs/:id/cancel - Cancel job
 * ════════════════════════════════════════════════════════════════
 */

import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import ExtractionJob from '../models/ExtractionJob.js';
import logger from '../../lib/logger.js';

const router = express.Router();

/**
 * GET /api/extraction-jobs
 * List extraction jobs for current user
 */
router.get('/extraction-jobs', requireAuth, async (req, res) => {
  try {
    const { status, limit = 50 } = req.query;

    const whereClause = {
      userId: req.session.user.id
    };

    if (status) {
      whereClause.status = status;
    }

    const jobs = await ExtractionJob.findAll({
      where: whereClause,
      order: [['created_at', 'DESC']],
      limit: Math.min(parseInt(limit), 1000) // Cap at 1000
    });

    logger.debug('Listed extraction jobs', {
      userId: req.session.user.id,
      status: status || 'all',
      count: jobs.length
    });

    res.json({
      success: true,
      jobs,
      total: jobs.length
    });

  } catch (error) {
    logger.error('[ExtractionJobs] Error listing jobs', {
      error: error.message,
      userId: req.session.user.id
    });

    res.status(500).json({
      success: false,
      error: 'Failed to list extraction jobs'
    });
  }
});

/**
 * GET /api/extraction-jobs/active
 * Get active (pending/processing) jobs for current user
 */
router.get('/extraction-jobs/active', requireAuth, async (req, res) => {
  try {
    const jobs = await ExtractionJob.getActiveJobsForUser(req.session.user.id);

    logger.debug('Retrieved active extraction jobs', {
      userId: req.session.user.id,
      count: jobs.length
    });

    res.json({
      success: true,
      jobs,
      total: jobs.length
    });

  } catch (error) {
    logger.error('[ExtractionJobs] Error getting active jobs', {
      error: error.message,
      userId: req.session.user.id
    });

    res.status(500).json({
      success: false,
      error: 'Failed to get active jobs'
    });
  }
});

/**
 * GET /api/extraction-jobs/:id
 * Get specific extraction job details
 */
router.get('/extraction-jobs/:id', requireAuth, async (req, res) => {
  try {
    const job = await ExtractionJob.findOne({
      where: {
        id: req.params.id,
        userId: req.session.user.id
      }
    });

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Extraction job not found'
      });
    }

    logger.debug('Retrieved extraction job', {
      jobId: req.params.id,
      userId: req.session.user.id
    });

    res.json({
      success: true,
      job
    });

  } catch (error) {
    logger.error('[ExtractionJobs] Error getting job', {
      error: error.message,
      jobId: req.params.id,
      userId: req.session.user.id
    });

    res.status(500).json({
      success: false,
      error: 'Failed to get extraction job'
    });
  }
});

/**
 * DELETE /api/extraction-jobs/:id
 * Delete extraction job (only if completed/failed/cancelled)
 */
router.delete('/extraction-jobs/:id', requireAuth, async (req, res) => {
  try {
    const job = await ExtractionJob.findOne({
      where: {
        id: req.params.id,
        userId: req.session.user.id
      }
    });

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Extraction job not found'
      });
    }

    // Don't allow deletion of active jobs
    if (job.status === 'pending' || job.status === 'processing') {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete active job. Wait for completion or cancel first.'
      });
    }

    await job.destroy();

    logger.info('Deleted extraction job', {
      jobId: req.params.id,
      userId: req.session.user.id,
      status: job.status
    });

    res.json({
      success: true,
      message: 'Extraction job deleted successfully'
    });

  } catch (error) {
    logger.error('[ExtractionJobs] Error deleting job', {
      error: error.message,
      jobId: req.params.id,
      userId: req.session.user.id
    });

    res.status(500).json({
      success: false,
      error: 'Failed to delete extraction job'
    });
  }
});

/**
 * POST /api/extraction-jobs/:id/cancel
 * Cancel active extraction job
 */
router.post('/extraction-jobs/:id/cancel', requireAuth, async (req, res) => {
  try {
    const job = await ExtractionJob.findOne({
      where: {
        id: req.params.id,
        userId: req.session.user.id
      }
    });

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Extraction job not found'
      });
    }

    if (job.status !== 'pending' && job.status !== 'processing') {
      return res.status(400).json({
        success: false,
        error: 'Job is not active, cannot cancel'
      });
    }

    job.status = 'cancelled';
    job.cancelledAt = new Date();
    await job.save();

    logger.info('Cancelled extraction job', {
      jobId: req.params.id,
      userId: req.session.user.id
    });

    res.json({
      success: true,
      message: 'Extraction job cancelled',
      job
    });

  } catch (error) {
    logger.error('[ExtractionJobs] Error cancelling job', {
      error: error.message,
      jobId: req.params.id,
      userId: req.session.user.id
    });

    res.status(500).json({
      success: false,
      error: 'Failed to cancel extraction job'
    });
  }
});

export default router;
