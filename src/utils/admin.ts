/**
 * Admin gate utilities
 * Checks if a userId is in the ADMIN_USER_IDS env var.
 * Re-reads env on each call (not cached) for hot-reload support.
 */

/**
 * Check if a userId is an admin.
 * Reads ADMIN_USER_IDS env var on each call.
 */
export function isAdmin(userId: string): boolean {
  const adminIds = (process.env.ADMIN_USER_IDS || '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean);
  return adminIds.includes(userId);
}

/**
 * Standard permission error response for non-admin users.
 */
export function adminPermissionError() {
  return {
    content: [{ type: 'text' as const, text: 'Permission denied: admin access required' }],
    isError: true,
  };
}
