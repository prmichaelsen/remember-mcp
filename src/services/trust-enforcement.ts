/**
 * Trust enforcement service — 3 configurable modes for cross-user memory access.
 *
 * - query mode (default): memories above trust threshold never returned from Weaviate
 * - prompt mode: all memories returned, formatted/redacted by trust level
 * - hybrid mode: query filter for trust 0.0, prompt filter for rest
 *
 * See agent/design/local.ghost-persona-system.md
 */

import type { Memory } from '../types/memory.js';
import type { TrustEnforcementMode } from '../types/ghost-config.js';

// ─── Trust Level Thresholds ────────────────────────────────────────────────

/** Trust level thresholds mapping continuous 0-1 values to discrete behavior tiers */
export const TRUST_THRESHOLDS = {
  FULL_ACCESS: 1.0,
  PARTIAL_ACCESS: 0.75,
  SUMMARY_ONLY: 0.5,
  METADATA_ONLY: 0.25,
  EXISTENCE_ONLY: 0.0,
} as const;

// ─── Query-Level Enforcement ───────────────────────────────────────────────

/**
 * Build a Weaviate filter that restricts memories by trust score.
 * Only returns memories where trust_score <= accessorTrustLevel.
 *
 * Trust 1.0 memories require accessor trust >= 1.0 to even appear in results.
 * When they do appear, formatMemoryForPrompt caps output to existence-only.
 *
 * @param collection - Weaviate collection instance
 * @param accessorTrustLevel - The accessor's trust level (0-1)
 * @returns Weaviate filter object
 */
export function buildTrustFilter(collection: any, accessorTrustLevel: number): any {
  return collection.filter.byProperty('trust_score').lessThanOrEqual(accessorTrustLevel);
}

// ─── Prompt-Level Enforcement ──────────────────────────────────────────────

/**
 * Formatted memory representation for prompt-level enforcement.
 * Content is redacted/formatted based on trust level.
 */
export interface FormattedMemory {
  memory_id: string;
  trust_tier: string;
  content: string;
}

/**
 * Format a memory for inclusion in an LLM prompt, redacted by trust level.
 *
 * Trust tiers:
 * - 1.0  Full Access:    full content, all details
 * - 0.75 Partial Access: content with sensitive fields redacted
 * - 0.5  Summary Only:   title + summary, no content
 * - 0.25 Metadata Only:  type, date, tags — no content or summary
 * - 0.0  Existence Only: "A memory exists about this topic"
 *
 * Trust 1.0 memories are always existence-only for cross-users, regardless of
 * accessor trust level. Use `isSelfAccess = true` to bypass for owner access.
 *
 * @param memory - The memory to format
 * @param accessorTrustLevel - The accessor's trust level (0-1)
 * @param isSelfAccess - True if the accessor is the memory owner (bypasses trust 1.0 cap)
 * @returns Formatted memory for prompt inclusion
 */
