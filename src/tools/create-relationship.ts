/**
 * remember_create_relationship tool
 * Create a relationship connecting 2...N memories
 */

import type { Relationship, MemoryContext } from '../types/memory.js';
import { ensureMemoryCollection, getMemoryCollection } from '../weaviate/schema.js';
import { logger } from '../utils/logger.js';
import { handleToolError } from '../utils/error-handler.js';
import { createDebugLogger } from '../utils/debug.js';
import type { AuthContext } from '../types/auth.js';

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

    logger.info('Creating relationship', {
      userId,
      type: args.relationship_type,
      memoryCount: args.memory_ids.length
    });

    // Validate memory_ids count
    if (args.memory_ids.length < 2) {
      throw new Error('At least 2 memory IDs are required to create a relationship');
    }

    // Ensure collection exists
    await ensureMemoryCollection(userId);
    const collection = getMemoryCollection(userId);

    // Verify all memories exist and belong to user
    logger.info('Validating memories', { userId, memoryIds: args.memory_ids });
    
    const memoryChecks = await Promise.all(
      args.memory_ids.map(async (memoryId) => {
        try {
          const memory = await collection.query.fetchObjectById(memoryId, {
            returnProperties: ['user_id', 'doc_type', 'relationship_ids', 'deleted_at'],
          });
          
          if (!memory) {
            logger.warn('Memory not found', { userId, memoryId });
            return { memoryId, error: 'Memory not found' };
          }
          
          if (memory.properties.user_id !== userId) {
            logger.warn('Unauthorized memory access attempt', {
              userId,
              memoryId,
              actualUserId: memory.properties.user_id
            });
            return { memoryId, error: 'Unauthorized: Memory belongs to another user' };
          }
          
          if (memory.properties.doc_type !== 'memory') {
            logger.warn('Invalid doc_type for relationship', {
              userId,
              memoryId,
              docType: memory.properties.doc_type
            });
            return { memoryId, error: 'Cannot create relationship with non-memory document' };
          }
          
          // Check if memory is deleted
          if (memory.properties.deleted_at) {
            const deletedAt = typeof memory.properties.deleted_at === 'string'
              ? memory.properties.deleted_at
              : new Date(memory.properties.deleted_at as any).toISOString();
            logger.warn('Attempt to create relationship with deleted memory', {
              userId,
              memoryId,
              deletedAt
            });
            return { memoryId, error: `Memory is deleted (deleted on ${deletedAt})` };
          }
          
          return {
            memoryId,
            memory,
            relationships: (memory.properties.relationship_ids as string[]) || []
          };
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          logger.error('Failed to fetch memory for relationship', {
            userId,
            memoryId,
            error: errorMsg
          });
          return { memoryId, error: `Failed to fetch memory: ${errorMsg}` };
        }
      })
    );

    // Check for errors
    const errors = memoryChecks.filter(check => check.error);
    if (errors.length > 0) {
      const errorMessages = errors.map(e => `${e.memoryId}: ${e.error}`).join('; ');
      logger.error('Memory validation failed', {
        userId,
        errorCount: errors.length,
        errors: errorMessages
      });
      throw new Error(`Memory validation failed: ${errorMessages}`);
    }
    
    logger.info('All memories validated successfully', {
      userId,
      validatedCount: memoryChecks.length
    });

    // Build relationship object
    const now = new Date().toISOString();
    const relationship: Record<string, any> = {
      // Core identity
      user_id: userId,
      doc_type: 'relationship',

      // Connection
      related_memory_ids: args.memory_ids,
      relationship_type: args.relationship_type,

      // Observation
      observation: args.observation,
      strength: args.strength ?? 0.5,
      confidence: args.confidence ?? 0.8,

      // Context
      context: {
        timestamp: now,
        source: {
          type: 'api',
          platform: 'mcp',
        },
        summary: context?.summary || 'Relationship created via MCP',
        conversation_id: context?.conversation_id,
        ...context,
      },

      // Metadata
      created_at: now,
      updated_at: now,
      version: 1,
      tags: args.tags || [],
    };

    // Insert relationship into Weaviate v3 API
    // v3 expects: { properties: {...} }
    const relationshipId = await collection.data.insert({
      properties: relationship as any,
    });

    logger.info('Relationship created, updating connected memories', { 
      relationshipId, 
      userId 
    });

    // Update all connected memories with bidirectional reference
    const updatePromises = memoryChecks
      .filter(check => !check.error && check.memory)
      .map(async (check) => {
        try {
          const existingRelationships = check.relationships || [];
          const updatedRelationships = [...existingRelationships, relationshipId];
          
          await collection.data.update({
            id: check.memoryId,
            properties: {
              relationship_ids: updatedRelationships,
              updated_at: now,
            },
          });
          
          return { memoryId: check.memoryId, success: true };
        } catch (error) {
          logger.warn(`Failed to update memory ${check.memoryId} with relationship:`, error);
          return { memoryId: check.memoryId, success: false, error };
        }
      });

    const updateResults = await Promise.all(updatePromises);
    const failedUpdates = updateResults.filter(r => !r.success);
    
    if (failedUpdates.length > 0) {
      logger.warn('Some memory updates failed', { failedUpdates });
    }

    logger.info('Relationship created successfully', { 
      relationshipId, 
      userId,
      updatedMemories: updateResults.filter(r => r.success).length
    });

    const response: CreateRelationshipResult = {
      relationship_id: relationshipId,
      memory_ids: args.memory_ids,
      relationship_type: args.relationship_type,
      created_at: now,
      message: `Relationship created successfully with ID: ${relationshipId}. Connected ${args.memory_ids.length} memories.`,
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
      observation: args.observation?.substring(0, 100), // First 100 chars
    });
  }
}
