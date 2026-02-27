/**
 * Test Data Generator for Memory Collection Pattern v2 Performance Tests
 *
 * Generates synthetic memory objects at scale for benchmarking.
 * All functions are pure (no Weaviate dependency) — usable in unit tests.
 */

import { SUPPORTED_SPACES } from '../types/space-memory.js';

/**
 * Minimal memory object shape used for performance test generation.
 * Mirrors the fields written to Weaviate during create/publish.
 */
export interface SyntheticMemory {
  id: string;
  user_id: string;
  doc_type: 'memory';
  content: string;
  title: string;
  type: string;
  weight: number;
  trust: number;
  confidence: number;
  tags: string[];
  space_ids: string[];
  group_ids: string[];
  created_at: string;
  updated_at: string;
  version: number;
  access_count: number;
  deleted_at: null;
}

/**
 * Options for generating synthetic memories
 */
export interface GenerateOptions {
  /** Number of memories to generate */
  count: number;
  /** User ID to assign (default: 'perf-test-user') */
  userId?: string;
  /** Spaces to randomly assign (default: subset of SUPPORTED_SPACES) */
  spaces?: string[];
  /** Group IDs to randomly assign */
  groups?: string[];
  /** Probability (0-1) that a memory has been published to a space */
  publishProbability?: number;
  /** Base ISO date string for created_at (default: current time) */
  baseDate?: string;
}

/**
 * A fast, deterministic pseudo-random number generator (LCG).
 * Avoids Math.random() so tests are reproducible.
 */
