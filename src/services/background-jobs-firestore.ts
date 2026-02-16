/**
 * Background Jobs Firestore Persistence
 * Stores job status in Firestore for durability across restarts
 */

import { getFirestore } from '../firestore/init.js';
import type { BackgroundJob } from './background-jobs.service.js';
import { logger } from '../utils/logger.js';

const COLLECTION_NAME = 'background_jobs';

/**
 * Save a job to Firestore
 */
export async function saveJobToFirestore(job: BackgroundJob): Promise<void> {
  try {
    const db = getFirestore();
    await db.collection(COLLECTION_NAME).doc(job.id).set(job);
    logger.debug(`[Background Jobs] Saved job to Firestore: ${job.id}`);
  } catch (error) {
    logger.error(`[Background Jobs] Failed to save job to Firestore:`, error);
    throw error;
  }
}

/**
 * Update a job in Firestore
 */
export async function updateJobInFirestore(job: BackgroundJob): Promise<void> {
  try {
    const db = getFirestore();
    await db.collection(COLLECTION_NAME).doc(job.id).update(job as any);
    logger.debug(`[Background Jobs] Updated job in Firestore: ${job.id}`);
  } catch (error) {
    logger.error(`[Background Jobs] Failed to update job in Firestore:`, error);
    throw error;
  }
}

/**
 * Get a job from Firestore
 */
export async function getJobFromFirestore(jobId: string): Promise<BackgroundJob | null> {
  try {
    const db = getFirestore();
    const doc = await db.collection(COLLECTION_NAME).doc(jobId).get();
    
    if (!doc.exists) {
      return null;
    }
    
    return doc.data() as BackgroundJob;
  } catch (error) {
    logger.error(`[Background Jobs] Failed to get job from Firestore:`, error);
    throw error;
  }
}

/**
 * Get jobs by status
 */
export async function getJobsByStatus(status: BackgroundJob['status']): Promise<BackgroundJob[]> {
  try {
    const db = getFirestore();
    const snapshot = await db
      .collection(COLLECTION_NAME)
      .where('status', '==', status)
      .get();
    
    return snapshot.docs.map(doc => doc.data() as BackgroundJob);
  } catch (error) {
    logger.error(`[Background Jobs] Failed to get jobs by status:`, error);
    throw error;
  }
}

/**
 * Clean up old completed/failed jobs
 * Call this periodically to prevent collection from growing indefinitely
 */
export async function cleanupOldJobs(daysToKeep: number = 7): Promise<number> {
  try {
    const db = getFirestore();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysToKeep);
    const cutoffISO = cutoff.toISOString();
    
    const snapshot = await db
      .collection(COLLECTION_NAME)
      .where('completed_at', '<', cutoffISO)
      .get();
    
    if (snapshot.empty) {
      return 0;
    }
    
    // Delete in batch
    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    
    logger.info(`[Background Jobs] Cleaned up ${snapshot.size} old jobs`);
    return snapshot.size;
  } catch (error) {
    logger.error(`[Background Jobs] Failed to cleanup old jobs:`, error);
    throw error;
  }
}

/**
 * Recover stale jobs (jobs that were running when server crashed)
 * Call this on server startup
 */
export async function recoverStaleJobs(): Promise<BackgroundJob[]> {
  try {
    const runningJobs = await getJobsByStatus('running');
    const cutoff = Date.now() - 10 * 60 * 1000; // 10 minutes ago
    const staleJobs: BackgroundJob[] = [];
    
    for (const job of runningJobs) {
      const startedAt = new Date(job.started_at!).getTime();
      
      if (startedAt < cutoff) {
        // Job was running for more than 10 minutes, likely stale
        job.status = 'failed';
        job.error = 'Server restart - job did not complete';
        job.completed_at = new Date().toISOString();
        
        await updateJobInFirestore(job);
        staleJobs.push(job);
      }
    }
    
    if (staleJobs.length > 0) {
      logger.warn(`[Background Jobs] Recovered ${staleJobs.length} stale jobs`);
    }
    
    return staleJobs;
  } catch (error) {
    logger.error(`[Background Jobs] Failed to recover stale jobs:`, error);
    throw error;
  }
}
