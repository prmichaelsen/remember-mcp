/**
 * Discriminated union for type-safe access control responses.
 * See agent/design/access-control-result-pattern.md
 */

import type { Memory } from './memory.js';

/** Access granted — owner or trusted cross-user access */
export interface AccessGranted {
  status: 'granted';
  memory: Memory;
  access_level: 'owner' | 'trusted';
}

/** Trust level insufficient for this memory */
export interface AccessInsufficientTrust {
  status: 'insufficient_trust';
  memory_id: string;
  required_trust: number;
  actual_trust: number;
  attempts_remaining: number;
}

/** Access blocked after repeated unauthorized attempts */
export interface AccessBlocked {
  status: 'blocked';
  memory_id: string;
  reason: string;
  blocked_at: string; // ISO 8601
}

/** No ghost/permission relationship exists */
export interface AccessNoPermission {
  status: 'no_permission';
  owner_user_id: string;
  accessor_user_id: string;
}

/** Memory not found */
export interface AccessNotFound {
  status: 'not_found';
  memory_id: string;
}

/** Memory was deleted */
export interface AccessDeleted {
  status: 'deleted';
  memory_id: string;
  deleted_at: string; // ISO 8601
}

/** Discriminated union of all access result variants */
export type AccessResult =
  | AccessGranted
  | AccessInsufficientTrust
  | AccessBlocked
  | AccessNoPermission
  | AccessNotFound
  | AccessDeleted;

/** All possible access result statuses */
export type AccessResultStatus = AccessResult['status'];
