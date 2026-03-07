/**
 * remember_search_space_by tool
 * Unified search modes for space/group published memories
 */

import { handleToolError } from '../utils/error-handler.js';
import { createDebugLogger } from '../utils/debug.js';
import type { AuthContext } from '../types/auth.js';
import { createCoreServices } from '../core-services.js';

export type SearchSpaceByMode = 'byTime' | 'byRating' | 'byDiscovery' | 'byProperty' | 'byBroad' | 'byRandom';

export const searchSpaceByTool = {
  name: 'remember_search_space_by',
  description: `Search shared spaces using specialized modes. Similar to remember_search_by
  but operates on published memories in spaces and groups.

  Modes:
  - byTime: Chronological sort of published memories
  - byRating: Sort by Bayesian rating average (social ratings)
  - byDiscovery: Interleaved rated + unrated for exploration
  - byProperty: Sort by any property (e.g., feel_trauma, total_significance)
  - byBroad: Massive results with truncated content
  - byRandom: Random sampling from space

  At least one of 'spaces' or 'groups' must be provided.`,
  inputSchema: {
    type: 'object',
    properties: {
      mode: {
        type: 'string',
        enum: ['byTime', 'byRating', 'byDiscovery', 'byProperty', 'byBroad', 'byRandom'],
        description: 'Search mode',
      },
      spaces: {
        type: 'array',
        items: { type: 'string' },
        description: 'Space names to search',
      },
      groups: {
        type: 'array',
        items: { type: 'string' },
        description: 'Group IDs to search',
      },
      query: { type: 'string', description: 'Optional search query' },
      sort_order: {
        type: 'string',
        enum: ['asc', 'desc'],
        description: 'Sort order. Default: desc',
      },
      sort_field: {
        type: 'string',
        description: 'Property to sort by (byProperty mode only)',
      },
      limit: { type: 'number', description: 'Max results. Default: 10 (byBroad: 50)' },
      offset: { type: 'number', description: 'Pagination offset' },
      moderation_filter: {
        type: 'string',
        description: 'Moderation filter level',
      },
      include_comments: {
        type: 'boolean',
        description: 'Include comments on published memories. Default: false',
      },
    },
    required: ['mode'],
  },
};

export interface SearchSpaceByArgs {
  mode: SearchSpaceByMode;
  spaces?: string[];
  groups?: string[];
  query?: string;
  sort_order?: 'asc' | 'desc';
  sort_field?: string;
  limit?: number;
  offset?: number;
  moderation_filter?: string;
  include_comments?: boolean;
}

export async function handleSearchSpaceBy(
  args: SearchSpaceByArgs,
  userId: string,
  authContext?: AuthContext
): Promise<string> {
  const debug = createDebugLogger({ tool: 'remember_search_space_by', userId, operation: `space search by ${args.mode}` });
  try {
    debug.info('Tool invoked');
    debug.trace('Arguments', { args });

    // Validate at least one of spaces or groups is provided
    if (!args.spaces?.length && !args.groups?.length) {
      return JSON.stringify({
        error: 'At least one of "spaces" or "groups" must be provided.',
      });
    }

    const { space } = createCoreServices(userId);

    const baseParams = {
      spaces: args.spaces,
      groups: args.groups,
      query: args.query,
      limit: args.limit ?? 10,
      offset: args.offset ?? 0,
      moderation_filter: args.moderation_filter,
      include_comments: args.include_comments,
    };

    let result;
    switch (args.mode) {
      case 'byDiscovery':
        result = await space.byDiscovery(baseParams as any, authContext as any);
        break;

      case 'byTime':
        result = await space.byTime({
          ...baseParams,
          direction: args.sort_order ?? 'desc',
        } as any, authContext as any);
        break;

      case 'byRating':
        result = await space.byRating({
          ...baseParams,
          direction: args.sort_order ?? 'desc',
        } as any, authContext as any);
        break;

      case 'byProperty': {
        if (!args.sort_field) {
          return JSON.stringify({
            error: 'sort_field is required for byProperty mode. Provide a property name (e.g., "feel_trauma", "total_significance").',
          });
        }
        result = await space.byProperty({
          ...baseParams,
          sort_field: args.sort_field,
          sort_direction: args.sort_order ?? 'desc',
        } as any, authContext as any);
        break;
      }

      case 'byBroad':
        result = await space.byBroad({
          ...baseParams,
          query: args.query,
          sort_order: args.sort_order,
        } as any, authContext as any);
        break;

      case 'byRandom':
        result = await space.byRandom(baseParams as any, authContext as any);
        break;

      default:
        return JSON.stringify({
          error: `Unknown mode: ${(args as any).mode}. Valid modes: byTime, byRating, byDiscovery, byProperty, byBroad, byRandom`,
        });
    }

    return JSON.stringify(result, null, 2);
  } catch (error) {
    debug.error('Tool failed', { error: error instanceof Error ? error.message : String(error) });
    handleToolError(error, {
      toolName: 'remember_search_space_by',
      operation: `space search by ${args.mode}`,
      userId,
    });
  }
}
