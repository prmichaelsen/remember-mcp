import {
  checkMemoryAccess,
  handleInsufficientTrust,
  isMemoryBlocked,
  resetBlock,
  resolveAccessorTrustLevel,
  formatAccessResultMessage,
  StubGhostConfigProvider,
  InMemoryEscalationStore,
} from './access-control.js';
import type { Memory } from '../types/memory.js';
import type { AccessResult } from '../types/access-result.js';
import type { GhostConfig } from '../types/ghost-config.js';
import { DEFAULT_GHOST_CONFIG } from '../types/ghost-config.js';

// ─── Fixtures ──────────────────────────────────────────────────────────────

function createMemory(overrides: Partial<Memory> = {}): Memory {
  return {
    id: 'mem-1',
    user_id: 'owner',
    doc_type: 'memory',
    content: 'Test content',
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
    ...overrides,
  } as Memory;
}

function createEnabledGhostConfig(overrides: Partial<GhostConfig> = {}): GhostConfig {
  return {
    ...DEFAULT_GHOST_CONFIG,
    enabled: true,
    public_ghost_enabled: true,
    default_public_trust: 0.75,
    ...overrides,
  };
}

// ─── checkMemoryAccess ─────────────────────────────────────────────────────

describe('checkMemoryAccess', () => {
  let configProvider: StubGhostConfigProvider;
  let escalationStore: InMemoryEscalationStore;

  beforeEach(() => {
    configProvider = new StubGhostConfigProvider();
    escalationStore = new InMemoryEscalationStore();
  });

  it('grants access to owner (self-access)', async () => {
    const memory = createMemory({ user_id: 'alice', trust: 1.0 });
    const result = await checkMemoryAccess('alice', memory, configProvider, escalationStore);
    expect(result.status).toBe('granted');
    if (result.status === 'granted') {
      expect(result.access_level).toBe('owner');
      expect(result.memory.id).toBe('mem-1');
    }
  });

  it('self-access works even with high trust memory', async () => {
    const memory = createMemory({ user_id: 'alice', trust: 1.0 });
    const result = await checkMemoryAccess('alice', memory, configProvider, escalationStore);
    expect(result.status).toBe('granted');
  });

  it('returns no_permission when ghost not enabled', async () => {
    const memory = createMemory({ user_id: 'owner' });
    // No ghost config set — returns null
    const result = await checkMemoryAccess('accessor', memory, configProvider, escalationStore);
    expect(result.status).toBe('no_permission');
    if (result.status === 'no_permission') {
      expect(result.owner_user_id).toBe('owner');
      expect(result.accessor_user_id).toBe('accessor');
    }
  });

  it('returns no_permission when ghost explicitly disabled', async () => {
    configProvider.setGhostConfig('owner', { ...DEFAULT_GHOST_CONFIG, enabled: false });
    const memory = createMemory({ user_id: 'owner' });
    const result = await checkMemoryAccess('accessor', memory, configProvider, escalationStore);
    expect(result.status).toBe('no_permission');
  });

  it('returns no_permission when accessor is in blocked_users', async () => {
    configProvider.setGhostConfig('owner', createEnabledGhostConfig({ blocked_users: ['bad-actor'] }));
    const memory = createMemory({ user_id: 'owner', trust: 0.25 });
    const result = await checkMemoryAccess('bad-actor', memory, configProvider, escalationStore);
    expect(result.status).toBe('no_permission');
  });

  it('grants trust 1.0 memories when accessor trust is 1.0 (existence-only handled by formatting)', async () => {
    configProvider.setGhostConfig('owner', createEnabledGhostConfig({
      per_user_trust: { 'trusted-accessor': 1.0 },
    }));
    const memory = createMemory({ user_id: 'owner', trust: 1.0 });
    const result = await checkMemoryAccess('trusted-accessor', memory, configProvider, escalationStore);
    expect(result.status).toBe('granted');
    if (result.status === 'granted') {
      expect(result.access_level).toBe('trusted');
    }
  });

  it('trust 1.0 memories trigger insufficient_trust when accessor trust < 1.0', async () => {
    configProvider.setGhostConfig('owner', createEnabledGhostConfig({ default_public_trust: 0.5 }));
    const memory = createMemory({ user_id: 'owner', trust: 1.0 });
    const result = await checkMemoryAccess('accessor', memory, configProvider, escalationStore);
    expect(result.status).toBe('insufficient_trust');
  });

  it('grants access when trust is sufficient', async () => {
    configProvider.setGhostConfig('owner', createEnabledGhostConfig({ default_public_trust: 0.75 }));
    const memory = createMemory({ user_id: 'owner', trust: 0.5 });
    const result = await checkMemoryAccess('accessor', memory, configProvider, escalationStore);
    expect(result.status).toBe('granted');
    if (result.status === 'granted') {
      expect(result.access_level).toBe('trusted');
    }
  });

  it('returns insufficient_trust when trust is too low', async () => {
    configProvider.setGhostConfig('owner', createEnabledGhostConfig({ default_public_trust: 0.25 }));
    const memory = createMemory({ user_id: 'owner', trust: 0.75 });
    const result = await checkMemoryAccess('accessor', memory, configProvider, escalationStore);
    expect(result.status).toBe('insufficient_trust');
    if (result.status === 'insufficient_trust') {
      expect(result.required_trust).toBe(0.75);
      expect(result.actual_trust).toBe(0.15); // 0.25 - 0.1 penalty
      expect(result.attempts_remaining).toBe(2);
    }
  });

  it('blocks after 3 failed attempts', async () => {
    configProvider.setGhostConfig('owner', createEnabledGhostConfig({ default_public_trust: 0.1 }));
    const memory = createMemory({ user_id: 'owner', trust: 0.75 });

    // Attempt 1
    const r1 = await checkMemoryAccess('accessor', memory, configProvider, escalationStore);
    expect(r1.status).toBe('insufficient_trust');
    if (r1.status === 'insufficient_trust') expect(r1.attempts_remaining).toBe(2);

    // Attempt 2
    const r2 = await checkMemoryAccess('accessor', memory, configProvider, escalationStore);
    expect(r2.status).toBe('insufficient_trust');
    if (r2.status === 'insufficient_trust') expect(r2.attempts_remaining).toBe(1);

    // Attempt 3 — should block
    const r3 = await checkMemoryAccess('accessor', memory, configProvider, escalationStore);
    expect(r3.status).toBe('blocked');
    if (r3.status === 'blocked') {
      expect(r3.reason).toContain('3 unauthorized attempts');
    }
  });

  it('returns blocked on subsequent accesses after block', async () => {
    configProvider.setGhostConfig('owner', createEnabledGhostConfig({ default_public_trust: 0.1 }));
    const memory = createMemory({ user_id: 'owner', trust: 0.75 });

    // Trigger block
    for (let i = 0; i < 3; i++) {
      await checkMemoryAccess('accessor', memory, configProvider, escalationStore);
    }

    // 4th attempt — already blocked
    const result = await checkMemoryAccess('accessor', memory, configProvider, escalationStore);
    expect(result.status).toBe('blocked');
  });

  it('uses per_user_trust override', async () => {
    configProvider.setGhostConfig('owner', createEnabledGhostConfig({
      default_public_trust: 0.1,
      per_user_trust: { 'trusted-friend': 0.9 },
    }));
    const memory = createMemory({ user_id: 'owner', trust: 0.75 });
    const result = await checkMemoryAccess('trusted-friend', memory, configProvider, escalationStore);
    expect(result.status).toBe('granted');
    if (result.status === 'granted') expect(result.access_level).toBe('trusted');
  });

  it('block is memory-specific — other memories still accessible', async () => {
    configProvider.setGhostConfig('owner', createEnabledGhostConfig({ default_public_trust: 0.1 }));
    const memHigh = createMemory({ id: 'mem-high', user_id: 'owner', trust: 0.75 });
    const memLow = createMemory({ id: 'mem-low', user_id: 'owner', trust: 0.05 });

    // Block on high-trust memory
    for (let i = 0; i < 3; i++) {
      await checkMemoryAccess('accessor', memHigh, configProvider, escalationStore);
    }
    expect((await checkMemoryAccess('accessor', memHigh, configProvider, escalationStore)).status).toBe('blocked');

    // Low-trust memory still accessible
    const lowResult = await checkMemoryAccess('accessor', memLow, configProvider, escalationStore);
    expect(lowResult.status).toBe('granted');
  });
});

