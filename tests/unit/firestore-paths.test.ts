import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  BASE,
  getUserPreferencesPath,
  getUserTemplatesPath,
  getUserPermissionsPath,
  getUserPermissionPath,
  getTrustHistoryPath,
  getDefaultTemplatesPath,
  getDefaultTemplatePath,
} from '../../src/firestore/paths.js';

describe('Firestore Path Helpers', () => {
  describe('Environment Prefix', () => {
    it('should have BASE prefix', () => {
      // In test environment (NODE_ENV=test), should default to e0.remember-mcp
      expect(BASE).toMatch(/^(e\d+\.)?remember-mcp$/);
    });
  });

  describe('User Preferences', () => {
    it('should generate user preferences path with BASE prefix', () => {
      const path = getUserPreferencesPath('user123');
      expect(path).toContain('.user-preferences/user123');
      expect(path).toContain('remember-mcp');
    });
  });

  describe('User Templates', () => {
    it('should generate user templates path with BASE prefix', () => {
      const path = getUserTemplatesPath('user123');
      expect(path).toContain('.users/user123/templates');
      expect(path).toContain('remember-mcp');
    });
  });

  describe('Permissions', () => {
    it('should generate permissions collection path with BASE prefix', () => {
      const path = getUserPermissionsPath('owner123');
      expect(path).toContain('.user-permissions/owner123/allowed-accessors');
      expect(path).toContain('remember-mcp');
    });

    it('should generate specific permission path', () => {
      const path = getUserPermissionPath('owner123', 'accessor456');
      expect(path).toContain('.user-permissions/owner123/allowed-accessors/accessor456');
      expect(path).toContain('remember-mcp');
    });
  });

  describe('Trust History', () => {
    it('should generate trust history path with BASE prefix', () => {
      const path = getTrustHistoryPath('user123');
      expect(path).toContain('.trust-history/user123/history');
      expect(path).toContain('remember-mcp');
    });
  });

  describe('Default Templates', () => {
    it('should generate default templates path with BASE prefix', () => {
      const path = getDefaultTemplatesPath();
      expect(path).toContain('.templates/default');
      expect(path).toContain('remember-mcp');
    });

    it('should generate specific default template path', () => {
      const path = getDefaultTemplatePath('template123');
      expect(path).toContain('.templates/default/template123');
      expect(path).toContain('remember-mcp');
    });
  });
});
