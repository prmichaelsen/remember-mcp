/**
 * remember_search_by tool
 * Unified search tool with multiple sort/discovery modes
 */

import { handleToolError } from '../utils/error-handler.js';
import { createDebugLogger } from '../utils/debug.js';
import type { AuthContext } from '../types/auth.js';
import { createCoreServices } from '../core-services.js';

/**
 * Search mode type
 */
export type SearchByMode = 'byTime' | 'byDensity' | 'byRating' | 'byDiscovery' | 'byProperty' | 'bySignificance' | 'byBroad' | 'byRandom';

/**
 * Tool definition for remember_search_by
 */
export const searchByTool = {
  name: 'remember_search_by',
  description: `Search memories using specialized modes beyond hybrid search.

  Modes:
  - byTime: Chronological sort (newest/oldest first)
  - byDensity: Sort by relationship count (most connected memories)
  - byRating: Sort by Bayesian rating average (social ratings from spaces)
  - byDiscovery: Interleaved rated + unrated content for exploration (4:1 ratio)
  - byProperty: Sort by any memory property (e.g., feel_trauma, weight, feel_salience)
  - bySignificance: Sort by total_significance (combined emotional + functional score from REM)
  - byBroad: Massive results with truncated content for scan-and-drill-in workflow (default limit: 50)
  - byRandom: Random sampling for serendipitous rediscovery

  Use remember_search_memory for hybrid semantic+keyword search.
  Use remember_find_similar for vector similarity.
  Use this tool for structured browsing, sorting, and discovery.

  byBroad returns truncated content (content_head/mid/tail ~100 chars each) instead of full content.
  Use it to scan large collections, then drill into specific memories with other search tools.

  Available sort_field values for byProperty:
  Emotions (0-1): feel_emotional_significance, feel_vulnerability, feel_trauma, feel_humor, feel_happiness, feel_sadness, feel_fear, feel_anger, feel_surprise, feel_disgust, feel_contempt, feel_embarrassment, feel_shame, feel_guilt, feel_excitement, feel_pride, feel_intensity, feel_coherence_tension
  Affect dimensions: feel_valence (-1 to 1), feel_arousal (0-1), feel_dominance (0-1)
  Functional signals (0-1): functional_salience, functional_urgency, functional_social_weight, functional_agency, functional_novelty, functional_retrieval_utility, functional_narrative_importance, functional_aesthetic_quality, functional_valence, functional_coherence_tension
  Composite scores: feel_significance, functional_significance, total_significance
  Core: weight, trust_score, confidence, strength, relationship_count, version, access_count
  Ratings: rating_sum, rating_count, rating_bayesian
  REM metadata: rem_visits (times scored by REM)

  byProperty examples:
  - { mode: "byProperty", sort_field: "feel_trauma", sort_order: "desc" } — most traumatic
  - { mode: "byProperty", sort_field: "feel_humor", sort_order: "desc" } — funniest
  - { mode: "byProperty", sort_field: "functional_retrieval_utility", sort_order: "desc" } — most useful
  - { mode: "byProperty", sort_field: "rem_visits", sort_order: "asc" } — least scored by REM
  - { mode: "byProperty", sort_field: "total_significance", sort_order: "desc" } — most significant overall
  - { mode: "byProperty", sort_field: "functional_novelty", sort_order: "desc" } — most novel`,
  inputSchema: {
    type: 'object',
    properties: {
      mode: {
        type: 'string',
        enum: ['byTime', 'byDensity', 'byRating', 'byDiscovery', 'byProperty', 'bySignificance', 'byBroad', 'byRandom'],
        description: 'Search mode to use',
      },
      query: {
        type: 'string',
        description: 'Optional search query (used within mode for filtering)',
      },
      sort_order: {
        type: 'string',
        enum: ['asc', 'desc'],
        description: 'Sort order (byTime, byDensity, byRating, byProperty, bySignificance). Default: desc',
      },
      sort_field: {
        type: 'string',
        description: 'Property to sort by (byProperty mode only). Any Weaviate property: feel_trauma, feel_salience, weight, total_significance, rem_visits, etc.',
      },
      limit: {
        type: 'number',
        description: 'Max results. Default: 10',
        minimum: 1,
        maximum: 100,
      },
      offset: {
        type: 'number',
        description: 'Pagination offset',
        minimum: 0,
      },
      filters: {
        type: 'object',
        description: 'Standard search filters',
        properties: {
          types: {
            type: 'array',
            items: { type: 'string' },
            description: 'Include specific content types',
          },
          exclude_types: {
            type: 'array',
            items: { type: 'string' },
            description: 'Exclude specific content types',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
          },
          weight_min: { type: 'number' },
          weight_max: { type: 'number' },
          trust_min: { type: 'number' },
          trust_max: { type: 'number' },
          date_from: {
            type: 'string',
            description: 'ISO 8601',
          },
          date_to: {
            type: 'string',
            description: 'ISO 8601',
          },
          rating_min: {
            type: 'number',
            description: 'Minimum Bayesian rating',
          },
          relationship_count_min: { type: 'number' },
          relationship_count_max: { type: 'number' },
          has_relationships: { type: 'boolean' },
        },
      },
      deleted_filter: {
        type: 'string',
        enum: ['exclude', 'include', 'only'],
        description: 'Default: exclude',
      },
    },
    required: ['mode'],
  },
};

