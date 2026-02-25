/**
 * Weaviate schema definitions for remember-mcp
 * Based on agent/design/weaviate-collection-strategy.md
 */

import weaviate, { WeaviateClient } from 'weaviate-client';
import { getWeaviateClient, sanitizeUserId } from './client.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

/**
 * Create Memory collection schema for a user
 * 
 * This collection stores BOTH memories AND relationships using doc_type discriminator.
 * This unified approach enables:
 * - Single query for memories with relationships
 * - Semantic search across both memories and relationship observations
 * - Better RAG context (LLM gets memories + connections together)
 * 
 * @param userId - User identifier
 */
export async function createMemoryCollection(userId: string): Promise<void> {
  const client = getWeaviateClient();
  const collectionName = `Memory_${sanitizeUserId(userId)}`;

  // Check if collection already exists
  const exists = await client.collections.exists(collectionName);
  if (exists) {
    logger.debug('Collection already exists', {
      module: 'weaviate-schema',
      collectionName,
    });
    return;
  }

  logger.info('Creating memory collection', {
    module: 'weaviate-schema',
    collectionName,
  });

  // Create collection with schema
  await client.collections.create({
    name: collectionName,
    
    // Vectorizer configuration
    vectorizers: weaviate.configure.vectorizer.text2VecOpenAI({
      model: 'text-embedding-3-small',
      // Vectorize content, title, summary, and observation for semantic search
      // Note: title and summary are optional fields
      sourceProperties: ['content', 'title', 'summary', 'observation'],
    }),

    // Inverted index configuration
    // indexNullState: true is required for filtering on null values (e.g., deleted_at IS NULL)
    invertedIndex: weaviate.configure.invertedIndex({
      indexNullState: true,
    }),

    properties: [
      // Discriminator
      {
        name: 'doc_type',
        dataType: 'text' as any,
        description: 'Document type: "memory" or "relationship"',
      },

      // Core identity
      {
        name: 'user_id',
        dataType: 'text' as any,
        description: 'User who owns this document',
      },

      // Memory fields
      {
        name: 'content',
        dataType: 'text' as any,
        description: 'Main memory content (vectorized)',
      },
      {
        name: 'title',
        dataType: 'text' as any,
        description: 'Optional short title',
      },
      {
        name: 'summary',
        dataType: 'text' as any,
        description: 'Optional brief summary',
      },
      {
        name: 'type',
        dataType: 'text' as any,
        description: 'Content type (note, event, person, etc.)',
      },

      // Scoring fields
      {
        name: 'weight',
        dataType: 'number' as any,
        description: 'Significance/priority (0-1)',
      },
      {
        name: 'trust',
        dataType: 'number' as any,
        description: 'Access control level (0-1)',
      },
      {
        name: 'confidence',
        dataType: 'number' as any,
        description: 'System confidence in accuracy (0-1)',
      },

      // Location fields (flattened for Weaviate)
      {
        name: 'location_gps_lat',
        dataType: 'number' as any,
        description: 'GPS latitude',
      },
      {
        name: 'location_gps_lng',
        dataType: 'number' as any,
        description: 'GPS longitude',
      },
      {
        name: 'location_address',
        dataType: 'text' as any,
        description: 'Formatted address',
      },
      {
        name: 'location_city',
        dataType: 'text' as any,
        description: 'City name',
      },
      {
        name: 'location_country',
        dataType: 'text' as any,
        description: 'Country name',
      },
      {
        name: 'location_source',
        dataType: 'text' as any,
        description: 'Location source (gps, ip, manual, etc.)',
      },

      // Locale fields
      {
        name: 'locale_language',
        dataType: 'text' as any,
        description: 'Language code (e.g., en, es, fr)',
      },
      {
        name: 'locale_timezone',
        dataType: 'text' as any,
        description: 'Timezone (e.g., America/Los_Angeles)',
      },

      // Context fields
      {
        name: 'context_conversation_id',
        dataType: 'text' as any,
        description: 'Conversation ID',
      },
      {
        name: 'context_summary',
        dataType: 'text' as any,
        description: 'Brief context summary',
      },
      {
        name: 'context_timestamp',
        dataType: 'date' as any,
        description: 'Context timestamp',
      },

      // Relationships
      {
        name: 'relationships',
        dataType: 'text[]' as any,
        description: 'Array of relationship IDs',
      },

      // Access tracking
      {
        name: 'access_count',
        dataType: 'number' as any,
        description: 'Total times accessed',
      },
      {
        name: 'last_accessed_at',
        dataType: 'date' as any,
        description: 'Most recent access timestamp',
      },

      // Metadata
      {
        name: 'tags',
        dataType: 'text[]' as any,
        description: 'Tags for organization',
      },
      {
        name: 'references',
        dataType: 'text[]' as any,
        description: 'Source URLs',
      },
      {
        name: 'created_at',
        dataType: 'date' as any,
        description: 'Creation timestamp',
      },
      {
        name: 'updated_at',
        dataType: 'date' as any,
        description: 'Last update timestamp',
      },
      {
        name: 'version',
        dataType: 'number' as any,
        description: 'Version number',
      },

      // Template fields
      {
        name: 'template_id',
        dataType: 'text' as any,
        description: 'Template ID if using template',
      },

      // Relationship-specific fields
      {
        name: 'memory_ids',
        dataType: 'text[]' as any,
        description: 'Connected memory IDs (for relationships)',
      },
      {
        name: 'relationship_type',
        dataType: 'text' as any,
        description: 'Relationship type (for relationships)',
      },
      {
        name: 'observation',
        dataType: 'text' as any,
        description: 'Relationship observation (vectorized)',
      },
      {
        name: 'strength',
        dataType: 'number' as any,
        description: 'Relationship strength (0-1)',
      },

      // Computed fields
      {
        name: 'base_weight',
        dataType: 'number' as any,
        description: 'User-specified weight',
      },
      {
        name: 'computed_weight',
        dataType: 'number' as any,
        description: 'Calculated effective weight',
      },

      // Comment/threading fields (for threaded discussions in shared spaces)
      {
        name: 'parent_id',
        dataType: 'text' as any,
        description: 'ID of parent memory or comment (for threading)',
      },
      {
        name: 'thread_root_id',
        dataType: 'text' as any,
        description: 'Root memory ID for fetching entire thread',
      },
      {
        name: 'moderation_flags',
        dataType: 'text[]' as any,
        description: 'Per-space moderation flags (format: "{space_id}:{flag_type}")',
      },

      // Soft delete fields
      {
        name: 'deleted_at',
        dataType: 'date' as any,
        description: 'Timestamp when memory was soft-deleted (null = not deleted)',
      },
      {
        name: 'deleted_by',
        dataType: 'text' as any,
        description: 'User ID who deleted the memory',
      },
      {
        name: 'deletion_reason',
        dataType: 'text' as any,
        description: 'Optional reason for deletion',
      },
    ],
  });

  logger.info('Memory collection created successfully', {
    module: 'weaviate-schema',
    collectionName,
  });
}

/**
 * Ensure Memory collection exists for user (lazy creation)
 */
export async function ensureMemoryCollection(userId: string): Promise<void> {
  const client = getWeaviateClient();
  const collectionName = `Memory_${sanitizeUserId(userId)}`;

  const exists = await client.collections.exists(collectionName);
  
  if (!exists) {
    await createMemoryCollection(userId);
  }
}

/**
 * Get Memory collection for user
 */
export function getMemoryCollection(userId: string) {
  const client = getWeaviateClient();
  const collectionName = `Memory_${sanitizeUserId(userId)}`;
  return client.collections.get(collectionName);
}

/**
 * Delete Memory collection for user (use with caution!)
 */
export async function deleteMemoryCollection(userId: string): Promise<void> {
  const client = getWeaviateClient();
  const collectionName = `Memory_${sanitizeUserId(userId)}`;

  const exists = await client.collections.exists(collectionName);
  
  if (exists) {
    await client.collections.delete(collectionName);
    logger.info('Memory collection deleted', {
      module: 'weaviate-schema',
      collectionName,
    });
  }
}
