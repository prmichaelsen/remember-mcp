/**
 * Weaviate schema definitions for remember-mcp
 * Based on agent/design/weaviate-collection-strategy.md
 */

import weaviate, { WeaviateClient } from 'weaviate-client';
import { getWeaviateClient } from './client.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { createUserCollectionSchema } from '../schema/v2-collections.js';

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
  const collectionName = `Memory_users_${userId}`;

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

  // Create collection using v2 schema
  const schema = createUserCollectionSchema(userId);
  await client.collections.create(schema);

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
  const collectionName = `Memory_users_${userId}`;

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
  const collectionName = `Memory_users_${userId}`;
  return client.collections.get(collectionName);
}

/**
 * Delete Memory collection for user (use with caution!)
 */
export async function deleteMemoryCollection(userId: string): Promise<void> {
  const client = getWeaviateClient();
  const collectionName = `Memory_users_${userId}`;

  const exists = await client.collections.exists(collectionName);

  if (exists) {
    await client.collections.delete(collectionName);
    logger.info('Memory collection deleted', {
      module: 'weaviate-schema',
      collectionName,
    });
  }
}
