import * as admin from 'firebase-admin';
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
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
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
 * Get Firestore instance
 */
export function getFirestore(): admin.firestore.Firestore {
  if (!initialized) {
    initFirestore();
  }
  return admin.firestore();
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
    const db = getFirestore();
    await db.collection('_health_check').doc('test').get();
    
    console.log('[Firestore] Connection successful');
    return true;
  } catch (error) {
    console.error('[Firestore] Connection test failed:', error);
    return false;
  }
}

// Re-export commonly used types
export { FieldValue } from 'firebase-admin/firestore';
export type { Firestore, DocumentData, QueryDocumentSnapshot } from 'firebase-admin/firestore';
