import { ghostConfigTool, handleGhostConfig } from './ghost-config.js';
import * as ghostConfigService from '../services/ghost-config.service';
import { DEFAULT_GHOST_CONFIG } from '../types/ghost-config.js';

jest.mock('../services/ghost-config.service', () => ({
  getGhostConfig: jest.fn(),
  setGhostConfigFields: jest.fn(),
  setUserTrust: jest.fn(),
  removeUserTrust: jest.fn(),
  blockUser: jest.fn(),
  unblockUser: jest.fn(),
  validateGhostConfigUpdate: jest.fn(),
}));

const mockGetGhostConfig = ghostConfigService.getGhostConfig as jest.MockedFunction<typeof ghostConfigService.getGhostConfig>;
const mockSetGhostConfigFields = ghostConfigService.setGhostConfigFields as jest.MockedFunction<typeof ghostConfigService.setGhostConfigFields>;
const mockSetUserTrust = ghostConfigService.setUserTrust as jest.MockedFunction<typeof ghostConfigService.setUserTrust>;
const mockRemoveUserTrust = ghostConfigService.removeUserTrust as jest.MockedFunction<typeof ghostConfigService.removeUserTrust>;
const mockBlockUser = ghostConfigService.blockUser as jest.MockedFunction<typeof ghostConfigService.blockUser>;
const mockUnblockUser = ghostConfigService.unblockUser as jest.MockedFunction<typeof ghostConfigService.unblockUser>;
const mockValidate = ghostConfigService.validateGhostConfigUpdate as jest.MockedFunction<typeof ghostConfigService.validateGhostConfigUpdate>;

describe('remember_ghost_config', () => {
  const userId = 'test-user-1';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('tool definition', () => {
    it('has correct name', () => {
      expect(ghostConfigTool.name).toBe('remember_ghost_config');
    });

    it('requires action parameter', () => {
      expect(ghostConfigTool.inputSchema.required).toContain('action');
    });

    it('has all action options', () => {
      const actionProp = (ghostConfigTool.inputSchema.properties as any).action;
      expect(actionProp.enum).toEqual(['get', 'set', 'set_trust', 'remove_trust', 'block', 'unblock']);
    });
  });

  describe('get action', () => {
    it('returns current ghost config', async () => {
      mockGetGhostConfig.mockResolvedValue({ ...DEFAULT_GHOST_CONFIG });

      const result = await handleGhostConfig({ action: 'get' }, userId);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.config).toEqual(DEFAULT_GHOST_CONFIG);
      expect(parsed.trust_tier_guide).toBeDefined();
    });
  });

  describe('set action', () => {
    it('updates ghost config', async () => {
      const updated = { ...DEFAULT_GHOST_CONFIG, enabled: true };
      mockSetGhostConfigFields.mockResolvedValue(updated);

      const result = await handleGhostConfig({ action: 'set', enabled: true }, userId);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.updated_fields).toContain('enabled');
      expect(mockValidate).toHaveBeenCalled();
      expect(mockSetGhostConfigFields).toHaveBeenCalledWith(userId, { enabled: true });
    });

    it('throws when no fields provided', async () => {
      await expect(handleGhostConfig({ action: 'set' }, userId))
        .rejects.toThrow('No fields to update');
    });

    it('updates multiple fields', async () => {
      const updated = { ...DEFAULT_GHOST_CONFIG, enabled: true, default_friend_trust: 0.5 };
      mockSetGhostConfigFields.mockResolvedValue(updated);

      const result = await handleGhostConfig({
        action: 'set',
        enabled: true,
        default_friend_trust: 0.5,
      }, userId);
      const parsed = JSON.parse(result);

      expect(parsed.updated_fields).toHaveLength(2);
    });
  });

  describe('set_trust action', () => {
    it('sets per-user trust', async () => {
      mockSetUserTrust.mockResolvedValue(undefined);

      const result = await handleGhostConfig({
        action: 'set_trust',
        target_user_id: 'friend-1',
        trust_level: 0.75,
      }, userId);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.trust_level).toBe(0.75);
      expect(mockSetUserTrust).toHaveBeenCalledWith(userId, 'friend-1', 0.75);
    });

    it('throws without target_user_id', async () => {
      await expect(handleGhostConfig({ action: 'set_trust', trust_level: 0.5 }, userId))
        .rejects.toThrow('target_user_id is required');
    });

    it('throws without trust_level', async () => {
      await expect(handleGhostConfig({ action: 'set_trust', target_user_id: 'friend-1' }, userId))
        .rejects.toThrow('trust_level is required');
    });
  });

  describe('remove_trust action', () => {
    it('removes per-user trust override', async () => {
      mockRemoveUserTrust.mockResolvedValue(undefined);

      const result = await handleGhostConfig({
        action: 'remove_trust',
        target_user_id: 'friend-1',
      }, userId);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(mockRemoveUserTrust).toHaveBeenCalledWith(userId, 'friend-1');
    });

    it('throws without target_user_id', async () => {
      await expect(handleGhostConfig({ action: 'remove_trust' }, userId))
        .rejects.toThrow('target_user_id is required');
    });
  });

  describe('block action', () => {
    it('blocks a user', async () => {
      mockBlockUser.mockResolvedValue(undefined);

      const result = await handleGhostConfig({
        action: 'block',
        target_user_id: 'bad-user',
      }, userId);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(mockBlockUser).toHaveBeenCalledWith(userId, 'bad-user');
    });

    it('throws without target_user_id', async () => {
      await expect(handleGhostConfig({ action: 'block' }, userId))
        .rejects.toThrow('target_user_id is required');
    });
  });

  describe('unblock action', () => {
    it('unblocks a user', async () => {
      mockUnblockUser.mockResolvedValue(undefined);

      const result = await handleGhostConfig({
        action: 'unblock',
        target_user_id: 'bad-user',
      }, userId);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(mockUnblockUser).toHaveBeenCalledWith(userId, 'bad-user');
    });
  });

  describe('invalid action', () => {
    it('throws on unknown action', async () => {
      await expect(handleGhostConfig({ action: 'invalid' as any }, userId))
        .rejects.toThrow('Unknown action');
    });
  });
});
