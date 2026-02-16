/**
 * Unit tests for Confirmation Token Service
 */

import { ConfirmationTokenService, type ConfirmationRequest } from '../../src/services/confirmation-token.service';
import * as firestoreInit from '../../src/firestore/init';

// Mock Firestore functions
jest.mock('../../src/firestore/init', () => ({
  getDocument: jest.fn(),
  addDocument: jest.fn(),
  updateDocument: jest.fn(),
  queryDocuments: jest.fn(),
}));

describe('ConfirmationTokenService', () => {
  let service: ConfirmationTokenService;
  const mockUserId = 'test-user-123';
  const mockToken = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(() => {
    service = new ConfirmationTokenService();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createRequest', () => {
    it('should create a new confirmation request with token', async () => {
      const mockDocRef = { id: 'request-123', path: 'users/test-user-123/requests/request-123' };
      (firestoreInit.addDocument as jest.Mock).mockResolvedValue(mockDocRef);

      const payload = { memory_id: 'mem-123', additional_tags: [] };
      const result = await service.createRequest(mockUserId, 'publish_memory', payload, 'the_void');

      expect(result.requestId).toBe('request-123');
      expect(result.token).toBeDefined();
      expect(typeof result.token).toBe('string');
      expect(result.token.length).toBeGreaterThan(0);
      expect(firestoreInit.addDocument).toHaveBeenCalledWith(
        'users/test-user-123/requests',
        expect.objectContaining({
          user_id: mockUserId,
          action: 'publish_memory',
          target_collection: 'the_void',
          payload,
          status: 'pending',
        })
      );
    });

    it('should set expiry to 5 minutes from now', async () => {
      const mockDocRef = { id: 'request-123', path: 'path' };
      (firestoreInit.addDocument as jest.Mock).mockResolvedValue(mockDocRef);

      const beforeTime = Date.now();
      await service.createRequest(mockUserId, 'publish_memory', {});
      const afterTime = Date.now();

      const call = (firestoreInit.addDocument as jest.Mock).mock.calls[0][1];
      const expiresAt = new Date(call.expires_at).getTime();
      const createdAt = new Date(call.created_at).getTime();

      // Should be 5 minutes (300000ms) after creation
      const expectedExpiry = createdAt + 5 * 60 * 1000;
      expect(expiresAt).toBe(expectedExpiry);
      expect(createdAt).toBeGreaterThanOrEqual(beforeTime);
      expect(createdAt).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('validateToken', () => {
    it('should return request if token is valid and not expired', async () => {
      const mockRequest: ConfirmationRequest = {
        user_id: mockUserId,
        token: mockToken,
        action: 'publish_memory',
        payload: { memory_id: 'mem-123' },
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 60000).toISOString(), // 1 minute from now
        status: 'pending',
      };

      (firestoreInit.queryDocuments as jest.Mock).mockResolvedValue([
        { id: 'request-123', data: mockRequest }
      ]);

      const result = await service.validateToken(mockUserId, mockToken);

      expect(result).toEqual({
        ...mockRequest,
        request_id: 'request-123',
      });
    });

    it('should return null if token not found', async () => {
      (firestoreInit.queryDocuments as jest.Mock).mockResolvedValue([]);

      const result = await service.validateToken(mockUserId, mockToken);

      expect(result).toBeNull();
    });

    it('should return null and mark expired if token is expired', async () => {
      const mockRequest: ConfirmationRequest = {
        user_id: mockUserId,
        token: mockToken,
        action: 'publish_memory',
        payload: {},
        created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 minutes ago
        expires_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 minutes ago (expired)
        status: 'pending',
      };

      (firestoreInit.queryDocuments as jest.Mock).mockResolvedValue([
        { id: 'request-123', data: mockRequest }
      ]);
      (firestoreInit.updateDocument as jest.Mock).mockResolvedValue(undefined);

      const result = await service.validateToken(mockUserId, mockToken);

      expect(result).toBeNull();
      expect(firestoreInit.updateDocument).toHaveBeenCalledWith(
        'users/test-user-123/requests',
        'request-123',
        { status: 'expired' }
      );
    });
  });

  describe('confirmRequest', () => {
    it('should confirm a valid request', async () => {
      const mockRequest: ConfirmationRequest = {
        user_id: mockUserId,
        token: mockToken,
        action: 'publish_memory',
        payload: { memory_id: 'mem-123' },
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 60000).toISOString(),
        status: 'pending',
      };

      (firestoreInit.queryDocuments as jest.Mock).mockResolvedValue([
        { id: 'request-123', data: mockRequest }
      ]);
      (firestoreInit.updateDocument as jest.Mock).mockResolvedValue(undefined);

      const result = await service.confirmRequest(mockUserId, mockToken);

      expect(result).not.toBeNull();
      expect(result?.status).toBe('confirmed');
      expect(result?.confirmed_at).toBeDefined();
      expect(firestoreInit.updateDocument).toHaveBeenCalledWith(
        'users/test-user-123/requests',
        'request-123',
        expect.objectContaining({
          status: 'confirmed',
          confirmed_at: expect.any(String),
        })
      );
    });

    it('should return null if token is invalid', async () => {
      (firestoreInit.queryDocuments as jest.Mock).mockResolvedValue([]);

      const result = await service.confirmRequest(mockUserId, mockToken);

      expect(result).toBeNull();
      expect(firestoreInit.updateDocument).not.toHaveBeenCalled();
    });
  });

  describe('denyRequest', () => {
    it('should deny a valid request', async () => {
      const mockRequest: ConfirmationRequest = {
        user_id: mockUserId,
        token: mockToken,
        action: 'publish_memory',
        payload: {},
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 60000).toISOString(),
        status: 'pending',
      };

      (firestoreInit.queryDocuments as jest.Mock).mockResolvedValue([
        { id: 'request-123', data: mockRequest }
      ]);
      (firestoreInit.updateDocument as jest.Mock).mockResolvedValue(undefined);

      const result = await service.denyRequest(mockUserId, mockToken);

      expect(result).toBe(true);
      expect(firestoreInit.updateDocument).toHaveBeenCalledWith(
        'users/test-user-123/requests',
        'request-123',
        { status: 'denied' }
      );
    });

    it('should return false if token is invalid', async () => {
      (firestoreInit.queryDocuments as jest.Mock).mockResolvedValue([]);

      const result = await service.denyRequest(mockUserId, mockToken);

      expect(result).toBe(false);
    });
  });

  describe('retractRequest', () => {
    it('should retract a valid request', async () => {
      const mockRequest: ConfirmationRequest = {
        user_id: mockUserId,
        token: mockToken,
        action: 'publish_memory',
        payload: {},
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 60000).toISOString(),
        status: 'pending',
      };

      (firestoreInit.queryDocuments as jest.Mock).mockResolvedValue([
        { id: 'request-123', data: mockRequest }
      ]);
      (firestoreInit.updateDocument as jest.Mock).mockResolvedValue(undefined);

      const result = await service.retractRequest(mockUserId, mockToken);

      expect(result).toBe(true);
      expect(firestoreInit.updateDocument).toHaveBeenCalledWith(
        'users/test-user-123/requests',
        'request-123',
        { status: 'retracted' }
      );
    });

    it('should return false if token is invalid', async () => {
      (firestoreInit.queryDocuments as jest.Mock).mockResolvedValue([]);

      const result = await service.retractRequest(mockUserId, mockToken);

      expect(result).toBe(false);
    });
  });

  describe('cleanupExpired', () => {
    it('should return 0 (not implemented - relies on Firestore TTL)', async () => {
      const result = await service.cleanupExpired();

      expect(result).toBe(0);
    });
  });
});