export function formatMemoryForPrompt(memory: Memory, accessorTrustLevel: number, isSelfAccess = false): FormattedMemory {
  // Trust 1.0 = existence-only for cross-users (acknowledged but never revealed)
  if (!isSelfAccess && memory.trust >= 1.0) {
    return {
      memory_id: memory.id,
      trust_tier: 'Existence Only',
      content: 'A memory exists about this topic.',
    };
  }

  const tier = getTrustLevelLabel(accessorTrustLevel);

  if (accessorTrustLevel >= TRUST_THRESHOLDS.FULL_ACCESS) {
    // Full Access — all content
    const parts = [`[${memory.type}] ${memory.title || 'Untitled'}`];
    parts.push(memory.content);
    if (memory.summary) parts.push(`Summary: ${memory.summary}`);
    if (memory.tags.length > 0) parts.push(`Tags: ${memory.tags.join(', ')}`);
    if (memory.created_at) parts.push(`Created: ${memory.created_at}`);
    return { memory_id: memory.id, trust_tier: tier, content: parts.join('\n') };
  }

  if (accessorTrustLevel >= TRUST_THRESHOLDS.PARTIAL_ACCESS) {
    // Partial Access — redact sensitive fields
    const redacted = redactSensitiveFields(memory, accessorTrustLevel);
    const parts = [`[${redacted.type}] ${redacted.title || 'Untitled'}`];
    parts.push(redacted.content);
    if (redacted.tags.length > 0) parts.push(`Tags: ${redacted.tags.join(', ')}`);
    return { memory_id: memory.id, trust_tier: tier, content: parts.join('\n') };
  }

  if (accessorTrustLevel >= TRUST_THRESHOLDS.SUMMARY_ONLY) {
    // Summary Only — title + summary, no content body
    const parts = [`[${memory.type}] ${memory.title || 'Untitled'}`];
    if (memory.summary) {
      parts.push(memory.summary);
    } else {
      parts.push('(No summary available)');
    }
    return { memory_id: memory.id, trust_tier: tier, content: parts.join('\n') };
  }

  if (accessorTrustLevel >= TRUST_THRESHOLDS.METADATA_ONLY) {
    // Metadata Only — type, date, tags
    const parts = [`[${memory.type}]`];
    if (memory.created_at) parts.push(`Created: ${memory.created_at}`);
    if (memory.tags.length > 0) parts.push(`Tags: ${memory.tags.join(', ')}`);
    return { memory_id: memory.id, trust_tier: tier, content: parts.join('\n') };
  }

  // Existence Only — minimal hint
  return {
    memory_id: memory.id,
    trust_tier: tier,
    content: 'A memory exists about this topic.',
  };
}

// ─── Shared Utilities ──────────────────────────────────────────────────────

/**
 * Get a human-readable label for a trust level.
 */
export function getTrustLevelLabel(trust: number): string {
  if (trust >= TRUST_THRESHOLDS.FULL_ACCESS) return 'Full Access';
  if (trust >= TRUST_THRESHOLDS.PARTIAL_ACCESS) return 'Partial Access';
  if (trust >= TRUST_THRESHOLDS.SUMMARY_ONLY) return 'Summary Only';
  if (trust >= TRUST_THRESHOLDS.METADATA_ONLY) return 'Metadata Only';
  return 'Existence Only';
}

/**
 * Get LLM instruction text describing what to reveal at a given trust level.
 */
export function getTrustInstructions(trust: number): string {
  if (trust >= TRUST_THRESHOLDS.FULL_ACCESS) {
    return 'You have full access to this memory. Share all content and details freely.';
  }
  if (trust >= TRUST_THRESHOLDS.PARTIAL_ACCESS) {
    return 'You have partial access. Share the main content but do not reveal sensitive personal details like exact locations, contact information, or financial data.';
  }
  if (trust >= TRUST_THRESHOLDS.SUMMARY_ONLY) {
    return 'You have summary-level access. Share the title and summary only. Do not reveal the full content of this memory.';
  }
  if (trust >= TRUST_THRESHOLDS.METADATA_ONLY) {
    return 'You have metadata-level access only. You may mention the type, date, and tags, but do not reveal any content or summary.';
  }
  return 'You may only acknowledge that a memory exists about this topic. Do not reveal any details.';
}

/**
 * Redact sensitive fields from a memory for partial access.
 * Returns a copy with location, context, and references cleared.
 */
export function redactSensitiveFields(memory: Memory, _trust: number): Memory {
  return {
    ...memory,
    // Clear sensitive location data
    location: { gps: null, address: null, source: 'unavailable', confidence: 0, is_approximate: true },
    // Strip context details
    context: {
      ...memory.context,
      participants: undefined,
      environment: undefined,
      notes: undefined,
    },
    // Clear references (may contain private URLs)
    references: undefined,
  };
}

/**
 * Check whether an accessor's trust level is sufficient for a memory.
 * Access is granted when accessorTrust >= memoryTrust.
 */
export function isTrustSufficient(memoryTrust: number, accessorTrust: number): boolean {
  return accessorTrust >= memoryTrust;
}

/**
 * Determine the enforcement mode to use.
 * Convenience function that returns the mode from GhostConfig or falls back to 'query'.
 */
export function resolveEnforcementMode(mode?: TrustEnforcementMode): TrustEnforcementMode {
  return mode ?? 'query';
}
