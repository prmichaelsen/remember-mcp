/**
 * Firestore collection path helpers
 * Following the environment-based prefix + users subcollection pattern
 *
 * Pattern from agentbase.me:
 * - Environment prefix: e0.remember-mcp (dev), remember-mcp (prod)
 * - User-scoped data: {BASE}.users/{user_id}/* (per agent/patterns/firestore-users-pattern-best-practices.md)
 * - Shared data: {BASE}.templates/default, {BASE}.user-permissions
 */

const APP_NAME = 'remember-mcp';

/**
 * Get the database collection prefix based on environment
 * - Development: Uses ENVIRONMENT env var or DB_PREFIX, defaults to 'e0.remember-mcp'
 * - Production: Uses base 'remember-mcp'
 *
 * This allows developers to use their own database entries as a sandbox per dev or branch.
 */
function getBasePrefix(): string {
  // Check for explicit environment variable (e0, e1, e2, etc.)
  const environment = process.env.ENVIRONMENT;
  if (environment && environment !== 'production' && environment !== 'prod') {
    return `${environment}.${APP_NAME}`;
  }

  // Check if we're in development mode
  const isDevelopment = process.env.NODE_ENV === 'development';

  if (isDevelopment) {
    // Check for custom DB_PREFIX env var first
    const customPrefix = process.env.DB_PREFIX;
    if (customPrefix) {
      return customPrefix;
    }
    // Default to e0.{APP_NAME} in development
    return `e0.${APP_NAME}`;
  }

  // Production uses the base APP_NAME
  return APP_NAME;
}

export const BASE = getBasePrefix();

// ============================================================================
// USER-SCOPED COLLECTIONS (under users/{user_id}/)
// Per agent/patterns/firestore-users-pattern-best-practices.md
// ============================================================================

/**
 * Get path to user preferences document
 * Pattern: {BASE}.users/{user_id}/preferences
 */
export function getUserPreferencesPath(userId: string): string {
  return `${BASE}.users/${userId}/preferences`;
}

/**
 * Get path to user's templates collection
 * Pattern: {BASE}.users/{user_id}/templates
 */
export function getUserTemplatesPath(userId: string): string {
  return `${BASE}.users/${userId}/templates`;
}

/**
 * Get path to user's access logs collection
 * Pattern: {BASE}.users/{user_id}/access-logs
 */
export function getUserAccessLogsPath(userId: string): string {
  return `${BASE}.users/${userId}/access-logs`;
}

/**
 * Get path to user's trust relationships collection
 * Pattern: {BASE}.users/{user_id}/trust-relationships
 */
export function getUserTrustRelationshipsPath(userId: string): string {
  return `${BASE}.users/${userId}/trust-relationships`;
}

// ============================================================================
// CROSS-USER COLLECTIONS (outside users/)
// These involve multiple users, so can't be under users/{user_id}/
// ============================================================================

/**
 * Get path to user's allowed accessors collection (permissions)
 * Pattern: {BASE}.user-permissions/{owner_user_id}/allowed-accessors
 *
 * Note: Outside users/ because it involves two users (owner + accessor)
 */
export function getUserPermissionsPath(ownerUserId: string): string {
  return `${BASE}.user-permissions/${ownerUserId}/allowed-accessors`;
}

/**
 * Get path to specific permission document
 * Pattern: {BASE}.user-permissions/{owner_user_id}/allowed-accessors/{accessor_user_id}
 */
export function getUserPermissionPath(ownerUserId: string, accessorUserId: string): string {
  return `${BASE}.user-permissions/${ownerUserId}/allowed-accessors/${accessorUserId}`;
}

// ============================================================================
// SHARED/GLOBAL COLLECTIONS
// ============================================================================

/**
 * Get path to default templates collection
 * Pattern: {BASE}.templates/default
 */
export function getDefaultTemplatesPath(): string {
  return `${BASE}.templates/default`;
}

/**
 * Get path to specific default template
 * Pattern: {BASE}.templates/default/{template_id}
 */
export function getDefaultTemplatePath(templateId: string): string {
  return `${BASE}.templates/default/${templateId}`;
}