// ─── resolveAccessorTrustLevel ─────────────────────────────────────────────

describe('resolveAccessorTrustLevel', () => {
  it('returns per_user_trust when set', async () => {
    const config = createEnabledGhostConfig({ per_user_trust: { 'alice': 0.9 } });
    expect(await resolveAccessorTrustLevel(config, 'owner', 'alice')).toBe(0.9);
  });

  it('falls through to default_public_trust when no per_user_trust', async () => {
    const config = createEnabledGhostConfig({ default_public_trust: 0.3 });
    expect(await resolveAccessorTrustLevel(config, 'owner', 'stranger')).toBe(0.3);
  });

  it('returns 0 when default_public_trust not set', async () => {
    const config = createEnabledGhostConfig({ default_public_trust: 0 });
    expect(await resolveAccessorTrustLevel(config, 'owner', 'unknown')).toBe(0);
  });

  it('per_user_trust takes priority over default', async () => {
    const config = createEnabledGhostConfig({
      default_public_trust: 0.1,
      per_user_trust: { 'bob': 0.8 },
    });
    expect(await resolveAccessorTrustLevel(config, 'owner', 'bob')).toBe(0.8);
    expect(await resolveAccessorTrustLevel(config, 'owner', 'carol')).toBe(0.1);
  });

  it('per_user_trust of 0 is used (not falsy fallthrough)', async () => {
    const config = createEnabledGhostConfig({
      default_public_trust: 0.5,
      per_user_trust: { 'restricted': 0 },
    });
    expect(await resolveAccessorTrustLevel(config, 'owner', 'restricted')).toBe(0);
  });
});

