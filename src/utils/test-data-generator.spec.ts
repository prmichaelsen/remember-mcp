/**
 * Unit tests for test-data-generator utilities
 *
 * Tests cover:
 * - generateMemory: correct shape, determinism, field ranges
 * - generateMemories: count, seeded reproducibility
 * - filterBySpace / filterByGroup: correctness
 * - getDatasetStats: accuracy
 * - measureMs / benchmark: timing utilities
 */

import {
  generateMemory,
  generateMemories,
  filterBySpace,
  filterByGroup,
  getDatasetStats,
  measureMs,
  benchmark,
  type GenerateOptions,
} from './test-data-generator.js';

// ---------------------------------------------------------------------------
// generateMemory
// ---------------------------------------------------------------------------

function makeRng(seed = 42) {
  let state = seed;
  return {
    next(): number {
      state = (state * 1664525 + 1013904223) & 0xffffffff;
      return (state >>> 0) / 0xffffffff;
    },
    nextInt(min: number, max: number): number {
      return Math.floor(this.next() * (max - min + 1)) + min;
    },
    pick<T>(arr: T[]): T {
      return arr[this.nextInt(0, arr.length - 1)];
    },
    shuffle<T>(arr: T[]): T[] {
      const copy = [...arr];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = this.nextInt(0, i);
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    },
  };
}

describe('generateMemory', () => {
  const opts: GenerateOptions = {
    count: 1,
    userId: 'test-user',
    spaces: ['the_void', 'dogs'],
    groups: ['grp-1'],
    publishProbability: 1.0, // ensure fields are set
  };

  it('returns correct doc_type', () => {
    const mem = generateMemory(0, opts, makeRng());
    expect(mem.doc_type).toBe('memory');
  });

  it('uses userId from options', () => {
    const mem = generateMemory(0, opts, makeRng());
    expect(mem.user_id).toBe('test-user');
  });

  it('has non-empty content', () => {
    const mem = generateMemory(0, opts, makeRng());
    expect(mem.content.length).toBeGreaterThan(0);
  });

  it('has weight in [0, 1] range', () => {
    const mem = generateMemory(0, opts, makeRng());
    expect(mem.weight).toBeGreaterThanOrEqual(0);
    expect(mem.weight).toBeLessThanOrEqual(1);
  });

  it('has trust in [0, 1] range', () => {
    const mem = generateMemory(0, opts, makeRng());
    expect(mem.trust).toBeGreaterThanOrEqual(0);
    expect(mem.trust).toBeLessThanOrEqual(1);
  });

  it('always initializes deleted_at to null', () => {
    const mem = generateMemory(0, opts, makeRng());
    expect(mem.deleted_at).toBeNull();
  });

  it('assigns space_ids from provided spaces when publishProbability is 1', () => {
    const mem = generateMemory(0, opts, makeRng());
    expect(mem.space_ids).toEqual(expect.arrayContaining(['the_void', 'dogs']));
  });

  it('assigns group_ids from provided groups when publishProbability is 1', () => {
    const mem = generateMemory(0, opts, makeRng());
    expect(mem.group_ids).toContain('grp-1');
  });

  it('assigns empty space_ids when publishProbability is 0', () => {
    const zeroOpts = { ...opts, publishProbability: 0 };
    const mem = generateMemory(0, zeroOpts, makeRng());
    expect(mem.space_ids).toEqual([]);
  });

  it('assigns empty group_ids when publishProbability is 0', () => {
    const zeroOpts = { ...opts, publishProbability: 0 };
    const mem = generateMemory(0, zeroOpts, makeRng());
    expect(mem.group_ids).toEqual([]);
  });

  it('includes index in id', () => {
    const mem = generateMemory(7, opts, makeRng());
    expect(mem.id).toContain('00000007');
  });

  it('produces different created_at per index (1 minute apart)', () => {
    const mem0 = generateMemory(0, opts, makeRng());
    const mem1 = generateMemory(1, opts, makeRng());
    const diff = new Date(mem1.created_at).getTime() - new Date(mem0.created_at).getTime();
    expect(diff).toBe(60_000);
  });
});

// ---------------------------------------------------------------------------
// generateMemories
// ---------------------------------------------------------------------------

