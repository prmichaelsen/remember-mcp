/**
 * Tests for admin user inspection tools.
 */

const mockPreferencesGet = jest.fn();
const mockGetGhostConfig = jest.fn();
const mockQueryDocuments = jest.fn();

jest.mock('../core-services.js', () => ({
  createCoreServices: () => ({
    preferences: { getPreferences: mockPreferencesGet },
  }),
}));

jest.mock('../services/ghost-config.service.js', () => ({
  getGhostConfig: mockGetGhostConfig,
}));

jest.mock('../firestore/init.js', () => ({
  queryDocuments: mockQueryDocuments,
}));

import {
  handleAdminInspectUserPreferences,
  handleAdminInspectUserGhostConfigs,
  handleAdminInspectUserEscalationRecords,
  handleAdminInspectUserApiTokens,
} from './admin-inspect-user.js';

describe('admin user inspection tools', () => {
  const originalEnv = process.env.ADMIN_USER_IDS;

  beforeEach(() => {
    process.env.ADMIN_USER_IDS = 'admin_user';
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.ADMIN_USER_IDS = originalEnv;
    } else {
      delete process.env.ADMIN_USER_IDS;
    }
  });

  describe('remember_admin_inspect_user_preferences', () => {
    it('returns preferences for admin user', async () => {
      mockPreferencesGet.mockResolvedValue({ templates: { auto_suggest: true } });
      const result = await handleAdminInspectUserPreferences({ user_id: 'target' }, 'admin_user');
      const parsed = JSON.parse(result);
      expect(parsed.user_id).toBe('target');
      expect(parsed.preferences.templates.auto_suggest).toBe(true);
    });

    it('returns permission error for non-admin', async () => {
      const result = await handleAdminInspectUserPreferences({ user_id: 'target' }, 'regular_user');
      const parsed = JSON.parse(result);
      expect(parsed.isError).toBe(true);
    });
  });

  describe('remember_admin_inspect_user_ghost_configs', () => {
    it('returns ghost config for admin user', async () => {
      mockGetGhostConfig.mockResolvedValue({ enabled: true, trust_mode: 'query' });
      const result = await handleAdminInspectUserGhostConfigs({ user_id: 'target' }, 'admin_user');
      const parsed = JSON.parse(result);
      expect(parsed.user_id).toBe('target');
      expect(parsed.ghost_config.enabled).toBe(true);
    });

    it('returns permission error for non-admin', async () => {
      const result = await handleAdminInspectUserGhostConfigs({ user_id: 'target' }, 'regular_user');
      const parsed = JSON.parse(result);
      expect(parsed.isError).toBe(true);
    });
  });

  describe('remember_admin_inspect_user_escalation_records', () => {
    it('returns escalation records for admin user', async () => {
      mockQueryDocuments.mockResolvedValue([
        { id: 'esc-1', data: { accessor_id: 'user2', attempts: 3 } },
      ]);
      const result = await handleAdminInspectUserEscalationRecords({ user_id: 'target' }, 'admin_user');
      const parsed = JSON.parse(result);
      expect(parsed.user_id).toBe('target');
      expect(parsed.escalation_records).toHaveLength(1);
      expect(parsed.escalation_records[0].accessor_id).toBe('user2');
    });

    it('returns empty array for user with no records', async () => {
      mockQueryDocuments.mockResolvedValue([]);
      const result = await handleAdminInspectUserEscalationRecords({ user_id: 'target' }, 'admin_user');
      const parsed = JSON.parse(result);
      expect(parsed.escalation_records).toEqual([]);
    });

    it('returns permission error for non-admin', async () => {
      const result = await handleAdminInspectUserEscalationRecords({ user_id: 'target' }, 'regular_user');
      const parsed = JSON.parse(result);
      expect(parsed.isError).toBe(true);
    });
  });

  describe('remember_admin_inspect_user_api_tokens', () => {
    it('returns token metadata without hashes', async () => {
      mockQueryDocuments.mockResolvedValue([
        { id: 'tok-1', data: { name: 'MacBook', token_hash: 'secret_hash', created_at: '2026-01-01' } },
      ]);
      const result = await handleAdminInspectUserApiTokens({ user_id: 'target' }, 'admin_user');
      const parsed = JSON.parse(result);
      expect(parsed.user_id).toBe('target');
      expect(parsed.api_tokens).toHaveLength(1);
      expect(parsed.api_tokens[0].name).toBe('MacBook');
      expect(parsed.api_tokens[0].token_hash).toBeUndefined();
    });

    it('returns empty array for user with no tokens', async () => {
      mockQueryDocuments.mockResolvedValue([]);
      const result = await handleAdminInspectUserApiTokens({ user_id: 'target' }, 'admin_user');
      const parsed = JSON.parse(result);
      expect(parsed.api_tokens).toEqual([]);
    });

    it('returns permission error for non-admin', async () => {
      const result = await handleAdminInspectUserApiTokens({ user_id: 'target' }, 'regular_user');
      const parsed = JSON.parse(result);
      expect(parsed.isError).toBe(true);
    });
  });
});
