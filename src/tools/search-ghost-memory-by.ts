/**
 * remember_search_ghost_memory_by tool
 * Wraps search_by with hardcoded ghost type filter
 */

import { handleToolError } from '../utils/error-handler.js';
import { createDebugLogger } from '../utils/debug.js';
import type { AuthContext } from '../types/auth.js';
import { handleSearchBy } from './search-by.js';
import type { SearchByMode } from './search-by.js';

export const searchGhostMemoryByTool = {
  name: 'remember_search_ghost_memory_by',
  description: `Search ghost memories using specialized sort/discovery modes. Automatically filters to content_type: ghost.

  Modes:
  - byTime: Chronological sort (newest/oldest first)
  - byDensity: Sort by relationship count (most connected ghost memories)
  - byRating: Sort by Bayesian rating average (social ratings from spaces)
  - byDiscovery: Interleaved rated + unrated content for exploration (4:1 ratio)
  - byProperty: Sort by any memory property (e.g., feel_trauma, weight, feel_salience). Requires sort_field.
  - bySignificance: Sort by total_significance (combined emotional + functional score from REM)
  - byBroad: Massive results with truncated content (content_head/mid/tail ~100 chars each) for scan-and-drill-in workflow
  - byRandom: Random sampling for serendipitous rediscovery

  Use remember_search_ghost_memory for hybrid semantic+keyword search.
  Use this tool for structured browsing, sorting, and discovery of ghost interaction records.

  Available sort_field values for byProperty:
  Emotions (0-1): feel_emotional_significance, feel_vulnerability, feel_trauma, feel_humor, feel_happiness, feel_sadness, feel_fear, feel_anger, feel_surprise, feel_disgust, feel_contempt, feel_embarrassment, feel_shame, feel_guilt, feel_excitement, feel_pride, feel_intensity, feel_coherence_tension
  Affect dimensions: feel_valence (-1 to 1), feel_arousal (0-1), feel_dominance (0-1)
  Functional signals (0-1): functional_salience, functional_urgency, functional_social_weight, functional_agency, functional_novelty, functional_retrieval_utility, functional_narrative_importance, functional_aesthetic_quality, functional_valence, functional_coherence_tension
  Composite scores: feel_significance, functional_significance, total_significance
  Core: weight, trust_score, relationship_count, version
  REM metadata: rem_visits`,
  inputSchema: {
    type: 'object',
    properties: {
      mode: {
        type: 'string',
        enum: ['byTime', 'byDensity', 'byRating', 'byDiscovery', 'byProperty', 'bySignificance', 'byRandom', 'byBroad'],
        description: 'Search mode: byTime (chronological), byDensity (most connected), byRating (highest rated), byDiscovery (explore mix), byProperty (sort by field), bySignificance (emotional+functional score), byRandom (random sample), byBroad (scan many truncated)',
      },
      query: { type: 'string', description: 'Optional search query' },
      sort_order: { type: 'string', enum: ['asc', 'desc'] },
      sort_field: { type: 'string', description: 'Property to sort by (byProperty mode)' },
      limit: { type: 'number' },
      offset: { type: 'number' },
      deleted_filter: { type: 'string', enum: ['exclude', 'include', 'only'] },
    },
    required: ['mode'],
  },
};

export interface SearchGhostMemoryByArgs {
  mode: SearchByMode;
  query?: string;
  sort_order?: 'asc' | 'desc';
  sort_field?: string;
  limit?: number;
  offset?: number;
  deleted_filter?: 'exclude' | 'include' | 'only';
}

export async function handleSearchGhostMemoryBy(
  args: SearchGhostMemoryByArgs,
  userId: string,
  authContext?: AuthContext
): Promise<string> {
  const debug = createDebugLogger({ tool: 'remember_search_ghost_memory_by', userId, operation: 'search ghost memories by mode' });
  try {
    debug.info('Tool invoked');
    debug.trace('Arguments', { args });

    // Delegate to search_by with ghost type filter hardcoded
    return await handleSearchBy(
      {
        mode: args.mode,
        query: args.query,
        sort_order: args.sort_order,
        sort_field: args.sort_field,
        limit: args.limit,
        offset: args.offset,
        filters: {
          types: ['ghost'],
        },
        deleted_filter: args.deleted_filter,
      },
      userId,
      authContext
    );
  } catch (error) {
    debug.error('Tool failed', { error: error instanceof Error ? error.message : String(error) });
    handleToolError(error, {
      toolName: 'remember_search_ghost_memory_by',
      operation: 'search ghost memories by mode',
      userId,
    });
  }
}
