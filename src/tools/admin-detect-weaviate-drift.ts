/**
 * remember_admin_detect_weaviate_drift tool
 * Compares expected schema properties (from code) against actual Weaviate schema.
 */

import { handleToolError } from '../utils/error-handler.js';
import { createDebugLogger } from '../utils/debug.js';
import type { AuthContext } from '../types/auth.js';
import { isAdmin, adminPermissionError } from '../utils/admin.js';
import { getWeaviateClient } from '../weaviate/client.js';
import {
  getUserCollectionProperties,
  getPublishedCollectionProperties,
} from '@prmichaelsen/remember-core/database/weaviate';

export const adminDetectWeaviateDriftTool = {
  name: 'remember_admin_detect_weaviate_drift',
  description: `[Admin] Compare expected vs actual Weaviate schema properties per collection.

  Reports missing properties, extra properties, and overall drift status.
  If no collection_ids provided, checks a sample of collections.
  Requires admin access (ADMIN_USER_IDS).`,
  inputSchema: {
    type: 'object',
    properties: {
      collection_ids: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional — specific collections to check. If omitted, samples available collections.',
      },
    },
  },
};

export interface AdminDetectWeaviateDriftArgs {
  collection_ids?: string[];
}

function getExpectedProperties(collectionName: string): string[] {
  if (collectionName.startsWith('Memory_users_')) {
    return getUserCollectionProperties();
  }
  // Space, group, and friends collections use published properties
  return getPublishedCollectionProperties();
}

export async function handleAdminDetectWeaviateDrift(
  args: AdminDetectWeaviateDriftArgs,
  userId: string,
  _authContext?: AuthContext
): Promise<string> {
  const debug = createDebugLogger({ tool: 'remember_admin_detect_weaviate_drift', userId, operation: 'detect drift' });
  try {
    if (!isAdmin(userId)) {
      return JSON.stringify(adminPermissionError());
    }

    debug.info('Tool invoked', { collection_ids: args.collection_ids });

    const client = getWeaviateClient();

    // Determine which collections to check
    let collectionNames: string[];
    if (args.collection_ids && args.collection_ids.length > 0) {
      collectionNames = args.collection_ids;
    } else {
      // Sample: list all and take first few of each type
      const all = await client.collections.listAll();
      const names = all.map((c: any) => c.name).filter((n: string) => n.startsWith('Memory_'));
      collectionNames = names.slice(0, 5); // Sample up to 5
    }

    const results = [];

    for (const name of collectionNames) {
      try {
        const collection = client.collections.get(name);
        const config = await collection.config.get();
        const actualProperties = config.properties.map((p: any) => p.name);
        const expectedProperties = getExpectedProperties(name);

        const missing = expectedProperties.filter(p => !actualProperties.includes(p));
        const extra = actualProperties.filter((p: string) => !expectedProperties.includes(p));
        const status = missing.length === 0 && extra.length === 0 ? 'match' : 'drift';

        results.push({
          collection: name,
          status,
          expected_count: expectedProperties.length,
          actual_count: actualProperties.length,
          missing_properties: missing,
          extra_properties: extra,
        });
      } catch (err) {
        results.push({
          collection: name,
          status: 'error',
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return JSON.stringify({
      collections_checked: results.length,
      results,
    }, null, 2);
  } catch (error) {
    return handleToolError(error, { toolName: 'remember_admin_detect_weaviate_drift', userId, operation: 'detect drift' });
  }
}
