import {
  buildTrustFilter,
  formatMemoryForPrompt,
  getTrustLevelLabel,
  getTrustInstructions,
  redactSensitiveFields,
  isTrustSufficient,
  resolveEnforcementMode,
  TRUST_THRESHOLDS,
} from './trust-enforcement.js';
import type { Memory } from '../types/memory.js';

// ─── Test Fixtures ─────────────────────────────────────────────────────────

const mockMemory: Memory = {
  id: 'mem-1',
  user_id: 'user-owner',
  doc_type: 'memory',
  content: 'My private journal entry about my feelings.',
  title: 'Journal Entry: Feb 2026',
  summary: 'Reflections on the month of February.',
  type: 'journal',
  weight: 0.5,
  trust: 0.75,
  location: {
    gps: { latitude: 37.7749, longitude: -122.4194, timestamp: '2026-01-01T00:00:00Z' },
    address: { formatted: '123 Main St, San Francisco, CA' },
    source: 'gps',
    confidence: 0.9,
    is_approximate: false,
  },
  context: {
    timestamp: '2026-02-15T10:00:00Z',
    source: { type: 'manual' },
    participants: [{ user_id: 'user-owner', role: 'user' }],
    environment: { device: 'laptop' },
    notes: 'Written during morning coffee',
  },
  relationships: ['rel-1'],
  access_count: 5,
  last_accessed_at: '2026-02-20T08:00:00Z',
  created_at: '2026-02-15T10:00:00Z',
  updated_at: '2026-02-20T08:00:00Z',
  version: 2,
  tags: ['personal', 'reflection'],
  references: ['https://private-blog.example.com/entry-1'],
  base_weight: 0.5,
};

// Mock Weaviate collection
function createMockCollection() {
  const filterResult = { lessThanOrEqual: jest.fn().mockReturnValue('trust_filter') };
  return {
    filter: {
      byProperty: jest.fn().mockReturnValue(filterResult),
    },
    _filterResult: filterResult,
  };
}

// ─── buildTrustFilter ──────────────────────────────────────────────────────

describe('buildTrustFilter', () => {
  it('creates a filter for trust_score <= accessorTrustLevel', () => {
    const collection = createMockCollection();
    const result = buildTrustFilter(collection, 0.5);
    expect(collection.filter.byProperty).toHaveBeenCalledWith('trust_score');
    expect(collection._filterResult.lessThanOrEqual).toHaveBeenCalledWith(0.5);
    expect(result).toBe('trust_filter');
  });

  it('works with trust level 0', () => {
    const collection = createMockCollection();
    buildTrustFilter(collection, 0);
    expect(collection._filterResult.lessThanOrEqual).toHaveBeenCalledWith(0);
  });

  it('works with trust level 1 (includes trust 1.0 memories for acknowledgment)', () => {
    const collection = createMockCollection();
    buildTrustFilter(collection, 1.0);
    expect(collection._filterResult.lessThanOrEqual).toHaveBeenCalledWith(1.0);
  });
});

// ─── formatMemoryForPrompt ─────────────────────────────────────────────────

