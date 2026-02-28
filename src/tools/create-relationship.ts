/**
 * remember_create_relationship tool
 * Create a relationship connecting 2...N memories
 */

import type { MemoryContext } from '../types/memory.js';
import { handleToolError } from '../utils/error-handler.js';
import { createDebugLogger } from '../utils/debug.js';
import type { AuthContext } from '../types/auth.js';
import { createCoreServices } from '../core-services.js';

/**
 * Tool definition for remember_create_relationship
 */
export const createRelationshipTool = {
  name: 'remember_create_relationship',
  description: `Create a relationship connecting 2 or more memories.
  
  Relationships describe how memories are connected with free-form types.
  Each relationship has an observation (description), strength, and confidence.
  Bidirectional: connected memories are automatically updated with the relationship ID.
  
  Examples:
  - "The Yosemite trip inspired my Sequoia planning"
  - "My tent purchase was caused by the camping trip"
  - "This recipe contradicts my previous cooking notes"
  `,
  inputSchema: {
    type: 'object',
    properties: {
      memory_ids: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of 2 or more memory IDs to connect',
        minItems: 2,
      },
      relationship_type: {
        type: 'string',
        description: 'Type of relationship (free-form): "inspired_by", "contradicts", "caused_by", "related_to", etc.',
      },
      observation: {
        type: 'string',
        description: 'Description of the connection (will be vectorized for semantic search)',
      },
      strength: {
        type: 'number',
        description: 'Strength of the relationship (0-1, default: 0.5)',
        minimum: 0,
        maximum: 1,
      },
      confidence: {
        type: 'number',
        description: 'Confidence in this relationship (0-1, default: 0.8)',
        minimum: 0,
        maximum: 1,
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Tags for organization',
      },
    },
    required: ['memory_ids', 'relationship_type', 'observation'],
  },
};

/**
 * Create relationship arguments
 */
export interface CreateRelationshipArgs {
  memory_ids: string[];
  relationship_type: string;
  observation: string;
  strength?: number;
  confidence?: number;
  tags?: string[];
}

/**
 * Create relationship result
 */
export interface CreateRelationshipResult {
  relationship_id: string;
  memory_ids: string[];
  relationship_type: string;
  created_at: string;
  message: string;
}

/**
 * Handle remember_create_relationship tool
 */
export async function handleCreateRelationship(
  args: CreateRelationshipArgs,
  userId: string,
  authContext?: AuthContext,
  context?: Partial<MemoryContext>
): Promise<string> {
  const debug = createDebugLogger({ tool: 'remember_create_relationship', userId, operation: 'create relationship' });

  try {
    debug.info('Tool invoked');
    debug.trace('Arguments', { args });

    const { relationship } = createCoreServices(userId);
    const result = await relationship.create({
      memory_ids: args.memory_ids,
      relationship_type: args.relationship_type,
      observation: args.observation,
      strength: args.strength,
      confidence: args.confidence,
      tags: args.tags,
    });

    const response: CreateRelationshipResult = {
      relationship_id: result.relationship_id,
      memory_ids: result.memory_ids,
      relationship_type: args.relationship_type,
      created_at: result.created_at,
      message: `Relationship created successfully with ID: ${result.relationship_id}. Connected ${args.memory_ids.length} memories.`,
    };

    return JSON.stringify(response, null, 2);
  } catch (error) {
    debug.error('Tool failed', { error: error instanceof Error ? error.message : String(error) });
    handleToolError(error, {
      toolName: 'remember_create_relationship',
      operation: 'create relationship',
      userId,
      memoryIds: args.memory_ids.join(', '),
      memoryCount: args.memory_ids.length,
      relationshipType: args.relationship_type,
      observation: args.observation?.substring(0, 100),
    });
  }
}
