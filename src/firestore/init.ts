/**
 * Firestore initialization and CRUD helpers.
 *
 * Delegates to @prmichaelsen/remember-core/database/firestore, which uses
 * the official firebase-admin SDK. This ensures a single Firebase app instance
 * is shared between remember-mcp and all remember-core services.
 */

import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import {
  initFirestore as coreInitFirestore,
  isFirestoreInitialized as coreIsFirestoreInitialized,
  testFirestoreConnection as coreTestFirestoreConnection,
} from '@prmichaelsen/remember-core/database/firestore';

/**
 * Initialize Firebase Admin SDK using app config.
 *
 * Wraps remember-core's initFirestore so callers don't need to pass config.
 */
export function initFirestore(): void {
  coreInitFirestore(
    {
      serviceAccount: config.firebase.serviceAccount,
      projectId: config.firebase.projectId,
    },
    logger,
  );
}

/**
 * Check if Firestore is initialized
 */
export function isFirestoreInitialized(): boolean {
  return coreIsFirestoreInitialized();
}

/**
 * Test Firestore connection
 */
export async function testFirestoreConnection(): Promise<boolean> {
  return coreTestFirestoreConnection(logger);
}

// Re-export CRUD helpers and types from remember-core
export {
  getDocument,
  setDocument,
  addDocument,
  updateDocument,
  deleteDocument,
  queryDocuments,
  batchWrite,
  FieldValue,
  verifyIdToken,
  type QueryOptions,
} from '@prmichaelsen/remember-core/database/firestore';
