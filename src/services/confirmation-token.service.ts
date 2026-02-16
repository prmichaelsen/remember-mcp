/**
 * Confirmation Token Service
 * 
 * Manages confirmation tokens for sensitive operations like publishing memories.
 * Tokens are one-time use with 5-minute expiry.
 */

import { randomUUID } from 'crypto';
import { 
  getDocument, 
  addDocument, 
  updateDocument,
  queryDocuments,
  type QueryOptions 
} from '../firestore/init.js';

/**
 * Confirmation request stored in Firestore
 */
export interface ConfirmationRequest {
  user_id: string;
  token: string;
  action: string;
  target_collection?: string;
  payload: any;
  created_at: string;  // ISO 8601 timestamp
  expires_at: string;  // ISO 8601 timestamp
  status: 'pending' | 'confirmed' | 'denied' | 'expired' | 'retracted';
  confirmed_at?: string;  // ISO 8601 timestamp
}

/**
 * Service for managing confirmation tokens
 */
export class ConfirmationTokenService {
  private readonly EXPIRY_MINUTES = 5;

  /**
   * Create a new confirmation request
   * 
   * @param userId - User ID who initiated the request
   * @param action - Action type (e.g., 'publish_memory')
   * @param payload - Data to store with the request
   * @param targetCollection - Optional target collection (e.g., 'the_void')
   * @returns Request ID and token
   */
  async createRequest(
    userId: string,
    action: string,
    payload: any,
    targetCollection?: string
  ): Promise<{ requestId: string; token: string }> {
    const token = randomUUID();

    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.EXPIRY_MINUTES * 60 * 1000);

    const request: ConfirmationRequest = {
      user_id: userId,
      token,
      action,
      target_collection: targetCollection,
      payload,
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      status: 'pending',
    };

    // Add document to Firestore (auto-generates ID)
    const collectionPath = `users/${userId}/requests`;
    console.log('[ConfirmationTokenService] Creating request:', {
      userId,
      action,
      targetCollection,
      collectionPath,
    });
    
    const docRef = await addDocument(collectionPath, request);
    
    console.log('[ConfirmationTokenService] Request created:', {
      requestId: docRef.id,
      token,
      expiresAt: request.expires_at,
    });

    return { requestId: docRef.id, token };
  }

  /**
   * Validate and retrieve a confirmation request
   * 
   * @param userId - User ID
   * @param token - Confirmation token
   * @returns Request with request_id if valid, null otherwise
   */
  async validateToken(
    userId: string,
    token: string
  ): Promise<(ConfirmationRequest & { request_id: string }) | null> {
    const collectionPath = `users/${userId}/requests`;
    
    console.log('[ConfirmationTokenService] Validating token:', {
      userId,
      token,
      collectionPath,
    });

    // Query for the token
    const queryOptions: QueryOptions = {
      where: [
        { field: 'token', op: '==', value: token },
        { field: 'status', op: '==', value: 'pending' },
      ],
      limit: 1,
    };

    const results = await queryDocuments(collectionPath, queryOptions);
    
    console.log('[ConfirmationTokenService] Query results:', {
      resultsFound: results.length,
      hasResults: results.length > 0,
    });

    if (results.length === 0) {
      console.log('[ConfirmationTokenService] Token not found or not pending');
      return null;
    }

    const doc = results[0];
    const request = doc.data as ConfirmationRequest;
    
    console.log('[ConfirmationTokenService] Request found:', {
      requestId: doc.id,
      action: request.action,
      status: request.status,
      expiresAt: request.expires_at,
    });

    // Check expiry
    const expiresAt = new Date(request.expires_at);
    if (expiresAt.getTime() < Date.now()) {
      console.log('[ConfirmationTokenService] Token expired');
      await this.updateStatus(userId, doc.id, 'expired');
      return null;
    }

    return {
      ...request,
      request_id: doc.id,
    };
  }

  /**
   * Confirm a request
   * 
   * @param userId - User ID
   * @param token - Confirmation token
   * @returns Confirmed request if valid, null otherwise
   */
  async confirmRequest(
    userId: string,
    token: string
  ): Promise<(ConfirmationRequest & { request_id: string }) | null> {
    const request = await this.validateToken(userId, token);
    if (!request) {
      return null;
    }

    await this.updateStatus(userId, request.request_id, 'confirmed');
    
    return {
      ...request,
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
    };
  }

  /**
   * Deny a request
   * 
   * @param userId - User ID
   * @param token - Confirmation token
   * @returns True if denied successfully, false otherwise
   */
  async denyRequest(
    userId: string,
    token: string
  ): Promise<boolean> {
    const request = await this.validateToken(userId, token);
    if (!request) {
      return false;
    }

    await this.updateStatus(userId, request.request_id, 'denied');
    return true;
  }

  /**
   * Retract a request
   * 
   * @param userId - User ID
   * @param token - Confirmation token
   * @returns True if retracted successfully, false otherwise
   */
  async retractRequest(
    userId: string,
    token: string
  ): Promise<boolean> {
    const request = await this.validateToken(userId, token);
    if (!request) {
      return false;
    }

    await this.updateStatus(userId, request.request_id, 'retracted');
    return true;
  }

  /**
   * Update request status
   * 
   * @param userId - User ID
   * @param requestId - Request document ID
   * @param status - New status
   */
  private async updateStatus(
    userId: string,
    requestId: string,
    status: ConfirmationRequest['status']
  ): Promise<void> {
    const collectionPath = `users/${userId}/requests`;

    const updateData: Partial<ConfirmationRequest> = {
      status,
    };

    if (status === 'confirmed') {
      updateData.confirmed_at = new Date().toISOString();
    }

    await updateDocument(collectionPath, requestId, updateData);
  }

  /**
   * Clean up expired requests (optional - Firestore TTL handles deletion)
   * 
   * Note: Configure Firestore TTL policy on 'requests' collection group
   * with 'expires_at' field for automatic deletion within 24 hours.
   * 
   * This method is optional for immediate cleanup if needed.
   * 
   * @returns Count of deleted requests
   */
  async cleanupExpired(): Promise<number> {
    // Note: firebase-admin-sdk-v8 doesn't support collectionGroup queries
    // This would need to be implemented differently or rely on Firestore TTL
    // For now, return 0 and rely on Firestore TTL policy
    console.warn('[ConfirmationTokenService] cleanupExpired not implemented - rely on Firestore TTL');
    return 0;
  }
}

/**
 * Singleton instance of the confirmation token service
 */
export const confirmationTokenService = new ConfirmationTokenService();
