/**
 * remember_search_internal_memory_by tool
 * Wraps search_by with auto-scoped content type and ghost source filters.
 */

import { handleToolError } from '../utils/error-handler.js';
import { createDebugLogger } from '../utils/debug.js';
import type { AuthContext } from '../types/auth.js';
import { handleSearchBy } from './search-by.js';
import type { SearchByMode } from './search-by.js';
import { buildInternalTags } from '../utils/internal-tags.js';

export const searchInternalMemoryByTool = {
  name: 'remember_search_internal_memory_by',
  description: `Search internal memories (ghost or agent) using specialized sort/discovery modes.
  Automatically scoped to the current session's content type and ghost source.

  Modes:
  - byTime: Chronological sort (newest/oldest first)
  - byDensity: Sort by relationship count (most connected memories)
  - byRating: Sort by Bayesian rating average
  - byDiscovery: Interleaved rated + unrated content for exploration (4:1 ratio)
  - byProperty: Sort by any memory property (e.g., feel_trauma, weight). Requires sort_field.
  - bySignificance: Sort by total_significance (combined emotional + functional score)
  - byBroad: Massive results with truncated content for scan-and-drill-in
  - byRandom: Random sampling for serendipitous rediscovery

  Available sort_field values for byProperty:
  Emotions (0-1): feel_emotional_significance, feel_vulnerability, feel_trauma, feel_humor, feel_happiness, feel_sadness, feel_fear, feel_anger, feel_surprise, feel_disgust, feel_contempt, feel_embarrassment, feel_shame, feel_guilt, feel_excitement, feel_pride, feel_intensity, feel_coherence_tension
  Affect: feel_valence (-1 to 1), feel_arousal (0-1), feel_dominance (0-1)
  Functional (0-1): functional_salience, functional_urgency, functional_social_weight, functional_agency, functional_novelty, functional_retrieval_utility, functional_narrative_importance, functional_aesthetic_quality, functional_valence, functional_coherence_tension
  Composite: feel_significance, functional_significance, total_significance
  Core: weight, trust_score, relationship_count, version
  REM: rem_visits`,
  inputSchema: {
    type: 'object',
    properties: {
      mode: {
        type: 'string',
        enum: ['byTime', 'byDensity', 'byRating', 'byDiscovery', 'byProperty', 'bySignificance', 'byRandom', 'byBroad'],
        description: 'Search mode',
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

export interface SearchInternalMemoryByArgs {
  mode: SearchByMode;
  query?: string;
  sort_order?: 'asc' | 'desc';
  sort_field?: string;
  limit?: number;
  offset?: number;
  deleted_filter?: 'exclude' | 'include' | 'only';
}

export async function handleSearchInternalMemoryBy(
  args: SearchInternalMemoryByArgs,
  userId: string,
  authContext?: AuthContext
): Promise<string> {
  const debug = createDebugLogger({ tool: 'remember_search_internal_memory_by', userId, operation: 'search internal memories by mode' });
  try {
    debug.info('Tool invoked');

    const ctx = authContext?.internalContext;
    if (!ctx) {
      return JSON.stringify({ error: 'Internal context required. X-Internal-Type header must be set.' });
    }

    // Build scope tags for ghost source isolation
    const allTags = buildInternalTags(authContext!);
    const scopeTags = allTags.filter(t => t !== 'ghost' && t !== 'agent');

    return await handleSearchBy(
      {
        mode: args.mode,
        query: args.query,
        sort_order: args.sort_order,
        sort_field: args.sort_field,
        limit: args.limit,
        offset: args.offset,
        filters: {
          types: [ctx.type],
          tags: scopeTags.length > 0 ? scopeTags : undefined,
        },
        deleted_filter: args.deleted_filter,
      },
      userId,
      authContext
    );
  } catch (error) {
    debug.error('Tool failed', { error: error instanceof Error ? error.message : String(error) });
    handleToolError(error, {
      toolName: 'remember_search_internal_memory_by',
      operation: 'search internal memories by mode',
      userId,
    });
  }
}
