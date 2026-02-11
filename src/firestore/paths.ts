/**
 * Firestore collection path helpers
 * Following the user-scoped pattern from agentbase.me
 */

/**
 * Get path to user preferences document
 */
export function getUserPreferencesPath(userId: string): string {
  return `user_preferences/${userId}`;
}

/**
 * Get path to user's templates collection
 */
export function getUserTemplatesPath(userId: string): string {
  return `users/${userId}/templates`;
}

/**
 * Get path to user's allowed accessors collection (permissions)
 */
export function getUserPermissionsPath(ownerUserId: string): string {
  return `user_permissions/${ownerUserId}/allowed_accessors`;
}

/**
 * Get path to specific permission document
 */
export function getUserPermissionPath(ownerUserId: string, accessorUserId: string): string {
  return `user_permissions/${ownerUserId}/allowed_accessors/${accessorUserId}`;
}

/**
 * Get path to user's trust history collection
 */
export function getTrustHistoryPath(userId: string): string {
  return `trust_history/${userId}/history`;
}

/**
 * Get path to default templates collection
 */
export function getDefaultTemplatesPath(): string {
  return 'templates/default';
}

/**
 * Get path to specific default template
 */
export function getDefaultTemplatePath(templateId: string): string {
  return `templates/default/${templateId}`;
}