describe('formatMemoryForPrompt', () => {
  it('returns full content at trust 1.0', () => {
    const result = formatMemoryForPrompt(mockMemory, 1.0);
    expect(result.trust_tier).toBe('Full Access');
    expect(result.content).toContain(mockMemory.content);
    expect(result.content).toContain(mockMemory.title!);
    expect(result.content).toContain(mockMemory.summary!);
    expect(result.content).toContain('personal, reflection');
    expect(result.content).toContain(mockMemory.created_at);
    expect(result.memory_id).toBe('mem-1');
  });

  it('returns redacted content at trust 0.75', () => {
    const result = formatMemoryForPrompt(mockMemory, 0.75);
    expect(result.trust_tier).toBe('Partial Access');
    expect(result.content).toContain(mockMemory.content);
    expect(result.content).toContain('personal, reflection');
    // Should not contain full summary (only in full access)
    expect(result.content).not.toContain(mockMemory.summary!);
  });

  it('returns summary only at trust 0.5', () => {
    const result = formatMemoryForPrompt(mockMemory, 0.5);
    expect(result.trust_tier).toBe('Summary Only');
    expect(result.content).toContain(mockMemory.title!);
    expect(result.content).toContain(mockMemory.summary!);
    expect(result.content).not.toContain(mockMemory.content);
  });

  it('returns (No summary available) when summary missing at trust 0.5', () => {
    const noSummary = { ...mockMemory, summary: undefined };
    const result = formatMemoryForPrompt(noSummary, 0.5);
    expect(result.content).toContain('(No summary available)');
  });

  it('returns metadata only at trust 0.25', () => {
    const result = formatMemoryForPrompt(mockMemory, 0.25);
    expect(result.trust_tier).toBe('Metadata Only');
    expect(result.content).toContain('[journal]');
    expect(result.content).toContain('personal, reflection');
    expect(result.content).not.toContain(mockMemory.content);
    expect(result.content).not.toContain(mockMemory.summary!);
  });

  it('returns existence only at trust 0', () => {
    const result = formatMemoryForPrompt(mockMemory, 0);
    expect(result.trust_tier).toBe('Existence Only');
    expect(result.content).toBe('A memory exists about this topic.');
    expect(result.content).not.toContain(mockMemory.content);
    expect(result.content).not.toContain(mockMemory.title!);
  });

  it('handles memory without title gracefully', () => {
    const noTitle = { ...mockMemory, title: undefined };
    const result = formatMemoryForPrompt(noTitle, 1.0);
    expect(result.content).toContain('Untitled');
  });

  it('handles memory with empty tags', () => {
    const noTags = { ...mockMemory, tags: [] };
    const result = formatMemoryForPrompt(noTags, 1.0);
    expect(result.content).not.toContain('Tags:');
  });

  describe('trust 1.0 memories (existence-only for cross-users)', () => {
    const trust1Memory = { ...mockMemory, trust: 1.0 };

    it('returns existence-only for cross-user even at accessor trust 1.0', () => {
      const result = formatMemoryForPrompt(trust1Memory, 1.0);
      expect(result.trust_tier).toBe('Existence Only');
      expect(result.content).toBe('A memory exists about this topic.');
    });

    it('returns existence-only for cross-user at any trust level', () => {
      for (const trust of [0, 0.25, 0.5, 0.75, 1.0]) {
        const result = formatMemoryForPrompt(trust1Memory, trust);
        expect(result.trust_tier).toBe('Existence Only');
        expect(result.content).not.toContain(trust1Memory.content);
      }
    });

    it('returns full content for owner (isSelfAccess = true)', () => {
      const result = formatMemoryForPrompt(trust1Memory, 1.0, true);
      expect(result.trust_tier).toBe('Full Access');
      expect(result.content).toContain(trust1Memory.content);
    });

    it('does not leak title, summary, or tags for cross-user', () => {
      const result = formatMemoryForPrompt(trust1Memory, 1.0);
      expect(result.content).not.toContain(trust1Memory.title!);
      expect(result.content).not.toContain(trust1Memory.summary!);
      expect(result.content).not.toContain('personal');
    });
  });
});

// ─── getTrustLevelLabel ────────────────────────────────────────────────────

describe('getTrustLevelLabel', () => {
  it('returns Full Access at 1.0', () => {
    expect(getTrustLevelLabel(1.0)).toBe('Full Access');
  });

  it('returns Partial Access at 0.75', () => {
    expect(getTrustLevelLabel(0.75)).toBe('Partial Access');
  });

  it('returns Summary Only at 0.5', () => {
    expect(getTrustLevelLabel(0.5)).toBe('Summary Only');
  });

  it('returns Metadata Only at 0.25', () => {
    expect(getTrustLevelLabel(0.25)).toBe('Metadata Only');
  });

  it('returns Existence Only at 0', () => {
    expect(getTrustLevelLabel(0)).toBe('Existence Only');
  });

  it('maps intermediate values to nearest lower threshold', () => {
    expect(getTrustLevelLabel(0.9)).toBe('Partial Access');
    expect(getTrustLevelLabel(0.6)).toBe('Summary Only');
    expect(getTrustLevelLabel(0.3)).toBe('Metadata Only');
    expect(getTrustLevelLabel(0.1)).toBe('Existence Only');
  });
});

