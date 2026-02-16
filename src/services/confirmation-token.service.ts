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
import { logger } from '../utils/logger.js';

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
    try {
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
      logger.info('Creating confirmation request', {
        service: 'ConfirmationTokenService',
        userId,
        action,
        targetCollection,
        collectionPath,
        payloadKeys: Object.keys(payload),
      });
      
      logger.debug('Calling Firestore addDocument', {
        service: 'ConfirmationTokenService',
        collectionPath,
      });
      const docRef = await addDocument(collectionPath, request);
      logger.debug('Firestore addDocument returned', {
        service: 'ConfirmationTokenService',
        hasDocRef: !!docRef,
        hasId: !!docRef?.id,
        docRefId: docRef?.id,
      });
      
      // Validate docRef
      if (!docRef) {
        const error = new Error('Firestore addDocument returned null/undefined');
        logger.error('CRITICAL: addDocument returned null', {
          service: 'ConfirmationTokenService',
          userId,
          collectionPath,
        });
        throw error;
      }
      
      if (!docRef.id) {
        const error = new Error('Firestore addDocument returned docRef without ID');
        logger.error('CRITICAL: docRef has no ID', {
          service: 'ConfirmationTokenService',
          userId,
          collectionPath,
          docRef,
        });
        throw error;
      }
      
      logger.info('Confirmation request created successfully', {
        service: 'ConfirmationTokenService',
        requestId: docRef.id,
        token,
        expiresAt: request.expires_at,
      });

      return { requestId: docRef.id, token };
    } catch (error) {
      logger.error('Failed to create confirmation request', {
        service: 'ConfirmationTokenService',
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId,
        action,
        collectionPath: `users/${userId}/requests`,
      });
      
      // Re-throw so caller (tool handler) can catch and return error response
      throw error;
    }
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
    
    logger.debug('Validating confirmation token', {
      service: 'ConfirmationTokenService',
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
    
    logger.debug('Token query results', {
      service: 'ConfirmationTokenService',
      resultsFound: results.length,
      hasResults: results.length > 0,
    });

    if (results.length === 0) {
      logger.info('Token not found or not pending', {
        service: 'ConfirmationTokenService',
        userId,
      });
      return null;
    }

    const doc = results[0];
    const request = doc.data as ConfirmationRequest;
    
    logger.info('Confirmation request found', {
      service: 'ConfirmationTokenService',
      requestId: doc.id,
      action: request.action,
      status: request.status,
      expiresAt: request.expires_at,
    });

    // Check expiry
    const expiresAt = new Date(request.expires_at);
    if (expiresAt.getTime() < Date.now()) {
      logger.info('Token expired', {
        service: 'ConfirmationTokenService',
        requestId: doc.id,
        expiresAt: request.expires_at,
      });
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
    logger.warn('cleanupExpired not implemented - relying on Firestore TTL', {
      service: 'ConfirmationTokenService',
      note: 'Configure Firestore TTL policy on requests collection group',
    });
    return 0;
  }
}

/**
 * Singleton instance of the confirmation token service
 */
export const confirmationTokenService = new ConfirmationTokenService();
