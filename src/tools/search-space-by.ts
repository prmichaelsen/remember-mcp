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
  description: `Search published memories in shared spaces/groups using specialized sort/discovery modes.

  Modes:
  - byTime: Chronological sort (newest/oldest first)
  - byRating: Sort by Bayesian rating average (social ratings from other users)
  - byDiscovery: Interleaved rated + unrated content for exploration (4:1 ratio). Good for finding hidden gems.
  - byProperty: Sort by any memory property (e.g., feel_trauma, total_significance, weight). Requires sort_field.
  - byBroad: Massive results with truncated content (content_head/mid/tail ~100 chars each) for scan-and-drill-in workflow
  - byRandom: Random sampling for serendipitous discovery

  At least one of 'spaces' or 'groups' must be provided.

  Use remember_search_space for hybrid semantic+keyword search of space memories.
  Use this tool for structured browsing, sorting, and discovery of published content.

  Available sort_field values for byProperty:
  Emotions (0-1): feel_emotional_significance, feel_vulnerability, feel_trauma, feel_humor, feel_happiness, feel_sadness, feel_fear, feel_anger, feel_surprise, feel_disgust, feel_contempt, feel_embarrassment, feel_shame, feel_guilt, feel_excitement, feel_pride, feel_intensity, feel_coherence_tension
  Affect dimensions: feel_valence (-1 to 1), feel_arousal (0-1), feel_dominance (0-1)
  Functional signals (0-1): functional_salience, functional_urgency, functional_social_weight, functional_agency, functional_novelty, functional_retrieval_utility, functional_narrative_importance, functional_aesthetic_quality, functional_valence, functional_coherence_tension
  Composite scores: feel_significance, functional_significance, total_significance
  Core: weight, trust_score, relationship_count, version
  Ratings: rating_sum, rating_count, rating_bayesian
  Published: discovery_count, revision_count`,
  inputSchema: {
    type: 'object',
    properties: {
      mode: {
        type: 'string',
        enum: ['byTime', 'byRating', 'byDiscovery', 'byProperty', 'byBroad', 'byRandom'],
        description: 'Search mode: byTime (chronological), byRating (highest rated), byDiscovery (explore mix), byProperty (sort by field), byBroad (scan many truncated), byRandom (random sample)',
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