// ─── isMemoryBlocked / resetBlock ──────────────────────────────────────────

describe('isMemoryBlocked', () => {
  it('returns false when no block exists', async () => {
    const store = new InMemoryEscalationStore();
    expect(await isMemoryBlocked('owner', 'accessor', 'mem-1', store)).toBe(false);
  });

  it('returns true when block exists', async () => {
    const store = new InMemoryEscalationStore();
    await store.setBlock('owner', 'accessor', 'mem-1', {
      blocked_at: '2026-01-01T00:00:00Z',
      reason: 'test block',
      attempt_count: 3,
    });
    expect(await isMemoryBlocked('owner', 'accessor', 'mem-1', store)).toBe(true);
  });
});

describe('resetBlock', () => {
  it('removes an existing block', async () => {
    const store = new InMemoryEscalationStore();
    await store.setBlock('owner', 'accessor', 'mem-1', {
      blocked_at: '2026-01-01T00:00:00Z',
      reason: 'test block',
      attempt_count: 3,
    });
    expect(await isMemoryBlocked('owner', 'accessor', 'mem-1', store)).toBe(true);

    await resetBlock('owner', 'accessor', 'mem-1', store);
    expect(await isMemoryBlocked('owner', 'accessor', 'mem-1', store)).toBe(false);
  });

  it('is safe to call when no block exists', async () => {
    const store = new InMemoryEscalationStore();
    await expect(resetBlock('owner', 'accessor', 'mem-1', store)).resolves.toBeUndefined();
  });
});

// ─── formatAccessResultMessage ─────────────────────────────────────────────

