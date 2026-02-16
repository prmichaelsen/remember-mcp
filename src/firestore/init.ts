import { initializeApp } from '@prmichaelsen/firebase-admin-sdk-v8';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

let initialized = false;

/**
 * Initialize Firebase Admin SDK
 *
 * FIREBASE_ADMIN_SERVICE_ACCOUNT_KEY should be a JSON string containing the service account.
 * Make sure it's properly escaped in your .env file.
 */
export function initFirestore(): void {
  if (initialized) {
    return;
  }

  try {
    const serviceAccount = JSON.parse(config.firebase.serviceAccount);
    
    initializeApp({
      serviceAccount,
      projectId: config.firebase.projectId,
    });

    initialized = true;
    logger.info('Firestore initialized successfully', {
      module: 'firestore-init',
    });
  } catch (error) {
    logger.error('Firestore initialization failed', {
      module: 'firestore-init',
      error: error instanceof Error ? error.message : String(error),
    });
    logger.error('Make sure FIREBASE_ADMIN_SERVICE_ACCOUNT_KEY is valid JSON', {
      module: 'firestore-init',
    });
    logger.error('Check for proper escaping in .env file', {
      module: 'firestore-init',
    });
    throw error;
  }
}

/**
 * Check if Firestore is initialized
 */
export function isFirestoreInitialized(): boolean {
  return initialized;
}

/**
 * Test Firestore connection
 */
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    if (!initialized) {
      throw new Error('Firestore not initialized');
    }

    // Try a simple operation to test connection
    const { getDocument } = await import('@prmichaelsen/firebase-admin-sdk-v8');
    await getDocument('_health_check', 'test');
    
    logger.info('Firestore connection test successful', {
      module: 'firestore-init',
    });
    return true;
  } catch (error) {
    logger.error('Firestore connection test failed', {
      module: 'firestore-init',
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

// Re-export firebase-admin-sdk-v8 functions for convenience
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
} from '@prmichaelsen/firebase-admin-sdk-v8';
