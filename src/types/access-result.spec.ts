import type {
  AccessResult,
  AccessGranted,
  AccessInsufficientTrust,
  AccessBlocked,
  AccessNoPermission,
  AccessNotFound,
  AccessDeleted,
  AccessResultStatus,
} from './access-result.js';
import type { Memory } from './memory.js';
import { DEFAULT_GHOST_CONFIG, type GhostConfig, type TrustEnforcementMode } from './ghost-config.js';

// Minimal Memory fixture for testing type narrowing
const mockMemory: Memory = {
  id: 'mem-1',
  user_id: 'user-owner',
  doc_type: 'memory',
  content: 'Test memory',
  type: 'note',
  weight: 0.5,
  trust: 0.5,
  location: { gps: null, address: null, source: 'unavailable', confidence: 0, is_approximate: true },
  context: { timestamp: '2026-01-01T00:00:00Z', source: { type: 'manual' } },
  relationships: [],
  access_count: 0,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  version: 1,
  tags: [],
  base_weight: 0.5,
} as Memory;

describe('AccessResult type narrowing', () => {
  it('narrows to AccessGranted', () => {
    const result: AccessResult = {
      status: 'granted',
      memory: mockMemory,
      access_level: 'owner',
    };
    if (result.status === 'granted') {
      expect(result.memory.id).toBe('mem-1');
      expect(result.access_level).toBe('owner');
    }
  });

  it('narrows to AccessGranted with trusted level', () => {
    const result: AccessResult = {
      status: 'granted',
      memory: mockMemory,
      access_level: 'trusted',
    };
    if (result.status === 'granted') {
      expect(result.access_level).toBe('trusted');
    }
  });

  it('narrows to AccessInsufficientTrust', () => {
    const result: AccessResult = {
      status: 'insufficient_trust',
      memory_id: 'mem-1',
      required_trust: 0.75,
      actual_trust: 0.25,
      attempts_remaining: 2,
    };
    if (result.status === 'insufficient_trust') {
      expect(result.required_trust).toBe(0.75);
      expect(result.actual_trust).toBe(0.25);
      expect(result.attempts_remaining).toBe(2);
    }
  });

  it('narrows to AccessBlocked', () => {
    const result: AccessResult = {
      status: 'blocked',
      memory_id: 'mem-1',
      reason: 'Repeated unauthorized attempts',
      blocked_at: '2026-01-15T10:00:00Z',
    };
    if (result.status === 'blocked') {
      expect(result.reason).toBe('Repeated unauthorized attempts');
      expect(result.blocked_at).toBe('2026-01-15T10:00:00Z');
    }
  });

  it('narrows to AccessNoPermission', () => {
    const result: AccessResult = {
      status: 'no_permission',
      owner_user_id: 'user-owner',
      accessor_user_id: 'user-accessor',
    };
    if (result.status === 'no_permission') {
      expect(result.owner_user_id).toBe('user-owner');
      expect(result.accessor_user_id).toBe('user-accessor');
    }
  });

  it('narrows to AccessNotFound', () => {
    const result: AccessResult = {
      status: 'not_found',
      memory_id: 'mem-missing',
    };
    if (result.status === 'not_found') {
      expect(result.memory_id).toBe('mem-missing');
    }
  });

  it('narrows to AccessDeleted', () => {
    const result: AccessResult = {
      status: 'deleted',
      memory_id: 'mem-deleted',
      deleted_at: '2026-01-10T08:00:00Z',
    };
    if (result.status === 'deleted') {
      expect(result.memory_id).toBe('mem-deleted');
      expect(result.deleted_at).toBe('2026-01-10T08:00:00Z');
    }
  });

  it('switch statement covers all variants exhaustively', () => {
    const results: AccessResult[] = [
      { status: 'granted', memory: mockMemory, access_level: 'owner' },
      { status: 'insufficient_trust', memory_id: 'mem-1', required_trust: 0.5, actual_trust: 0.1, attempts_remaining: 1 },
      { status: 'blocked', memory_id: 'mem-1', reason: 'blocked', blocked_at: '2026-01-01T00:00:00Z' },
      { status: 'no_permission', owner_user_id: 'owner', accessor_user_id: 'accessor' },
      { status: 'not_found', memory_id: 'mem-1' },
      { status: 'deleted', memory_id: 'mem-1', deleted_at: '2026-01-01T00:00:00Z' },
    ];

    const statuses: AccessResultStatus[] = [];
    for (const result of results) {
      switch (result.status) {
        case 'granted':
          statuses.push(result.status);
          break;
        case 'insufficient_trust':
          statuses.push(result.status);
          break;
        case 'blocked':
          statuses.push(result.status);
          break;
        case 'no_permission':
          statuses.push(result.status);
          break;
        case 'not_found':
          statuses.push(result.status);
          break;
        case 'deleted':
          statuses.push(result.status);
          break;
      }
    }

    expect(statuses).toEqual([
      'granted',
      'insufficient_trust',
      'blocked',
      'no_permission',
      'not_found',
      'deleted',
    ]);
  });
});

describe('GhostConfig defaults', () => {
  it('has correct default values', () => {
    expect(DEFAULT_GHOST_CONFIG.enabled).toBe(false);
    expect(DEFAULT_GHOST_CONFIG.public_ghost_enabled).toBe(false);
    expect(DEFAULT_GHOST_CONFIG.default_friend_trust).toBe(0.25);
    expect(DEFAULT_GHOST_CONFIG.default_public_trust).toBe(0);
    expect(DEFAULT_GHOST_CONFIG.per_user_trust).toEqual({});
    expect(DEFAULT_GHOST_CONFIG.blocked_users).toEqual([]);
    expect(DEFAULT_GHOST_CONFIG.enforcement_mode).toBe('query');
  });

  it('GhostConfig accepts valid per_user_trust overrides', () => {
    const config: GhostConfig = {
      ...DEFAULT_GHOST_CONFIG,
      enabled: true,
      per_user_trust: { 'user-friend': 0.75, 'user-close': 1.0 },
    };
    expect(config.per_user_trust['user-friend']).toBe(0.75);
    expect(config.per_user_trust['user-close']).toBe(1.0);
  });

  it('GhostConfig accepts all enforcement modes', () => {
    const modes: TrustEnforcementMode[] = ['query', 'prompt', 'hybrid'];
    for (const mode of modes) {
      const config: GhostConfig = { ...DEFAULT_GHOST_CONFIG, enforcement_mode: mode };
      expect(config.enforcement_mode).toBe(mode);
    }
  });
});
