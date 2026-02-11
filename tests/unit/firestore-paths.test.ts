import { describe, it, expect } from '@jest/globals';
import {
  getUserPreferencesPath,
  getUserTemplatesPath,
  getUserPermissionsPath,
  getUserPermissionPath,
  getTrustHistoryPath,
  getDefaultTemplatesPath,
  getDefaultTemplatePath,
} from '../../src/firestore/paths.js';

describe('Firestore Path Helpers', () => {
  describe('User Preferences', () => {
    it('should generate user preferences path', () => {
      expect(getUserPreferencesPath('user123')).toBe('user_preferences/user123');
      expect(getUserPreferencesPath('user@test.com')).toBe('user_preferences/user@test.com');
    });
  });

  describe('User Templates', () => {
    it('should generate user templates path', () => {
      expect(getUserTemplatesPath('user123')).toBe('users/user123/templates');
    });
  });

  describe('Permissions', () => {
    it('should generate permissions collection path', () => {
      expect(getUserPermissionsPath('owner123')).toBe('user_permissions/owner123/allowed_accessors');
    });

    it('should generate specific permission path', () => {
      expect(getUserPermissionPath('owner123', 'accessor456')).toBe(
        'user_permissions/owner123/allowed_accessors/accessor456'
      );
    });
  });

  describe('Trust History', () => {
    it('should generate trust history path', () => {
      expect(getTrustHistoryPath('user123')).toBe('trust_history/user123/history');
    });
  });

  describe('Default Templates', () => {
    it('should generate default templates path', () => {
      expect(getDefaultTemplatesPath()).toBe('templates/default');
    });

    it('should generate specific default template path', () => {
      expect(getDefaultTemplatePath('template123')).toBe('templates/default/template123');
    });
  });
});