/**
 * Search by arguments
 */
export interface SearchByArgs {
  mode: SearchByMode;
  query?: string;
  sort_order?: 'asc' | 'desc';
  sort_field?: string;
  limit?: number;
  offset?: number;
  filters?: {
    types?: string[];
    exclude_types?: string[];
    tags?: string[];
    weight_min?: number;
    weight_max?: number;
    trust_min?: number;
    trust_max?: number;
    date_from?: string;
    date_to?: string;
    rating_min?: number;
    relationship_count_min?: number;
    relationship_count_max?: number;
    has_relationships?: boolean;
  };
  deleted_filter?: 'exclude' | 'include' | 'only';
}

/**
 * Handle remember_search_by tool
 */
export async function handleSearchBy(
  args: SearchByArgs,
  userId: string,
  authContext?: AuthContext
): Promise<string> {
  const ghostMode = authContext?.ghostMode;
  const searchUserId = ghostMode?.owner_user_id ?? userId;
  const debug = createDebugLogger({ tool: 'remember_search_by', userId: searchUserId, operation: `search by ${args.mode}` });
  try {
    debug.info('Tool invoked');
    debug.trace('Arguments', { args, ghostMode: !!ghostMode });

    const { memory } = createCoreServices(searchUserId);

    const ghostContext = ghostMode
      ? {
          accessor_trust_level: ghostMode.accessor_trust_level as any,
          owner_user_id: ghostMode.owner_user_id,
        }
      : undefined;

    const limit = args.limit ?? 10;
    const offset = args.offset ?? 0;

    // Cast filters — MCP receives string[] from LLM, core expects ContentType[]
    const filters = args.filters as any;

    let result;
    switch (args.mode) {
      case 'byTime':
        result = await memory.byTime({
          limit,
          offset,
          direction: args.sort_order ?? 'desc',
          filters,
          deleted_filter: args.deleted_filter,
          ghost_context: ghostContext,
        });
        break;

      case 'byDensity':
        result = await memory.byDensity({
          limit,
          offset,
          filters,
          deleted_filter: args.deleted_filter,
          ghost_context: ghostContext,
        });
        break;

      case 'byRating':
        result = await memory.byRating({
          limit,
          offset,
          direction: args.sort_order ?? 'desc',
          filters,
          deleted_filter: args.deleted_filter,
          ghost_context: ghostContext,
        });
        break;

      case 'byDiscovery':
        result = await memory.byDiscovery({
          limit,
          offset,
          filters,
          deleted_filter: args.deleted_filter,
          ghost_context: ghostContext,
        });
        break;

      case 'byProperty': {
        if (!args.sort_field) {
          return JSON.stringify({
            error: 'sort_field is required for byProperty mode. Provide a Weaviate property name (e.g., "feel_trauma", "weight", "total_significance").',
          });
        }
        result = await memory.byProperty({
          sort_field: args.sort_field,
          sort_direction: args.sort_order ?? 'desc',
          limit,
          offset,
          filters,
          deleted_filter: args.deleted_filter,
          ghost_context: ghostContext,
        });
        break;
      }

      case 'bySignificance': {
        result = await memory.byProperty({
          sort_field: 'total_significance',
          sort_direction: args.sort_order ?? 'desc',
          limit,
          offset,
          filters,
          deleted_filter: args.deleted_filter,
          ghost_context: ghostContext,
        });
        break;
      }

      case 'byBroad': {
        result = await memory.byBroad({
          query: args.query,
          sort_order: args.sort_order,
          limit: limit,
          offset,
          filters,
          deleted_filter: args.deleted_filter,
          ghost_context: ghostContext,
        });
        break;
      }

      case 'byRandom': {
        result = await memory.byRandom({
          limit,
          filters,
          deleted_filter: args.deleted_filter,
          ghost_context: ghostContext,
        });
        break;
      }

      default:
        return JSON.stringify({
          error: `Unknown mode: ${(args as any).mode}. Valid modes: byTime, byDensity, byRating, byDiscovery`,
        });
    }

    return JSON.stringify(result, null, 2);
  } catch (error) {
    debug.error('Tool failed', { error: error instanceof Error ? error.message : String(error) });
    handleToolError(error, {
      toolName: 'remember_search_by',
      operation: `search by ${args.mode}`,
      userId: searchUserId,
      mode: args.mode,
    });
  }
}
