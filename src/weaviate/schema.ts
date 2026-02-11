/**
 * Weaviate schema definitions for remember-mcp
 * Based on agent/design/weaviate-collection-strategy.md
 */

import weaviate, { WeaviateClient } from 'weaviate-client';
import { getWeaviateClient, sanitizeUserId } from './client.js';
import { config } from '../config.js';

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
    console.log(`[Weaviate] Collection ${collectionName} already exists`);
    return;
  }

  console.log(`[Weaviate] Creating collection ${collectionName}...`);

  // Create collection with schema
  await client.collections.create({
    name: collectionName,
    
    // Vectorizer configuration
    vectorizers: weaviate.configure.vectorizer.text2VecOpenAI({
      model: 'text-embedding-3-small',
      // Vectorize both memory content and relationship observations
      sourceProperties: ['content', 'observation'],
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
    ],
  });

  console.log(`[Weaviate] Collection ${collectionName} created successfully`);
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
    console.log(`[Weaviate] Collection ${collectionName} deleted`);
  }
}
