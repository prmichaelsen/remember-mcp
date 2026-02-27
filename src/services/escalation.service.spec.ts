import { FirestoreEscalationStore } from './escalation.service.js';
import * as firestoreInit from '../firestore/init';

jest.mock('../firestore/init', () => ({
  getDocument: jest.fn(),
  setDocument: jest.fn(),
  deleteDocument: jest.fn(),
}));

jest.mock('../firestore/paths', () => ({
  BASE: 'test-remember-mcp',
}));

const mockGetDocument = firestoreInit.getDocument as jest.MockedFunction<typeof firestoreInit.getDocument>;
const mockSetDocument = firestoreInit.setDocument as jest.MockedFunction<typeof firestoreInit.setDocument>;
const mockDeleteDocument = (firestoreInit as any).deleteDocument as jest.MockedFunction<any>;

describe('FirestoreEscalationStore', () => {
  let store: FirestoreEscalationStore;

  beforeEach(() => {
    jest.clearAllMocks();
    store = new FirestoreEscalationStore();
  });

  describe('getBlock', () => {
    it('returns null when no document exists', async () => {
      mockGetDocument.mockResolvedValue(null);

      const result = await store.getBlock('owner-1', 'accessor-1', 'mem-1');

      expect(result).toBeNull();
      expect(mockGetDocument).toHaveBeenCalledWith(
        'test-remember-mcp.users/owner-1/ghost_escalation',
        'accessor-1:mem-1'
      );
    });

    it('returns null when document exists but not blocked', async () => {
      mockGetDocument.mockResolvedValue({ attempt_count: 2, blocked: false });

      const result = await store.getBlock('owner-1', 'accessor-1', 'mem-1');

      expect(result).toBeNull();
    });

    it('returns block when document has blocked flag', async () => {
      mockGetDocument.mockResolvedValue({
        blocked: true,
        blocked_at: '2026-02-27T00:00:00.000Z',
        reason: 'Too many attempts',
        attempt_count: 3,
      });

      const result = await store.getBlock('owner-1', 'accessor-1', 'mem-1');

      expect(result).toEqual({
        blocked_at: '2026-02-27T00:00:00.000Z',
        reason: 'Too many attempts',
        attempt_count: 3,
      });
    });

    it('returns null on Firestore error', async () => {
      mockGetDocument.mockRejectedValue(new Error('Firestore unavailable'));

      const result = await store.getBlock('owner-1', 'accessor-1', 'mem-1');

      expect(result).toBeNull();
    });
  });

  describe('setBlock', () => {
    it('writes block to Firestore', async () => {
      mockSetDocument.mockResolvedValue(undefined);

      await store.setBlock('owner-1', 'accessor-1', 'mem-1', {
        blocked_at: '2026-02-27T00:00:00.000Z',
        reason: 'Escalation limit',
        attempt_count: 3,
      });

      expect(mockSetDocument).toHaveBeenCalledWith(
        'test-remember-mcp.users/owner-1/ghost_escalation',
        'accessor-1:mem-1',
        {
          blocked: true,
          blocked_at: '2026-02-27T00:00:00.000Z',
          reason: 'Escalation limit',
          attempt_count: 3,
          accessor_user_id: 'accessor-1',
          memory_id: 'mem-1',
        },
        { merge: true }
      );
    });
  });

  describe('removeBlock', () => {
    it('deletes the escalation document', async () => {
      mockDeleteDocument.mockResolvedValue(undefined);

      await store.removeBlock('owner-1', 'accessor-1', 'mem-1');

      expect(mockDeleteDocument).toHaveBeenCalledWith(
        'test-remember-mcp.users/owner-1/ghost_escalation',
        'accessor-1:mem-1'
      );
    });
  });

  describe('getAttempts', () => {
    it('returns null when no document exists', async () => {
      mockGetDocument.mockResolvedValue(null);

      const result = await store.getAttempts('owner-1', 'accessor-1', 'mem-1');

      expect(result).toBeNull();
    });

    it('returns attempt record when document exists', async () => {
      mockGetDocument.mockResolvedValue({
        attempt_count: 2,
        last_attempt_at: '2026-02-27T01:00:00.000Z',
      });

      const result = await store.getAttempts('owner-1', 'accessor-1', 'mem-1');

      expect(result).toEqual({
        count: 2,
        last_attempt_at: '2026-02-27T01:00:00.000Z',
      });
    });

    it('returns null on Firestore error', async () => {
      mockGetDocument.mockRejectedValue(new Error('Firestore unavailable'));

      const result = await store.getAttempts('owner-1', 'accessor-1', 'mem-1');

      expect(result).toBeNull();
    });
  });

  describe('incrementAttempts', () => {
    it('creates new attempt record when none exists', async () => {
      mockGetDocument.mockResolvedValue(null);
      mockSetDocument.mockResolvedValue(undefined);

      const result = await store.incrementAttempts('owner-1', 'accessor-1', 'mem-1');

      expect(result.count).toBe(1);
      expect(result.last_attempt_at).toBeDefined();
      expect(mockSetDocument).toHaveBeenCalledWith(
        'test-remember-mcp.users/owner-1/ghost_escalation',
        'accessor-1:mem-1',
        expect.objectContaining({
          attempt_count: 1,
          accessor_user_id: 'accessor-1',
          memory_id: 'mem-1',
        }),
        { merge: true }
      );
    });

    it('increments existing attempt count', async () => {
      mockGetDocument.mockResolvedValue({
        attempt_count: 2,
        last_attempt_at: '2026-02-27T00:00:00.000Z',
      });
      mockSetDocument.mockResolvedValue(undefined);

      const result = await store.incrementAttempts('owner-1', 'accessor-1', 'mem-1');

      expect(result.count).toBe(3);
      expect(mockSetDocument).toHaveBeenCalledWith(
        'test-remember-mcp.users/owner-1/ghost_escalation',
        'accessor-1:mem-1',
        expect.objectContaining({ attempt_count: 3 }),
        { merge: true }
      );
    });
  });
});
