/**
 * Auth helper utilities for permission checking.
 */

import type { AuthContext } from '../types/auth.js';

/**
 * Check if the user has can_moderate permission for a specific group.
 */
export function canModerate(authContext: AuthContext | undefined, groupId: string): boolean {
  if (!authContext?.credentials) return false;
  const membership = authContext.credentials.group_memberships
    .find(m => m.group_id === groupId);
  return membership?.permissions.can_moderate ?? false;
}

/**
 * Check if the user has can_moderate permission for ANY group.
 * Useful for space-level moderation where there's no specific group context.
 */
export function canModerateAny(authContext: AuthContext | undefined): boolean {
  if (!authContext?.credentials) return false;
  return authContext.credentials.group_memberships
    .some(m => m.permissions.can_moderate);
}
