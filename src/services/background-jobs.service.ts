/**
 * Background Job Service
 * Handles long-running async operations without blocking tool responses
 */

import { logger } from '../utils/logger.js';
import { 
  saveJobToFirestore, 
  updateJobInFirestore, 
  getJobFromFirestore 
} from './background-jobs-firestore.js';

export interface BackgroundJob {
  id: string;
  type: 'core_memory_rebuild' | 'test_job';
  userId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  created_at: string;
  started_at?: string;
  completed_at?: string;
  error?: string;
}

export type JobHandler = (job: BackgroundJob) => Promise<void>;

class BackgroundJobService {
  private runningJobs = new Map<string, Promise<void>>();
  private jobHandlers = new Map<string, JobHandler>();

  /**
   * Register a job handler
   */
  registerHandler(type: string, handler: JobHandler): void {
    this.jobHandlers.set(type, handler);
    logger.info(`[Background Jobs] Registered handler for: ${type}`);
  }

  /**
   * Schedule a background job (fire and forget)
   */
  async scheduleJob(type: string, userId: string, data?: any): Promise<string> {
    const jobId = `${type}-${userId}-${Date.now()}`;
    
    const job: BackgroundJob = {
      id: jobId,
      type: type as any,
      userId,
      status: 'pending',
      created_at: new Date().toISOString(),
    };
    
    try {
      // Store in Firestore for persistence
      await saveJobToFirestore(job);
      
      logger.info(`[Background Jobs] Scheduled job: ${jobId}`);
      
      // Start processing (don't await - fire and forget)
      this.processJob(job).catch(error => {
        logger.error(`[Background Jobs] Job ${jobId} failed:`, error);
      });
      
      return jobId;
    } catch (error) {
      logger.error(`[Background Jobs] Failed to schedule job:`, error);
      throw error;
    }
  }

  /**
   * Process a job (internal)
   */
  private async processJob(job: BackgroundJob): Promise<void> {
    // Prevent duplicate processing
    if (this.runningJobs.has(job.id)) {
      logger.warn(`[Background Jobs] Job ${job.id} already running`);
      return;
    }
    
    const promise = this.executeJob(job);
    this.runningJobs.set(job.id, promise);
    
    try {
      await promise;
    } finally {
      this.runningJobs.delete(job.id);
    }
  }

  /**
   * Execute a job with timeout and error handling
   */
  private async executeJob(job: BackgroundJob): Promise<void> {
    const timeout = 5 * 60 * 1000; // 5 minutes max
    
    try {
      // Update status to running
      job.status = 'running';
      job.started_at = new Date().toISOString();
      await updateJobInFirestore(job);
      
      logger.info(`[Background Jobs] Starting job: ${job.id}`);
      
      // Get handler
      const handler = this.jobHandlers.get(job.type);
      if (!handler) {
        throw new Error(`No handler registered for job type: ${job.type}`);
      }
      
      // Execute with timeout
      await Promise.race([
        handler(job),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Job timeout after 5 minutes')), timeout)
        )
      ]);
      
      // Mark as completed
      job.status = 'completed';
      job.completed_at = new Date().toISOString();
      await updateJobInFirestore(job);
      
      logger.info(`[Background Jobs] Job completed: ${job.id}`);
    } catch (error) {
      // Mark as failed
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : String(error);
      job.completed_at = new Date().toISOString();
      await updateJobInFirestore(job);
      
      logger.error(`[Background Jobs] Job failed: ${job.id}`, error);
      throw error;
    }
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<BackgroundJob | null> {
    return await getJobFromFirestore(jobId);
  }

  /**
   * Get count of running jobs
   */
  getRunningJobCount(): number {
    return this.runningJobs.size;
  }

  /**
   * Wait for all running jobs to complete (for graceful shutdown)
   */
  async waitForJobs(timeoutMs: number = 30000): Promise<void> {
    if (this.runningJobs.size === 0) {
      return;
    }
    
    logger.info(`[Background Jobs] Waiting for ${this.runningJobs.size} jobs to complete...`);
    
    await Promise.race([
      Promise.all(this.runningJobs.values()),
      new Promise(resolve => setTimeout(resolve, timeoutMs))
    ]);
    
    if (this.runningJobs.size > 0) {
      logger.warn(`[Background Jobs] ${this.runningJobs.size} jobs still running after timeout`);
    } else {
      logger.info(`[Background Jobs] All jobs completed`);
    }
  }
}

// Export singleton instance
export const backgroundJobs = new BackgroundJobService();

// Register graceful shutdown handler
process.on('SIGTERM', async () => {
  logger.info('[Background Jobs] SIGTERM received, waiting for jobs...');
  await backgroundJobs.waitForJobs(30000);
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('[Background Jobs] SIGINT received, waiting for jobs...');
  await backgroundJobs.waitForJobs(30000);
  process.exit(0);
});