function createRng(seed: number) {
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

const CONTENT_TEMPLATES = [
  'Remember that {} is important for the project.',
  'Note: {} should be completed by next week.',
  'Meeting with {} to discuss the roadmap.',
  'Recipe for {}: combine ingredients and bake.',
  'Bookmark: {} — useful reference for later.',
  'Idea: {} could improve performance significantly.',
  'Quote from {}: "Knowledge is power."',
  'Event: {} on the calendar for this month.',
  'Todo: {} needs to be done before launch.',
  'Research notes on {}: several key findings.',
];

const WORDS = [
  'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta',
  'project', 'memory', 'design', 'system', 'module', 'feature', 'release',
  'task', 'goal', 'metric', 'api', 'schema', 'service', 'client', 'server',
];

const CONTENT_TYPES = ['note', 'todo', 'bookmark', 'idea', 'recipe', 'event', 'reference'];

const TAG_POOL = [
  'important', 'work', 'personal', 'cooking', 'tech', 'health',
  'books', 'travel', 'family', 'finance', 'learning', 'creative',
];

/**
 * Generate a single synthetic memory
 */
export function generateMemory(index: number, options: GenerateOptions, rng: ReturnType<typeof createRng>): SyntheticMemory {
  const userId = options.userId ?? 'perf-test-user';
  const spaces = options.spaces ?? SUPPORTED_SPACES.slice(0, 3);
  const groups = options.groups ?? [];
  const publishProb = options.publishProbability ?? 0.3;
  const baseDate = options.baseDate ?? '2026-01-01T00:00:00Z';

  const baseTime = new Date(baseDate).getTime();
  const createdAt = new Date(baseTime + index * 60_000).toISOString(); // 1 minute apart

  const word = rng.pick(WORDS);
  const template = rng.pick(CONTENT_TEMPLATES);
  const content = template.replace('{}', word);

  const tagCount = rng.nextInt(0, 3);
  const shuffledTags = rng.shuffle(TAG_POOL);
  const tags = shuffledTags.slice(0, tagCount);

  // Randomly assign to spaces based on publishProbability
  const assignedSpaceIds: string[] = [];
  for (const spaceId of spaces) {
    if (rng.next() < publishProb) {
      assignedSpaceIds.push(spaceId);
    }
  }

  // Randomly assign to groups
  const assignedGroupIds: string[] = [];
  for (const groupId of groups) {
    if (rng.next() < publishProb) {
      assignedGroupIds.push(groupId);
    }
  }

  return {
    id: `${userId}-mem-${String(index).padStart(8, '0')}`,
    user_id: userId,
    doc_type: 'memory',
    content,
    title: `Memory ${index}: ${word}`,
    type: rng.pick(CONTENT_TYPES),
    weight: Math.round(rng.next() * 100) / 100,
    trust: Math.round(rng.next() * 100) / 100,
    confidence: 1.0,
    tags,
    space_ids: assignedSpaceIds,
    group_ids: assignedGroupIds,
    created_at: createdAt,
    updated_at: createdAt,
    version: 1,
    access_count: 0,
    deleted_at: null,
  };
}

/**
 * Generate a batch of synthetic memories.
 *
 * Uses a seeded RNG for reproducible results across test runs.
 *
 * @param options - Generation options
 * @param seed - RNG seed (default: 42)
 * @returns Array of synthetic memory objects
 *
 * @example
 * // Generate 1K memories for a single user
 * const memories = generateMemories({ count: 1000 });
 *
 * // Generate 10K with custom spaces
 * const memories = generateMemories({
 *   count: 10_000,
 *   userId: 'user-123',
 *   spaces: ['the_void', 'dogs'],
 *   publishProbability: 0.5,
 * });
 */
export function generateMemories(options: GenerateOptions, seed = 42): SyntheticMemory[] {
  const rng = createRng(seed);
  const memories: SyntheticMemory[] = [];

  for (let i = 0; i < options.count; i++) {
    memories.push(generateMemory(i, options, rng));
  }

  return memories;
}

/**
 * Filter generated memories to only those published to a given space.
 * Mirrors the Weaviate containsAny filter used in search-space.
 */
export function filterBySpace(memories: SyntheticMemory[], spaceId: string): SyntheticMemory[] {
  return memories.filter(m => m.space_ids.includes(spaceId));
}

/**
 * Filter generated memories to only those published to a given group.
 */
export function filterByGroup(memories: SyntheticMemory[], groupId: string): SyntheticMemory[] {
  return memories.filter(m => m.group_ids.includes(groupId));
}

/**
 * Get publication statistics for a generated dataset.
 * Useful for understanding expected query result counts before running benchmarks.
 */
export function getDatasetStats(memories: SyntheticMemory[]): {
  total: number;
  publishedToAnySpace: number;
  publishedToAnyGroup: number;
  unpublished: number;
  bySpace: Record<string, number>;
  byGroup: Record<string, number>;
  avgTagsPerMemory: number;
} {
  const bySpace: Record<string, number> = {};
  const byGroup: Record<string, number> = {};
  let publishedToAnySpace = 0;
  let publishedToAnyGroup = 0;
  let totalTags = 0;

  for (const mem of memories) {
    if (mem.space_ids.length > 0) publishedToAnySpace++;
    if (mem.group_ids.length > 0) publishedToAnyGroup++;
    totalTags += mem.tags.length;

    for (const spaceId of mem.space_ids) {
      bySpace[spaceId] = (bySpace[spaceId] ?? 0) + 1;
    }
    for (const groupId of mem.group_ids) {
      byGroup[groupId] = (byGroup[groupId] ?? 0) + 1;
    }
  }

  return {
    total: memories.length,
    publishedToAnySpace,
    publishedToAnyGroup,
    unpublished: memories.filter(m => m.space_ids.length === 0 && m.group_ids.length === 0).length,
    bySpace,
    byGroup,
    avgTagsPerMemory: memories.length > 0 ? Math.round((totalTags / memories.length) * 100) / 100 : 0,
  };
}

/**
 * Timing utility for measuring operation duration.
 * Returns elapsed milliseconds.
 */
export async function measureMs<T>(fn: () => Promise<T>): Promise<{ result: T; elapsedMs: number }> {
  const start = performance.now();
  const result = await fn();
  const elapsedMs = Math.round((performance.now() - start) * 100) / 100;
  return { result, elapsedMs };
}

/**
 * Run a function N times and return timing statistics.
 */
export async function benchmark<T>(
  fn: () => Promise<T>,
  iterations: number
): Promise<{ min: number; max: number; avg: number; p95: number; results: T[] }> {
  const times: number[] = [];
  const results: T[] = [];

  for (let i = 0; i < iterations; i++) {
    const { result, elapsedMs } = await measureMs(fn);
    times.push(elapsedMs);
    results.push(result);
  }

  times.sort((a, b) => a - b);
  const avg = times.reduce((s, t) => s + t, 0) / times.length;
  const p95Index = Math.floor(times.length * 0.95);

  return {
    min: times[0],
    max: times[times.length - 1],
    avg: Math.round(avg * 100) / 100,
    p95: times[p95Index],
    results,
  };
}
