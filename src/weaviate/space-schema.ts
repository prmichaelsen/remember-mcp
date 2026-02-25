/**
 * Weaviate space collection schema and utilities
 *
 * Manages shared space collections where users can publish memories
 * for discovery by other users.
 */

import weaviate, { type WeaviateClient, type Collection } from 'weaviate-client';
import { config } from '../config.js';
import { SUPPORTED_SPACES, type SpaceId } from '../types/space-memory.js';
import { logger } from '../utils/logger.js';

/**
 * Unified public collection name for all public spaces
 */
export const PUBLIC_COLLECTION_NAME = 'Memory_public';

/**
 * Get collection name for a space
 *
 * @deprecated Use PUBLIC_COLLECTION_NAME instead. Will be removed in v3.0.0.
 * @param spaceId - Space identifier (snake_case)
 * @returns Collection name in format Memory_{space_id}
 *
 * @example
 * getSpaceCollectionName('the_void') // Returns 'Memory_the_void'
 */
export function getSpaceCollectionName(spaceId: string): string {
  return `Memory_${spaceId}`;
}

/**
 * Sanitize display name to space ID
 * 
 * Converts display names like "The Void" to snake_case IDs like "the_void"
 * 
 * @param displayName - Display name with spaces and mixed case
 * @returns snake_case space ID
 * 
 * @example
 * sanitizeSpaceId('The Void') // Returns 'the_void'
 * sanitizeSpaceId('Public Space') // Returns 'public_space'
 */
export function sanitizeSpaceId(displayName: string): string {
  return displayName.toLowerCase().replace(/\s+/g, '_');
}

/**
 * Get display name for a space ID
 * 
 * @param spaceId - Space identifier
 * @returns Display name or the space ID if not found
 * 
 * @example
 * getSpaceDisplayName('the_void') // Returns 'The Void'
 */
export function getSpaceDisplayName(spaceId: string): string {
  const { SPACE_DISPLAY_NAMES } = require('../types/space-memory.js');
  return SPACE_DISPLAY_NAMES[spaceId as SpaceId] || spaceId;
}

/**
 * Validate space ID
 * 
 * @param spaceId - Space identifier to validate
 * @returns True if valid, false otherwise
 */
export function isValidSpaceId(spaceId: string): boolean {
  return SUPPORTED_SPACES.includes(spaceId as SpaceId);
}

/**
 * Create a space collection with schema
 * 
 * @param client - Weaviate client
 * @param spaceId - Space identifier
 */
async function createSpaceCollection(
  client: WeaviateClient,
  spaceId: string
): Promise<void> {
  // Handle 'public' as special case for unified collection
  const collectionName = spaceId === 'public'
    ? PUBLIC_COLLECTION_NAME
    : getSpaceCollectionName(spaceId);

  logger.info('Creating space collection', {
    module: 'weaviate-space-schema',
    collectionName,
    spaceId,
  });

  // Create collection with schema (same as Memory schema but for spaces)
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
        description: 'Document type: "space_memory"',
      },

      // Space identity
      {
        name: 'spaces',
        dataType: 'text[]' as any,
        description: 'Spaces this memory is published to (e.g., ["the_void", "dogs"])',
      },
      {
        name: 'author_id',
        dataType: 'text' as any,
        description: 'Original author user_id (for permissions)',
      },
      {
        name: 'ghost_id',
        dataType: 'text' as any,
        description: 'Optional ghost profile ID for pseudonymous publishing',
      },
      {
        name: 'attribution',
        dataType: 'text' as any,
        description: 'Attribution type: "user" or "ghost"',
      },

      // Discovery metadata
      {
        name: 'published_at',
        dataType: 'text' as any,
        description: 'When published to space (ISO 8601)',
      },
      {
        name: 'discovery_count',
        dataType: 'number' as any,
        description: 'How many times discovered',
      },

      // Memory fields (same as personal memories)
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

      // Location fields (flattened) - MUST match user memory schema exactly
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

      // Context fields (flattened) - MUST match user memory schema exactly
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

      // Locale fields - MUST match user memory schema exactly
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

      // Relationships - MUST match user memory schema exactly
      {
        name: 'relationships',
        dataType: 'text[]' as any,
        description: 'Array of relationship IDs',
      },

      // Access tracking - MUST match user memory schema exactly
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

      // Metadata - MUST match user memory schema exactly
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
        name: 'template_id',
        dataType: 'text' as any,
        description: 'Template ID if using template',
      },

      // Relationship-specific fields (for relationships in public space)
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

      // Computed fields - MUST match user memory schema exactly
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

      // User ID field (for backwards compatibility with spread operator)
      {
        name: 'user_id',
        dataType: 'text' as any,
        description: 'User ID (copied from original memory, same as author_id)',
      },

      // Timestamps
      {
        name: 'created_at',
        dataType: 'text' as any,
        description: 'Original creation timestamp (ISO 8601)',
      },
      {
        name: 'updated_at',
        dataType: 'text' as any,
        description: 'Last update timestamp (ISO 8601)',
      },

      // Versioning
      {
        name: 'version',
        dataType: 'number' as any,
        description: 'Version number (increments on update)',
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

  logger.info('Space collection created successfully', {
    module: 'weaviate-space-schema',
    collectionName,
  });
}

/**
 * Ensure the unified public collection exists, creating it if needed
 *
 * @param client - Weaviate client
 * @returns Collection reference to Memory_public
 *
 * @example
 * const collection = await ensurePublicCollection(client);
 */
export async function ensurePublicCollection(
  client: WeaviateClient
): Promise<Collection<any>> {
  const collectionName = PUBLIC_COLLECTION_NAME;

  // Check if collection exists
  const exists = await client.collections.exists(collectionName);
  
  if (!exists) {
    // Create with proper vectorizer configuration
    // Use 'public' as spaceId to trigger PUBLIC_COLLECTION_NAME
    await createSpaceCollection(client, 'public');
  }

  return client.collections.get(collectionName);
}

/**
 * Ensure a space collection exists, creating it if needed
 *
 * @deprecated Use ensurePublicCollection() instead. Will be removed in v3.0.0.
 * @param client - Weaviate client
 * @param spaceId - Space identifier
 * @returns Collection reference
 *
 * @example
 * const collection = await ensureSpaceCollection(client, 'the_void');
 */
export async function ensureSpaceCollection(
  client: WeaviateClient,
  spaceId: string
): Promise<Collection<any>> {
  // Validate space ID
  if (!isValidSpaceId(spaceId)) {
    throw new Error(`Invalid space ID: ${spaceId}. Supported spaces: ${SUPPORTED_SPACES.join(', ')}`);
  }

  const collectionName = getSpaceCollectionName(spaceId);

  // Check if collection exists
  const exists = await client.collections.exists(collectionName);
  
  if (!exists) {
    await createSpaceCollection(client, spaceId);
  }

  return client.collections.get(collectionName);
}
