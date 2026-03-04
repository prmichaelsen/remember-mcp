import {
  getGhostConfig,
  setGhostConfigFields,
  setUserTrust,
  removeUserTrust,
  blockUser,
  unblockUser,
  isGhostEnabled,
  validateGhostConfigUpdate,
  FirestoreGhostConfigProvider,
} from './ghost-config.service.js';
import { DEFAULT_GHOST_CONFIG } from '../types/ghost-config.js';
import * as firestoreInit from '../firestore/init';

jest.mock('../firestore/init', () => ({
  getDocument: jest.fn(),
  setDocument: jest.fn(),
  FieldValue: {
    arrayUnion: (...elements: any[]) => ({ _type: 'arrayUnion', _value: elements }),
    arrayRemove: (...elements: any[]) => ({ _type: 'arrayRemove', _value: elements }),
  },
}));

jest.mock('../firestore/paths', () => ({
  BASE: 'test-remember-mcp',
}));

const mockGetDocument = firestoreInit.getDocument as jest.MockedFunction<typeof firestoreInit.getDocument>;
const mockSetDocument = firestoreInit.setDocument as jest.MockedFunction<typeof firestoreInit.setDocument>;

describe('GhostConfigService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getGhostConfig', () => {
    it('returns defaults when no Firestore doc exists', async () => {
      mockGetDocument.mockResolvedValue(null);

      const config = await getGhostConfig('user-1');

      expect(config).toEqual(DEFAULT_GHOST_CONFIG);
      expect(config.enabled).toBe(false);
      expect(config.default_friend_trust).toBe(0.25);
      expect(config.enforcement_mode).toBe('query');
    });

    it('merges stored config with defaults', async () => {
      mockGetDocument.mockResolvedValue({
        enabled: true,
        default_friend_trust: 0.5,
      });

      const config = await getGhostConfig('user-1');

      expect(config.enabled).toBe(true);
      expect(config.default_friend_trust).toBe(0.5);
      expect(config.default_public_trust).toBe(0); // default preserved
      expect(config.enforcement_mode).toBe('query'); // default preserved
    });

    it('uses correct Firestore path', async () => {
      mockGetDocument.mockResolvedValue(null);

      await getGhostConfig('user-abc');

      expect(mockGetDocument).toHaveBeenCalledWith(
        'test-remember-mcp.users/user-abc/ghost_config',
        'settings'
      );
    });

    it('returns defaults on Firestore error', async () => {
      mockGetDocument.mockRejectedValue(new Error('Firestore unavailable'));

      const config = await getGhostConfig('user-1');

      expect(config).toEqual(DEFAULT_GHOST_CONFIG);
    });
  });

  describe('setGhostConfigFields', () => {
    it('writes to correct Firestore path with merge', async () => {
      mockSetDocument.mockResolvedValue(undefined);
      mockGetDocument.mockResolvedValue({ enabled: true });

      await setGhostConfigFields('user-1', { enabled: true });

      expect(mockSetDocument).toHaveBeenCalledWith(
        'test-remember-mcp.users/user-1/ghost_config',
        'settings',
        { enabled: true },
        { merge: true }
      );
    });

    it('returns updated config after set', async () => {
      mockSetDocument.mockResolvedValue(undefined);
      mockGetDocument.mockResolvedValue({ enabled: true, default_friend_trust: 0.75 });

      const result = await setGhostConfigFields('user-1', {
        enabled: true,
        default_friend_trust: 0.75,
      });

      expect(result.enabled).toBe(true);
      expect(result.default_friend_trust).toBe(0.75);
    });
  });

  describe('setUserTrust', () => {
    it('sets per-user trust level', async () => {
      mockGetDocument.mockResolvedValue({ per_user_trust: {} });
      mockSetDocument.mockResolvedValue(undefined);

      await setUserTrust('owner-1', 'friend-1', 0.75);

      expect(mockSetDocument).toHaveBeenCalledWith(
        'test-remember-mcp.users/owner-1/ghost_config',
        'settings',
        { per_user_trust: { 'friend-1': 0.75 } },
        { merge: true }
      );
    });

    it('preserves existing per-user trust entries', async () => {
      mockGetDocument.mockResolvedValue({
        per_user_trust: { 'existing-user': 0.5 },
      });
      mockSetDocument.mockResolvedValue(undefined);

      await setUserTrust('owner-1', 'new-user', 0.25);

      expect(mockSetDocument).toHaveBeenCalledWith(
        'test-remember-mcp.users/owner-1/ghost_config',
        'settings',
        { per_user_trust: { 'existing-user': 0.5, 'new-user': 0.25 } },
        { merge: true }
      );
    });

    it('throws on invalid trust level (negative)', async () => {
      await expect(setUserTrust('owner-1', 'user-1', -0.1))
        .rejects.toThrow('Trust level must be between 0 and 1');
    });

    it('throws on invalid trust level (above 1)', async () => {
      await expect(setUserTrust('owner-1', 'user-1', 1.5))
        .rejects.toThrow('Trust level must be between 0 and 1');
    });
  });

  describe('removeUserTrust', () => {
    it('removes a per-user trust override', async () => {
      mockGetDocument.mockResolvedValue({
        per_user_trust: { 'user-1': 0.5, 'user-2': 0.75 },
      });
      mockSetDocument.mockResolvedValue(undefined);

      await removeUserTrust('owner-1', 'user-1');

      expect(mockSetDocument).toHaveBeenCalledWith(
        'test-remember-mcp.users/owner-1/ghost_config',
        'settings',
        { per_user_trust: { 'user-2': 0.75 } },
        { merge: true }
      );
    });

    it('handles removing non-existent trust override gracefully', async () => {
      mockGetDocument.mockResolvedValue({ per_user_trust: {} });
      mockSetDocument.mockResolvedValue(undefined);

      await removeUserTrust('owner-1', 'nonexistent');

      expect(mockSetDocument).toHaveBeenCalledWith(
        'test-remember-mcp.users/owner-1/ghost_config',
        'settings',
        { per_user_trust: {} },
        { merge: true }
      );
    });
  });

  describe('blockUser', () => {
    it('adds user to blocked list using FieldValue.arrayUnion', async () => {
      mockSetDocument.mockResolvedValue(undefined);

      await blockUser('owner-1', 'bad-user');

      expect(mockSetDocument).toHaveBeenCalledWith(
        'test-remember-mcp.users/owner-1/ghost_config',
        'settings',
        { blocked_users: { _type: 'arrayUnion', _value: ['bad-user'] } },
        { merge: true }
      );
      // No read needed — arrayUnion is idempotent
      expect(mockGetDocument).not.toHaveBeenCalled();
    });

    it('does not duplicate already blocked user (arrayUnion is idempotent)', async () => {
      mockSetDocument.mockResolvedValue(undefined);

      await blockUser('owner-1', 'bad-user');

      // arrayUnion handles dedup atomically — always writes
      expect(mockSetDocument).toHaveBeenCalledTimes(1);
    });

    it('preserves existing blocked users (arrayUnion appends atomically)', async () => {
      mockSetDocument.mockResolvedValue(undefined);

      await blockUser('owner-1', 'user-b');

      expect(mockSetDocument).toHaveBeenCalledWith(
        'test-remember-mcp.users/owner-1/ghost_config',
        'settings',
        { blocked_users: { _type: 'arrayUnion', _value: ['user-b'] } },
        { merge: true }
      );
    });
  });

  describe('unblockUser', () => {
    it('removes user from blocked list using FieldValue.arrayRemove', async () => {
      mockSetDocument.mockResolvedValue(undefined);

      await unblockUser('owner-1', 'bad-user');

      expect(mockSetDocument).toHaveBeenCalledWith(
        'test-remember-mcp.users/owner-1/ghost_config',
        'settings',
        { blocked_users: { _type: 'arrayRemove', _value: ['bad-user'] } },
        { merge: true }
      );
      // No read needed — arrayRemove is safe if element not present
      expect(mockGetDocument).not.toHaveBeenCalled();
    });

    it('is safe when user not blocked (arrayRemove is idempotent)', async () => {
      mockSetDocument.mockResolvedValue(undefined);

      await unblockUser('owner-1', 'not-blocked');

      // arrayRemove always writes — safe no-op if element not present
      expect(mockSetDocument).toHaveBeenCalledTimes(1);
    });
  });

  describe('isGhostEnabled', () => {
    it('returns false when ghost not configured', async () => {
      mockGetDocument.mockResolvedValue(null);

      const result = await isGhostEnabled('user-1');

      expect(result).toBe(false);
    });

    it('returns true when ghost enabled', async () => {
      mockGetDocument.mockResolvedValue({ enabled: true });

      const result = await isGhostEnabled('user-1');

      expect(result).toBe(true);
    });
  });

  describe('validateGhostConfigUpdate', () => {
    it('accepts valid config', () => {
      expect(() => validateGhostConfigUpdate({
        enabled: true,
        default_friend_trust: 0.5,
        default_public_trust: 0.1,
        enforcement_mode: 'hybrid',
      })).not.toThrow();
    });

    it('accepts empty config', () => {
      expect(() => validateGhostConfigUpdate({})).not.toThrow();
    });

    it('rejects negative default_friend_trust', () => {
      expect(() => validateGhostConfigUpdate({ default_friend_trust: -0.1 }))
        .toThrow('default_friend_trust must be between 0 and 1');
    });

    it('rejects default_friend_trust > 1', () => {
      expect(() => validateGhostConfigUpdate({ default_friend_trust: 1.5 }))
        .toThrow('default_friend_trust must be between 0 and 1');
    });

    it('rejects negative default_public_trust', () => {
      expect(() => validateGhostConfigUpdate({ default_public_trust: -0.5 }))
        .toThrow('default_public_trust must be between 0 and 1');
    });

    it('rejects invalid enforcement_mode', () => {
      expect(() => validateGhostConfigUpdate({ enforcement_mode: 'invalid' as any }))
        .toThrow('enforcement_mode must be one of');
    });

    it('rejects invalid per_user_trust values', () => {
      expect(() => validateGhostConfigUpdate({
        per_user_trust: { 'user-1': 1.5 },
      })).toThrow('Trust level for user-1 must be between 0 and 1');
    });

    it('accepts boundary values 0 and 1', () => {
      expect(() => validateGhostConfigUpdate({
        default_friend_trust: 0,
        default_public_trust: 1,
        per_user_trust: { 'user-1': 0, 'user-2': 1 },
      })).not.toThrow();
    });
  });

  describe('FirestoreGhostConfigProvider', () => {
    it('returns null when ghost is not enabled', async () => {
      mockGetDocument.mockResolvedValue(null); // defaults → enabled: false

      const provider = new FirestoreGhostConfigProvider();
      const result = await provider.getGhostConfig('user-1');

      expect(result).toBeNull();
    });

    it('returns config when ghost is enabled', async () => {
      mockGetDocument.mockResolvedValue({
        enabled: true,
        default_friend_trust: 0.5,
      });

      const provider = new FirestoreGhostConfigProvider();
      const result = await provider.getGhostConfig('user-1');

      expect(result).not.toBeNull();
      expect(result!.enabled).toBe(true);
      expect(result!.default_friend_trust).toBe(0.5);
    });

    it('implements GhostConfigProvider interface', () => {
      const provider = new FirestoreGhostConfigProvider();
      expect(typeof provider.getGhostConfig).toBe('function');
    });
  });
});
