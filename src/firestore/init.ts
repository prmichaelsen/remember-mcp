import { initializeApp } from '@prmichaelsen/firebase-admin-sdk-v8';
import { config } from '../config.js';

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
    console.log('[Firestore] Initialized successfully');
  } catch (error) {
    console.error('[Firestore] Initialization failed:', error);
    console.error('[Firestore] Make sure FIREBASE_ADMIN_SERVICE_ACCOUNT_KEY is valid JSON');
    console.error('[Firestore] Check for proper escaping in .env file');
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
    
    console.log('[Firestore] Connection successful');
    return true;
  } catch (error) {
    console.error('[Firestore] Connection test failed:', error);
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
