/**
 * remember_update_relationship tool
 * Update an existing relationship with partial updates
 */

import { handleToolError } from '../utils/error-handler.js';
import { createDebugLogger } from '../utils/debug.js';
import type { AuthContext } from '../types/auth.js';
import { createCoreServices } from '../core-services.js';

/**
 * Tool definition for remember_update_relationship
 */
export const updateRelationshipTool = {
  name: 'remember_update_relationship',
  description: `Update an existing relationship with partial updates.
  
  Supports updating relationship_type, observation, strength, confidence, and tags.
  Version number is automatically incremented and updated_at is set.
  Only provided fields are updated (partial updates supported).
  
  Examples:
  - "Update that relationship to increase the strength"
  - "Change the observation text for the camping relationship"
  - "Add tags to the inspiration relationship"
  `,
  inputSchema: {
    type: 'object',
    properties: {
      relationship_id: {
        type: 'string',
        description: 'ID of the relationship to update',
      },
      relationship_type: {
        type: 'string',
        description: 'Updated relationship type',
      },
      observation: {
        type: 'string',
        description: 'Updated observation/description',
      },
      strength: {
        type: 'number',
        description: 'Updated strength (0-1)',
        minimum: 0,
        maximum: 1,
      },
      confidence: {
        type: 'number',
        description: 'Updated confidence (0-1)',
        minimum: 0,
        maximum: 1,
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Updated tags (replaces existing tags)',
      },
    },
    required: ['relationship_id'],
  },
};

/**
 * Update relationship arguments
 */
export interface UpdateRelationshipArgs {
  relationship_id: string;
  relationship_type?: string;
  observation?: string;
  strength?: number;
  confidence?: number;
  tags?: string[];
}

/**
 * Update relationship result
 */
export interface UpdateRelationshipResult {
  relationship_id: string;
  updated_at: string;
  version: number;
  updated_fields: string[];
  message: string;
}

/**
 * Handle remember_update_relationship tool
 */
export async function handleUpdateRelationship(
  args: UpdateRelationshipArgs,
  userId: string,
  authContext?: AuthContext
): Promise<string> {
  const debug = createDebugLogger({ tool: 'remember_update_relationship', userId, operation: 'update relationship' });

  try {
    debug.info('Tool invoked');
    debug.trace('Arguments', { args });

    const { relationship } = createCoreServices(userId);
    const result = await relationship.update({
      relationship_id: args.relationship_id,
      relationship_type: args.relationship_type,
      observation: args.observation,
      strength: args.strength,
      confidence: args.confidence,
      tags: args.tags,
    });

    const response: UpdateRelationshipResult = {
      relationship_id: result.relationship_id,
      updated_at: result.updated_at,
      version: result.version,
      updated_fields: result.updated_fields,
      message: `Relationship updated successfully. Updated fields: ${result.updated_fields.join(', ')}`,
    };

    return JSON.stringify(response, null, 2);
  } catch (error) {
    debug.error('Tool failed', { error: error instanceof Error ? error.message : String(error) });
    handleToolError(error, {
      toolName: 'remember_update_relationship',
      operation: 'update relationship',
      userId,
      relationshipId: args.relationship_id,
      updatedFields: Object.keys(args).filter(k => k !== 'relationship_id'),
    });
  }
}