describe('formatAccessResultMessage', () => {
  const memory = createMemory();

  it('formats granted (owner)', () => {
    const result: AccessResult = { status: 'granted', memory, access_level: 'owner' };
    expect(formatAccessResultMessage(result)).toBe('Access granted (owner).');
  });

  it('formats granted (trusted)', () => {
    const result: AccessResult = { status: 'granted', memory, access_level: 'trusted' };
    expect(formatAccessResultMessage(result)).toBe('Access granted (trusted).');
  });

  it('formats insufficient_trust', () => {
    const result: AccessResult = {
      status: 'insufficient_trust',
      memory_id: 'mem-1',
      required_trust: 0.75,
      actual_trust: 0.15,
      attempts_remaining: 2,
    };
    const msg = formatAccessResultMessage(result);
    expect(msg).toContain('0.75');
    expect(msg).toContain('0.15');
    expect(msg).toContain('2 attempt(s) remaining');
  });

  it('formats blocked', () => {
    const result: AccessResult = {
      status: 'blocked',
      memory_id: 'mem-1',
      reason: 'Too many attempts',
      blocked_at: '2026-01-01T00:00:00Z',
    };
    expect(formatAccessResultMessage(result)).toContain('Too many attempts');
  });

  it('formats no_permission', () => {
    const result: AccessResult = {
      status: 'no_permission',
      owner_user_id: 'owner',
      accessor_user_id: 'accessor',
    };
    expect(formatAccessResultMessage(result)).toContain('No permission');
  });

  it('formats not_found', () => {
    const result: AccessResult = { status: 'not_found', memory_id: 'mem-404' };
    expect(formatAccessResultMessage(result)).toContain('mem-404');
    expect(formatAccessResultMessage(result)).toContain('not found');
  });

  it('formats deleted', () => {
    const result: AccessResult = {
      status: 'deleted',
      memory_id: 'mem-del',
      deleted_at: '2026-01-10T00:00:00Z',
    };
    expect(formatAccessResultMessage(result)).toContain('mem-del');
    expect(formatAccessResultMessage(result)).toContain('deleted');
  });
});

// ─── handleInsufficientTrust ───────────────────────────────────────────────

describe('handleInsufficientTrust', () => {
  it('applies -0.1 trust penalty', async () => {
    const store = new InMemoryEscalationStore();
    const result = await handleInsufficientTrust('owner', 'accessor', 'mem-1', 0.75, 0.25, store);
    expect(result.status).toBe('insufficient_trust');
    if (result.status === 'insufficient_trust') {
      expect(result.actual_trust).toBe(0.15); // 0.25 - 0.1
    }
  });

  it('does not let actual_trust go below 0', async () => {
    const store = new InMemoryEscalationStore();
    const result = await handleInsufficientTrust('owner', 'accessor', 'mem-1', 0.75, 0.05, store);
    if (result.status === 'insufficient_trust') {
      expect(result.actual_trust).toBe(0); // max(0, 0.05 - 0.1)
    }
  });

  it('blocks after 3 attempts', async () => {
    const store = new InMemoryEscalationStore();
    await handleInsufficientTrust('owner', 'accessor', 'mem-1', 0.75, 0.25, store);
    await handleInsufficientTrust('owner', 'accessor', 'mem-1', 0.75, 0.25, store);
    const result = await handleInsufficientTrust('owner', 'accessor', 'mem-1', 0.75, 0.25, store);
    expect(result.status).toBe('blocked');
  });

  it('tracks attempts_remaining correctly', async () => {
    const store = new InMemoryEscalationStore();
    const r1 = await handleInsufficientTrust('owner', 'accessor', 'mem-1', 0.75, 0.25, store);
    if (r1.status === 'insufficient_trust') expect(r1.attempts_remaining).toBe(2);

    const r2 = await handleInsufficientTrust('owner', 'accessor', 'mem-1', 0.75, 0.25, store);
    if (r2.status === 'insufficient_trust') expect(r2.attempts_remaining).toBe(1);
  });
});
