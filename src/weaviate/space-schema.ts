/**
 * Weaviate space collection schema and utilities
 * 
 * Manages shared space collections where users can publish memories
 * for discovery by other users.
 */

import weaviate, { type WeaviateClient, type Collection } from 'weaviate-client';
import { config } from '../config.js';
import { SUPPORTED_SPACES, type SpaceId } from '../types/space-memory.js';

/**
 * Get collection name for a space
 * 
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
  const collectionName = getSpaceCollectionName(spaceId);

  console.log(`[Weaviate] Creating space collection ${collectionName}...`);

  // Create collection with schema (same as Memory schema but for spaces)
  await client.collections.create({
    name: collectionName,

    // Vectorizer configuration
    vectorizers: weaviate.configure.vectorizer.text2VecOpenAI({
      model: 'text-embedding-3-small',
      // Vectorize content for semantic search
      sourceProperties: ['content', 'observation'],
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
        name: 'space_id',
        dataType: 'text' as any,
        description: 'Space identifier (e.g., "the_void")',
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

      // Location fields (flattened)
      {
        name: 'location_gps_latitude',
        dataType: 'number' as any,
        description: 'GPS latitude',
      },
      {
        name: 'location_gps_longitude',
        dataType: 'number' as any,
        description: 'GPS longitude',
      },
      {
        name: 'location_address_formatted',
        dataType: 'text' as any,
        description: 'Formatted address',
      },
      {
        name: 'location_address_city',
        dataType: 'text' as any,
        description: 'City',
      },
      {
        name: 'location_address_country',
        dataType: 'text' as any,
        description: 'Country',
      },

      // Context fields (flattened)
      {
        name: 'context_conversation_id',
        dataType: 'text' as any,
        description: 'Conversation ID',
      },
      {
        name: 'context_platform',
        dataType: 'text' as any,
        description: 'Platform where created',
      },

      // Tags and relationships
      {
        name: 'tags',
        dataType: 'text[]' as any,
        description: 'Tags for categorization',
      },
      {
        name: 'related_memory_ids',
        dataType: 'text[]' as any,
        description: 'IDs of related memories',
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
    ],
  });

  console.log(`[Weaviate] Space collection ${collectionName} created successfully`);
}

/**
 * Ensure a space collection exists, creating it if needed
 * 
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
