/**
 * remember_search_relationship tool
 * Search relationships by observation text or type
 */

import type { Relationship, DeletedFilter } from '../types/memory.js';
import { handleToolError } from '../utils/error-handler.js';
import { createDebugLogger } from '../utils/debug.js';
import type { AuthContext } from '../types/auth.js';
import { createCoreServices } from '../core-services.js';

/**
 * Tool definition for remember_search_relationship
 */
export const searchRelationshipTool = {
  name: 'remember_search_relationship',
  description: `Search relationships by observation text or relationship type.
  
  Uses semantic search on relationship observations to find connections.
  Can filter by relationship type, strength, and tags.
  Returns relationships with their connected memory IDs.
  
  Examples:
  - "Find relationships about inspiration"
  - "Search for contradicting relationships"
  - "Show me all 'caused_by' relationships"
  `,
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query (semantic search on observation field)',
      },
      relationship_types: {
        type: 'array',
        items: { type: 'string' },
        description: 'Filter by relationship types (e.g., ["inspired_by", "caused_by"])',
      },
      strength_min: {
        type: 'number',
        description: 'Minimum strength (0-1)',
        minimum: 0,
        maximum: 1,
      },
      confidence_min: {
        type: 'number',
        description: 'Minimum confidence (0-1)',
        minimum: 0,
        maximum: 1,
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Filter by tags',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results (default: 10)',
        minimum: 1,
        maximum: 100,
      },
      offset: {
        type: 'number',
        description: 'Offset for pagination (default: 0)',
        minimum: 0,
      },
      deleted_filter: {
        type: 'string',
        enum: ['exclude', 'include', 'only'],
        default: 'exclude',
        description: 'Filter deleted memories: "exclude" (default, hide deleted), "include" (show all), "only" (show only deleted)',
      },
    },
    required: ['query'],
  },
};

/**
 * Search relationship arguments
 */
export interface SearchRelationshipArgs {
  query: string;
  relationship_types?: string[];
  strength_min?: number;
  confidence_min?: number;
  tags?: string[];
  limit?: number;
  offset?: number;
  deleted_filter?: DeletedFilter;
}

/**
 * Search relationship result
 */
export interface SearchRelationshipResult {
  relationships: Relationship[];
  total: number;
  offset: number;
  limit: number;
  message: string;
}

/**
 * Handle remember_search_relationship tool
 */
export async function handleSearchRelationship(
  args: SearchRelationshipArgs,
  userId: string,
  authContext?: AuthContext
): Promise<string> {
  const debug = createDebugLogger({ tool: 'remember_search_relationship', userId, operation: 'search relationship' });

  try {
    debug.info('Tool invoked');
    debug.trace('Arguments', { args });

    const { relationship } = createCoreServices(userId);
    const result = await relationship.search({
      query: args.query,
      relationship_types: args.relationship_types,
      strength_min: args.strength_min,
      confidence_min: args.confidence_min,
      tags: args.tags,
      limit: args.limit,
      offset: args.offset,
      deleted_filter: args.deleted_filter,
    });

    const response: SearchRelationshipResult = {
      relationships: result.relationships as unknown as Relationship[],
      total: result.total,
      offset: result.offset,
      limit: result.limit,
      message: `Found ${result.relationships.length} relationship(s) matching query "${args.query}"`,
    };

    return JSON.stringify(response, null, 2);
  } catch (error) {
    debug.error('Tool failed', { error: error instanceof Error ? error.message : String(error) });
    handleToolError(error, {
      toolName: 'remember_search_relationship',
      operation: 'search relationships',
      userId,
      query: args.query,
      limit: args.limit,
    });
  }
}
