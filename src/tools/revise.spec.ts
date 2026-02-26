/**
 * Unit tests for remember_revise tool
 *
 * Tests the pure logic helpers (parseRevisionHistory, buildRevisionHistory)
 * and the tool definition — no Weaviate required.
 */

import { parseRevisionHistory, buildRevisionHistory, reviseTool } from './revise.js';

// ============================================================================
// parseRevisionHistory
// ============================================================================

describe('parseRevisionHistory', () => {
  it('returns empty array for undefined', () => {
    expect(parseRevisionHistory(undefined)).toEqual([]);
  });

  it('returns empty array for null', () => {
    expect(parseRevisionHistory(null)).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    expect(parseRevisionHistory('')).toEqual([]);
  });

  it('returns empty array for non-string value', () => {
    expect(parseRevisionHistory(42)).toEqual([]);
    expect(parseRevisionHistory({})).toEqual([]);
  });

  it('returns empty array for invalid JSON', () => {
    expect(parseRevisionHistory('not json')).toEqual([]);
    expect(parseRevisionHistory('{bad')).toEqual([]);
  });

  it('returns empty array when JSON is not an array', () => {
    expect(parseRevisionHistory(JSON.stringify({ content: 'x' }))).toEqual([]);
    expect(parseRevisionHistory(JSON.stringify('string'))).toEqual([]);
  });

  it('returns empty array when entries lack required fields', () => {
    const bad = JSON.stringify([{ foo: 'bar' }]);
    expect(parseRevisionHistory(bad)).toEqual([]);
  });

  it('filters out entries missing content', () => {
    const mixed = JSON.stringify([
      { content: 'good', revised_at: '2026-02-26T00:00:00Z' },
      { revised_at: '2026-02-26T00:00:00Z' }, // missing content
    ]);
    expect(parseRevisionHistory(mixed)).toEqual([
      { content: 'good', revised_at: '2026-02-26T00:00:00Z' },
    ]);
  });

  it('filters out entries missing revised_at', () => {
    const mixed = JSON.stringify([
      { content: 'good', revised_at: '2026-02-26T00:00:00Z' },
      { content: 'bad' }, // missing revised_at
    ]);
    expect(parseRevisionHistory(mixed)).toEqual([
      { content: 'good', revised_at: '2026-02-26T00:00:00Z' },
    ]);
  });

  it('parses valid revision history correctly', () => {
    const history = [
      { content: 'version 1', revised_at: '2026-02-25T10:00:00Z' },
      { content: 'version 2', revised_at: '2026-02-26T14:30:00Z' },
    ];
    expect(parseRevisionHistory(JSON.stringify(history))).toEqual(history);
  });
});

// ============================================================================
// buildRevisionHistory
// ============================================================================

describe('buildRevisionHistory', () => {
  const ts = '2026-02-26T12:00:00Z';

  it('prepends old content to empty history', () => {
    const result = buildRevisionHistory([], 'old content', ts);
    expect(result).toEqual([{ content: 'old content', revised_at: ts }]);
  });

  it('prepends new entry before existing entries', () => {
    const existing = [{ content: 'version 1', revised_at: '2026-02-25T00:00:00Z' }];
    const result = buildRevisionHistory(existing, 'version 2', ts);
    expect(result[0]).toEqual({ content: 'version 2', revised_at: ts });
    expect(result[1]).toEqual(existing[0]);
    expect(result.length).toBe(2);
  });

  it('trims history to MAX_REVISION_HISTORY (10) entries', () => {
    const existing = Array.from({ length: 10 }, (_, i) => ({
      content: `version ${i}`,
      revised_at: '2026-02-01T00:00:00Z',
    }));
    const result = buildRevisionHistory(existing, 'newest', ts);
    expect(result.length).toBe(10);
    expect(result[0]).toEqual({ content: 'newest', revised_at: ts });
    // The oldest entry (version 9) is dropped
    expect(result[9]).toEqual(existing[8]);
  });

  it('does not exceed 10 entries when history is already at limit', () => {
    const existing = Array.from({ length: 9 }, (_, i) => ({
      content: `v${i}`,
      revised_at: '2026-02-01T00:00:00Z',
    }));
    const result = buildRevisionHistory(existing, 'v9', ts);
    expect(result.length).toBe(10);
  });

  it('preserves full content string including special characters', () => {
    const content = 'Content with "quotes" and\nnewlines';
    const result = buildRevisionHistory([], content, ts);
    expect(result[0].content).toBe(content);
  });
});

// ============================================================================
// Tool definition
// ============================================================================

describe('reviseTool definition', () => {
  it('has correct name', () => {
    expect(reviseTool.name).toBe('remember_revise');
  });

  it('has a description', () => {
    expect(typeof reviseTool.description).toBe('string');
    expect((reviseTool.description ?? '').length).toBeGreaterThan(0);
  });

  it('requires memory_id', () => {
    expect(reviseTool.inputSchema.required).toContain('memory_id');
  });

  it('has memory_id as string type', () => {
    const props = reviseTool.inputSchema.properties as Record<string, any>;
    expect(props.memory_id.type).toBe('string');
  });
});