// ─── getTrustInstructions ──────────────────────────────────────────────────

describe('getTrustInstructions', () => {
  it('returns appropriate instructions for each tier', () => {
    expect(getTrustInstructions(1.0)).toContain('full access');
    expect(getTrustInstructions(0.75)).toContain('partial access');
    expect(getTrustInstructions(0.5)).toContain('summary');
    expect(getTrustInstructions(0.25)).toContain('metadata');
    expect(getTrustInstructions(0)).toContain('acknowledge');
  });
});

// ─── redactSensitiveFields ─────────────────────────────────────────────────

describe('redactSensitiveFields', () => {
  it('clears GPS and address from location', () => {
    const redacted = redactSensitiveFields(mockMemory, 0.75);
    expect(redacted.location.gps).toBeNull();
    expect(redacted.location.address).toBeNull();
    expect(redacted.location.source).toBe('unavailable');
  });

  it('clears context participants and environment', () => {
    const redacted = redactSensitiveFields(mockMemory, 0.75);
    expect(redacted.context.participants).toBeUndefined();
    expect(redacted.context.environment).toBeUndefined();
    expect(redacted.context.notes).toBeUndefined();
  });

  it('clears references', () => {
    const redacted = redactSensitiveFields(mockMemory, 0.75);
    expect(redacted.references).toBeUndefined();
  });

  it('preserves content and tags', () => {
    const redacted = redactSensitiveFields(mockMemory, 0.75);
    expect(redacted.content).toBe(mockMemory.content);
    expect(redacted.tags).toEqual(mockMemory.tags);
    expect(redacted.title).toBe(mockMemory.title);
  });

  it('preserves core context fields', () => {
    const redacted = redactSensitiveFields(mockMemory, 0.75);
    expect(redacted.context.timestamp).toBe(mockMemory.context.timestamp);
    expect(redacted.context.source).toEqual(mockMemory.context.source);
  });

  it('does not mutate original memory', () => {
    const originalLocation = mockMemory.location.gps;
    redactSensitiveFields(mockMemory, 0.75);
    expect(mockMemory.location.gps).toBe(originalLocation);
  });
});

// ─── isTrustSufficient ─────────────────────────────────────────────────────

describe('isTrustSufficient', () => {
  it('returns true when accessor trust >= memory trust', () => {
    expect(isTrustSufficient(0.5, 0.75)).toBe(true);
    expect(isTrustSufficient(0.5, 0.5)).toBe(true);
    expect(isTrustSufficient(0, 0)).toBe(true);
    expect(isTrustSufficient(1.0, 1.0)).toBe(true);
  });

  it('returns false when accessor trust < memory trust', () => {
    expect(isTrustSufficient(0.75, 0.5)).toBe(false);
    expect(isTrustSufficient(1.0, 0.99)).toBe(false);
    expect(isTrustSufficient(0.25, 0)).toBe(false);
  });
});

// ─── resolveEnforcementMode ────────────────────────────────────────────────

describe('resolveEnforcementMode', () => {
  it('returns the provided mode', () => {
    expect(resolveEnforcementMode('query')).toBe('query');
    expect(resolveEnforcementMode('prompt')).toBe('prompt');
    expect(resolveEnforcementMode('hybrid')).toBe('hybrid');
  });

  it('defaults to query when undefined', () => {
    expect(resolveEnforcementMode(undefined)).toBe('query');
  });
});

// ─── TRUST_THRESHOLDS ──────────────────────────────────────────────────────

describe('TRUST_THRESHOLDS', () => {
  it('has correct values', () => {
    expect(TRUST_THRESHOLDS.FULL_ACCESS).toBe(1.0);
    expect(TRUST_THRESHOLDS.PARTIAL_ACCESS).toBe(0.75);
    expect(TRUST_THRESHOLDS.SUMMARY_ONLY).toBe(0.5);
    expect(TRUST_THRESHOLDS.METADATA_ONLY).toBe(0.25);
    expect(TRUST_THRESHOLDS.EXISTENCE_ONLY).toBe(0.0);
  });
});