describe('generateMemories', () => {
  it('returns exactly count memories', () => {
    const memories = generateMemories({ count: 100 });
    expect(memories).toHaveLength(100);
  });

  it('returns empty array for count 0', () => {
    const memories = generateMemories({ count: 0 });
    expect(memories).toHaveLength(0);
  });

  it('is deterministic with same seed', () => {
    const a = generateMemories({ count: 50 }, 99);
    const b = generateMemories({ count: 50 }, 99);
    expect(a[0].id).toBe(b[0].id);
    expect(a[0].content).toBe(b[0].content);
    expect(a[49].weight).toBe(b[49].weight);
  });

  it('produces different results with different seeds', () => {
    const a = generateMemories({ count: 10 }, 1);
    const b = generateMemories({ count: 10 }, 2);
    // At least one memory should differ
    const differ = a.some((m, i) => m.content !== b[i].content || m.weight !== b[i].weight);
    expect(differ).toBe(true);
  });

  it('all memories have correct user_id', () => {
    const memories = generateMemories({ count: 20, userId: 'bench-user' });
    expect(memories.every(m => m.user_id === 'bench-user')).toBe(true);
  });

  it('all memories have doc_type memory', () => {
    const memories = generateMemories({ count: 20 });
    expect(memories.every(m => m.doc_type === 'memory')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// filterBySpace / filterByGroup
// ---------------------------------------------------------------------------

describe('filterBySpace', () => {
  const memories = generateMemories({
    count: 200,
    spaces: ['the_void', 'dogs'],
    publishProbability: 0.5,
  });

  it('returns only memories with the specified space_id', () => {
    const filtered = filterBySpace(memories, 'the_void');
    expect(filtered.every(m => m.space_ids.includes('the_void'))).toBe(true);
  });

  it('returns empty array for non-existent space', () => {
    const filtered = filterBySpace(memories, 'non-existent-space');
    expect(filtered).toHaveLength(0);
  });

  it('returns subset of total memories', () => {
    const filtered = filterBySpace(memories, 'the_void');
    expect(filtered.length).toBeLessThanOrEqual(memories.length);
    expect(filtered.length).toBeGreaterThan(0);
  });
});

describe('filterByGroup', () => {
  const memories = generateMemories({
    count: 200,
    groups: ['grp-a', 'grp-b'],
    publishProbability: 0.5,
  });

  it('returns only memories with the specified group_id', () => {
    const filtered = filterByGroup(memories, 'grp-a');
    expect(filtered.every(m => m.group_ids.includes('grp-a'))).toBe(true);
  });

  it('returns empty array for non-existent group', () => {
    const filtered = filterByGroup(memories, 'grp-z');
    expect(filtered).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// getDatasetStats
// ---------------------------------------------------------------------------

describe('getDatasetStats', () => {
  it('returns total equal to memories.length', () => {
    const memories = generateMemories({ count: 100 });
    const stats = getDatasetStats(memories);
    expect(stats.total).toBe(100);
  });

  it('unpublished + publishedToAnySpace/Group accounting is internally consistent', () => {
    const memories = generateMemories({
      count: 200,
      spaces: ['the_void'],
      groups: ['grp-1'],
      publishProbability: 0.5,
    });
    const stats = getDatasetStats(memories);
    expect(stats.publishedToAnySpace + stats.publishedToAnyGroup + stats.unpublished).toBeGreaterThanOrEqual(stats.total);
    expect(stats.total).toBe(200);
  });

  it('bySpace counts match filterBySpace counts', () => {
    const memories = generateMemories({
      count: 100,
      spaces: ['the_void', 'dogs'],
      publishProbability: 0.5,
    });
    const stats = getDatasetStats(memories);
    const filteredCount = filterBySpace(memories, 'the_void').length;
    expect(stats.bySpace['the_void'] ?? 0).toBe(filteredCount);
  });

  it('avgTagsPerMemory is a reasonable number between 0 and 3', () => {
    const memories = generateMemories({ count: 100 });
    const stats = getDatasetStats(memories);
    expect(stats.avgTagsPerMemory).toBeGreaterThanOrEqual(0);
    expect(stats.avgTagsPerMemory).toBeLessThanOrEqual(3);
  });

  it('returns all zeros for empty dataset', () => {
    const stats = getDatasetStats([]);
    expect(stats.total).toBe(0);
    expect(stats.publishedToAnySpace).toBe(0);
    expect(stats.unpublished).toBe(0);
    expect(stats.avgTagsPerMemory).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// measureMs
// ---------------------------------------------------------------------------

describe('measureMs', () => {
  it('returns result from the async function', async () => {
    const { result } = await measureMs(async () => 42);
    expect(result).toBe(42);
  });

  it('returns elapsedMs as a non-negative number', async () => {
    const { elapsedMs } = await measureMs(async () => {});
    expect(elapsedMs).toBeGreaterThanOrEqual(0);
  });

  it('captures time for delayed operations', async () => {
    const { elapsedMs } = await measureMs(async () => {
      await new Promise(resolve => setTimeout(resolve, 20));
    });
    expect(elapsedMs).toBeGreaterThanOrEqual(15);
  });
});

// ---------------------------------------------------------------------------
// benchmark
// ---------------------------------------------------------------------------

describe('benchmark', () => {
  it('runs exactly iterations times', async () => {
    let count = 0;
    await benchmark(async () => { count++; }, 5);
    expect(count).toBe(5);
  });

  it('returns results array of correct length', async () => {
    const { results } = await benchmark(async () => 'x', 3);
    expect(results).toHaveLength(3);
  });

  it('min <= avg <= max', async () => {
    const { min, avg, max } = await benchmark(async () => {
      await new Promise(resolve => setTimeout(resolve, 5));
    }, 4);
    expect(min).toBeLessThanOrEqual(avg);
    expect(avg).toBeLessThanOrEqual(max);
  });

  it('p95 is between min and max', async () => {
    const { min, max, p95 } = await benchmark(async () => {}, 10);
    expect(p95).toBeGreaterThanOrEqual(min);
    expect(p95).toBeLessThanOrEqual(max);
  });
});
