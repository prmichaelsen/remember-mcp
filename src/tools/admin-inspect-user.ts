/**
 * Admin user inspection tools — granular Firestore data access per data type.
 *
 * - remember_admin_inspect_user_preferences
 * - remember_admin_inspect_user_ghost_configs
 * - remember_admin_inspect_user_escalation_records
 * - remember_admin_inspect_user_api_tokens
 */

import { handleToolError } from '../utils/error-handler.js';
import { createDebugLogger } from '../utils/debug.js';
import type { AuthContext } from '../types/auth.js';
import { isAdmin, adminPermissionError } from '../utils/admin.js';
import { createCoreServices } from '../core-services.js';
import { getGhostConfig } from '../services/ghost-config.service.js';
import { queryDocuments } from '../firestore/init.js';
import { BASE } from '../firestore/paths.js';

// ── Tool Definitions ────────────────────────────────────────────────────

const userIdSchema = {
  type: 'object' as const,
  properties: {
    user_id: { type: 'string' as const, description: 'User ID to inspect' },
  },
  required: ['user_id'] as const,
};

export const adminInspectUserPreferencesTool = {
  name: 'remember_admin_inspect_user_preferences',
  description: `[Admin] Inspect a user's preferences from Firestore. Requires admin access.`,
  inputSchema: userIdSchema,
};

export const adminInspectUserGhostConfigsTool = {
  name: 'remember_admin_inspect_user_ghost_configs',
  description: `[Admin] Inspect a user's ghost configurations from Firestore. Requires admin access.`,
  inputSchema: userIdSchema,
};

export const adminInspectUserEscalationRecordsTool = {
  name: 'remember_admin_inspect_user_escalation_records',
  description: `[Admin] Inspect a user's trust escalation records from Firestore. Requires admin access.`,
  inputSchema: userIdSchema,
};

export const adminInspectUserApiTokensTool = {
  name: 'remember_admin_inspect_user_api_tokens',
  description: `[Admin] Inspect a user's API token metadata from Firestore (no hashes). Requires admin access.`,
  inputSchema: userIdSchema,
};

// ── Shared Types ────────────────────────────────────────────────────────

export interface AdminInspectUserArgs {
  user_id: string;
}

// ── Handlers ────────────────────────────────────────────────────────────

export async function handleAdminInspectUserPreferences(
  args: AdminInspectUserArgs,
  userId: string,
  _authContext?: AuthContext
): Promise<string> {
  const debug = createDebugLogger({ tool: 'remember_admin_inspect_user_preferences', userId, operation: 'inspect preferences' });
  try {
    if (!isAdmin(userId)) return JSON.stringify(adminPermissionError());
    debug.info('Tool invoked', { target_user_id: args.user_id });

    const services = createCoreServices(args.user_id);
    const prefs = await services.preferences.getPreferences(args.user_id);

    return JSON.stringify({ user_id: args.user_id, preferences: prefs }, null, 2);
  } catch (error) {
    return handleToolError(error, { toolName: 'remember_admin_inspect_user_preferences', userId });
  }
}

export async function handleAdminInspectUserGhostConfigs(
  args: AdminInspectUserArgs,
  userId: string,
  _authContext?: AuthContext
): Promise<string> {
  const debug = createDebugLogger({ tool: 'remember_admin_inspect_user_ghost_configs', userId, operation: 'inspect ghost configs' });
  try {
    if (!isAdmin(userId)) return JSON.stringify(adminPermissionError());
    debug.info('Tool invoked', { target_user_id: args.user_id });

    const config = await getGhostConfig(args.user_id);

    return JSON.stringify({ user_id: args.user_id, ghost_config: config }, null, 2);
  } catch (error) {
    return handleToolError(error, { toolName: 'remember_admin_inspect_user_ghost_configs', userId });
  }
}

export async function handleAdminInspectUserEscalationRecords(
  args: AdminInspectUserArgs,
  userId: string,
  _authContext?: AuthContext
): Promise<string> {
  const debug = createDebugLogger({ tool: 'remember_admin_inspect_user_escalation_records', userId, operation: 'inspect escalation records' });
  try {
    if (!isAdmin(userId)) return JSON.stringify(adminPermissionError());
    debug.info('Tool invoked', { target_user_id: args.user_id });

    // Escalation records stored at: {BASE}.users/{user_id}/escalations
    const collectionPath = `${BASE}.users/${args.user_id}/escalations`;
    const records = await queryDocuments(collectionPath);

    return JSON.stringify({
      user_id: args.user_id,
      escalation_records: records.map(r => ({ id: r.id, ...r.data })),
    }, null, 2);
  } catch (error) {
    return handleToolError(error, { toolName: 'remember_admin_inspect_user_escalation_records', userId });
  }
}

export async function handleAdminInspectUserApiTokens(
  args: AdminInspectUserArgs,
  userId: string,
  _authContext?: AuthContext
): Promise<string> {
  const debug = createDebugLogger({ tool: 'remember_admin_inspect_user_api_tokens', userId, operation: 'inspect api tokens' });
  try {
    if (!isAdmin(userId)) return JSON.stringify(adminPermissionError());
    debug.info('Tool invoked', { target_user_id: args.user_id });

    // API tokens stored at: {BASE}.users/{user_id}/api_tokens
    const collectionPath = `${BASE}.users/${args.user_id}/api_tokens`;
    const tokens = await queryDocuments(collectionPath);

    // Strip token hashes — only return metadata
    const sanitized = tokens.map((token: any) => {
      const { token_hash, ...metadata } = token.data;
      return { id: token.id, ...metadata };
    });

    return JSON.stringify({
      user_id: args.user_id,
      api_tokens: sanitized,
    }, null, 2);
  } catch (error) {
    return handleToolError(error, { toolName: 'remember_admin_inspect_user_api_tokens', userId });
  }
}
