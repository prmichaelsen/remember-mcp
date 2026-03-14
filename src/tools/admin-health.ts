/**
 * remember_admin_health tool
 * Deep health check — Weaviate and Firestore connectivity with latency.
 */

import { handleToolError } from '../utils/error-handler.js';
import { createDebugLogger } from '../utils/debug.js';
import type { AuthContext } from '../types/auth.js';
import { isAdmin, adminPermissionError } from '../utils/admin.js';
import { testWeaviateConnection } from '../weaviate/client.js';
import { testFirestoreConnection } from '../firestore/init.js';

export const adminHealthTool = {
  name: 'remember_admin_health',
  description: `[Admin] Deep health check — Weaviate and Firestore connectivity with latency.

  Returns overall status (healthy/degraded/unhealthy).
  Requires admin access (ADMIN_USER_IDS).`,
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

export async function handleAdminHealth(
  _args: Record<string, unknown>,
  userId: string,
  _authContext?: AuthContext
): Promise<string> {
  const debug = createDebugLogger({ tool: 'remember_admin_health', userId, operation: 'health check' });
  try {
    if (!isAdmin(userId)) {
      return JSON.stringify(adminPermissionError());
    }

    debug.info('Tool invoked');

    // Check Weaviate
    const weaviateStart = Date.now();
    let weaviateOk: boolean;
    let weaviateError: string | undefined;
    try {
      weaviateOk = await testWeaviateConnection();
    } catch (err) {
      weaviateOk = false;
      weaviateError = err instanceof Error ? err.message : String(err);
    }
    const weaviateLatency = Date.now() - weaviateStart;

    // Check Firestore
    const firestoreStart = Date.now();
    let firestoreOk: boolean;
    let firestoreError: string | undefined;
    try {
      firestoreOk = await testFirestoreConnection();
    } catch (err) {
      firestoreOk = false;
      firestoreError = err instanceof Error ? err.message : String(err);
    }
    const firestoreLatency = Date.now() - firestoreStart;

    // Determine overall status
    let overall: 'healthy' | 'degraded' | 'unhealthy';
    if (weaviateOk && firestoreOk) {
      overall = 'healthy';
    } else if (!weaviateOk && !firestoreOk) {
      overall = 'unhealthy';
    } else {
      overall = 'degraded';
    }

    return JSON.stringify({
      weaviate: {
        status: weaviateOk ? 'ok' : 'error',
        latency_ms: weaviateLatency,
        message: weaviateError,
      },
      firestore: {
        status: firestoreOk ? 'ok' : 'error',
        latency_ms: firestoreLatency,
        message: firestoreError,
      },
      overall,
    }, null, 2);
  } catch (error) {
    return handleToolError(error, { toolName: 'remember_admin_health', userId, operation: 'health check' });
  }
}
