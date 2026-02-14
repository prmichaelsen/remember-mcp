/**
 * remember_update_relationship tool
 * Update an existing relationship with partial updates
 */

import type { RelationshipUpdate } from '../types/memory.js';
import { getMemoryCollection } from '../weaviate/schema.js';
import { logger } from '../utils/logger.js';
import { handleToolError } from '../utils/error-handler.js';

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
  userId: string
): Promise<string> {
  try {
    logger.info('Updating relationship', { userId, relationshipId: args.relationship_id });

    const collection = getMemoryCollection(userId);

    // Get existing relationship to verify ownership and get current version
    const existingRelationship = await collection.query.fetchObjectById(args.relationship_id, {
      returnProperties: ['user_id', 'doc_type', 'version', 'relationship_type', 'strength', 'confidence'],
    });

    if (!existingRelationship) {
      throw new Error(`Relationship not found: ${args.relationship_id}`);
    }

    // Verify ownership
    if (existingRelationship.properties.user_id !== userId) {
      throw new Error('Unauthorized: Cannot update another user\'s relationship');
    }

    // Verify it's a relationship (not a memory)
    if (existingRelationship.properties.doc_type !== 'relationship') {
      throw new Error('Cannot update memories using this tool. Use remember_update_memory instead.');
    }

    // Build update object with only provided fields
    const updates: Record<string, any> = {};
    const updatedFields: string[] = [];

    // Update relationship fields
    if (args.relationship_type !== undefined) {
      updates.relationship_type = args.relationship_type;
      updatedFields.push('relationship_type');
    }

    if (args.observation !== undefined) {
      updates.observation = args.observation;
      updatedFields.push('observation');
    }

    if (args.strength !== undefined) {
      if (args.strength < 0 || args.strength > 1) {
        throw new Error('Strength must be between 0 and 1');
      }
      updates.strength = args.strength;
      updatedFields.push('strength');
    }

    if (args.confidence !== undefined) {
      if (args.confidence < 0 || args.confidence > 1) {
        throw new Error('Confidence must be between 0 and 1');
      }
      updates.confidence = args.confidence;
      updatedFields.push('confidence');
    }

    if (args.tags !== undefined) {
      updates.tags = args.tags;
      updatedFields.push('tags');
    }

    // Check if any fields were provided
    if (updatedFields.length === 0) {
      throw new Error('No fields provided for update. At least one field must be specified.');
    }

    // Update metadata
    const now = new Date().toISOString();
    updates.updated_at = now;
    updates.version = (existingRelationship.properties.version as number) + 1;

    // Perform update in Weaviate
    await collection.data.update({
      id: args.relationship_id,
      properties: updates,
    });

    logger.info('Relationship updated successfully', {
      userId,
      relationshipId: args.relationship_id,
      version: updates.version,
      updatedFields,
    });

    const result: UpdateRelationshipResult = {
      relationship_id: args.relationship_id,
      updated_at: now,
      version: updates.version,
      updated_fields: updatedFields,
      message: `Relationship updated successfully. Updated fields: ${updatedFields.join(', ')}`,
    };

    return JSON.stringify(result, null, 2);
  } catch (error) {
    handleToolError(error, {
      toolName: 'remember_update_relationship',
      operation: 'update relationship',
      userId,
      relationshipId: args.relationship_id,
      updatedFields: Object.keys(args).filter(k => k !== 'relationship_id'),
    });
  }
}
