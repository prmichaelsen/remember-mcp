/**
 * Trust validator — validation and suggestions for trust-sensitive operations.
 *
 * See agent/design/local.ghost-persona-system.md
 */

import type { ContentType } from '../types/memory.js';

/**
 * Validation result for trust assignment.
 */
export interface TrustValidationResult {
  valid: boolean;
  warning?: string;
}

/**
 * Validate a trust level assignment.
 * Warns if trust < 0.25 (very private — existence-only for most accessors).
 * Returns invalid for out-of-range values.
 *
 * @param trustLevel - The trust level being assigned (0-1)
 * @param content - Optional content for context-aware validation
 */
export function validateTrustAssignment(trustLevel: number, content?: string): TrustValidationResult {
  if (trustLevel < 0 || trustLevel > 1) {
    return { valid: false, warning: `Trust level must be between 0 and 1, got ${trustLevel}` };
  }

  if (trustLevel < 0.25) {
    return {
      valid: true,
      warning: `Trust level ${trustLevel} is very restrictive — most accessors will see only that this memory exists. Consider 0.25+ for metadata visibility.`,
    };
  }

  return { valid: true };
}

/**
 * Suggest an appropriate trust level based on content type and tags.
 *
 * Guidelines:
 * - System/audit/action: 0.5 (internal, summary access for trusted users)
 * - Personal (journal, memory, event): 0.75 (share with close friends)
 * - Business (invoice, contract): 0.5 (summary only for collaborators)
 * - Communication (email, conversation): 0.5 (summary only)
 * - Creative/content: 0.25 (metadata for discovery, full access for trusted)
 * - Default: 0.25 (conservative — metadata only)
 *
 * Tag overrides:
 * - 'private' or 'secret': 0.1 (near-hidden)
 * - 'public': 1.0 (open to all)
 *
 * @param contentType - The type of content
 * @param tags - Optional tags that may affect suggestion
 * @returns Suggested trust level (0-1)
 */
export function suggestTrustLevel(contentType: ContentType, tags?: string[]): number {
  // Tag-based overrides take priority
  if (tags && tags.length > 0) {
    const lowerTags = tags.map(t => t.toLowerCase());
    if (lowerTags.includes('private') || lowerTags.includes('secret')) {
      return 0.1;
    }
    if (lowerTags.includes('public')) {
      return 1.0;
    }
  }

  // Content type-based suggestions
  switch (contentType) {
    // Personal — higher trust needed
    case 'journal':
    case 'memory':
    case 'event':
      return 0.75;

    // System/internal
    case 'system':
    case 'audit':
    case 'action':
    case 'history':
      return 0.5;

    // Business
    case 'invoice':
    case 'contract':
      return 0.5;

    // Communication
    case 'email':
    case 'conversation':
    case 'meeting':
      return 0.5;

    // Ghost conversations — private by default
    case 'ghost':
      return 0.75;

    // Default — conservative
    default:
      return 0.25;
  }
}
