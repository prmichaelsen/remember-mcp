import { describe, it, expect } from '@jest/globals';
import {
  BASE,
  getUserPreferencesPath,
  getUserTemplatesPath,
  getUserAccessLogsPath,
  getUserTrustRelationshipsPath,
  getUserPermissionsPath,
  getUserPermissionPath,
  getDefaultTemplatesPath,
  getDefaultTemplatePath,
} from '../../src/firestore/paths.js';

describe('Firestore Path Helpers', () => {
  describe('Environment Prefix', () => {
    it('should have BASE prefix', () => {
      // In test environment, should default to e0.remember-mcp
      expect(BASE).toMatch(/^(e\d+\.)?remember-mcp$/);
    });
  });

  describe('User-Scoped Collections (under users/{user_id}/)', () => {
    it('should generate user preferences path', () => {
      const path = getUserPreferencesPath('user123');
      expect(path).toContain('.users/user123/preferences');
      expect(path).toContain('remember-mcp');
    });

    it('should generate user templates path', () => {
      const path = getUserTemplatesPath('user123');
      expect(path).toContain('.users/user123/templates');
      expect(path).toContain('remember-mcp');
    });

    it('should generate user access logs path', () => {
      const path = getUserAccessLogsPath('user123');
      expect(path).toContain('.users/user123/access-logs');
      expect(path).toContain('remember-mcp');
    });

    it('should generate user trust relationships path', () => {
      const path = getUserTrustRelationshipsPath('user123');
      expect(path).toContain('.users/user123/trust-relationships');
      expect(path).toContain('remember-mcp');
    });
  });

  describe('Cross-User Permissions (outside users/)', () => {
    it('should generate permissions collection path', () => {
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

  describe('Shared/Global Collections', () => {
    it('should generate default templates path', () => {
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
