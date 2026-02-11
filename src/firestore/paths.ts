/**
 * Firestore collection path helpers
 * Following the environment-based prefix pattern from agentbase.me
 *
 * Supports multiple environments for development sandboxing:
 * - Development: e0.remember-mcp, e1.remember-mcp, etc. (per developer/branch)
 * - Production: remember-mcp
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

/**
 * Get path to user preferences document
 */
export function getUserPreferencesPath(userId: string): string {
  return `${BASE}.user-preferences/${userId}`;
}

/**
 * Get path to user's templates collection
 */
export function getUserTemplatesPath(userId: string): string {
  return `${BASE}.users/${userId}/templates`;
}

/**
 * Get path to user's allowed accessors collection (permissions)
 */
export function getUserPermissionsPath(ownerUserId: string): string {
  return `${BASE}.user-permissions/${ownerUserId}/allowed-accessors`;
}

/**
 * Get path to specific permission document
 */
export function getUserPermissionPath(ownerUserId: string, accessorUserId: string): string {
  return `${BASE}.user-permissions/${ownerUserId}/allowed-accessors/${accessorUserId}`;
}

/**
 * Get path to user's trust history collection
 */
export function getTrustHistoryPath(userId: string): string {
  return `${BASE}.trust-history/${userId}/history`;
}

/**
 * Get path to default templates collection
 */
export function getDefaultTemplatesPath(): string {
  return `${BASE}.templates/default`;
}

/**
 * Get path to specific default template
 */
export function getDefaultTemplatePath(templateId: string): string {
  return `${BASE}.templates/default/${templateId}`;
}
