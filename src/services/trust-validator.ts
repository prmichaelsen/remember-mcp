/**
 * Trust validator — validation and suggestions for trust-sensitive operations.
 *
 * Uses integer TrustLevel 1–5 scale (higher = more confidential).
 * Aligned with remember-core's trust-validator.service.
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
 * Warns if trust >= 4 (Restricted/Secret — very restrictive).
 * Returns invalid for out-of-range values.
 *
 * @param trustLevel - The trust level being assigned (1-5 integer)
 */
export function validateTrustAssignment(trustLevel: number): TrustValidationResult {
  if (!Number.isInteger(trustLevel) || trustLevel < 1 || trustLevel > 5) {
    return { valid: false, warning: `Trust level must be an integer between 1 and 5, got ${trustLevel}` };
  }

  if (trustLevel >= 4) {
    return {
      valid: true,
      warning: `Trust level ${trustLevel} is very restrictive — most accessors will have limited visibility. Consider level 2 (INTERNAL) or 3 (CONFIDENTIAL) for broader access.`,
    };
  }

  return { valid: true };
}

/**
 * Suggest an appropriate trust level based on content type and tags.
 *
 * Guidelines (1-5 integer scale):
 * - Personal (journal, memory, event): RESTRICTED (4) — close contacts only
 * - System/audit/action: CONFIDENTIAL (3) — trusted friends
 * - Business (invoice, contract): CONFIDENTIAL (3)
 * - Communication (email, conversation): CONFIDENTIAL (3)
 * - Ghost conversations: RESTRICTED (4)
 * - Default: INTERNAL (2) — conservative
 *
 * Tag overrides:
 * - 'private' or 'secret': SECRET (5)
 * - 'public': PUBLIC (1)
 *
 * @param contentType - The type of content
 * @param tags - Optional tags that may affect suggestion
 * @returns Suggested trust level (1-5)
 */
export function suggestTrustLevel(contentType: ContentType, tags?: string[]): number {
  // Tag-based overrides take priority
  if (tags && tags.length > 0) {
    const lowerTags = tags.map(t => t.toLowerCase());
    if (lowerTags.includes('private') || lowerTags.includes('secret')) {
      return 5; // SECRET
    }
    if (lowerTags.includes('public')) {
      return 1; // PUBLIC
    }
  }

  // Content type-based suggestions
  switch (contentType) {
    // Personal — higher trust needed
    case 'journal':
    case 'memory':
    case 'event':
      return 4; // RESTRICTED

    // System/internal
    case 'system':
    case 'audit':
    case 'action':
    case 'history':
      return 3; // CONFIDENTIAL

    // Business
    case 'invoice':
    case 'contract':
      return 3; // CONFIDENTIAL

    // Communication
    case 'email':
    case 'conversation':
    case 'meeting':
      return 3; // CONFIDENTIAL

    // Ghost conversations — private by default
    case 'ghost':
      return 4; // RESTRICTED

    // Default — conservative
    default:
      return 2; // INTERNAL
  }
}
