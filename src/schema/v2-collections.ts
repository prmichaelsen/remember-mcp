/**
 * Weaviate Schema Definitions for Memory Collection Pattern v2
 * 
 * Defines schemas for the three collection types:
 * 1. Memory_users_{userId} - User's private memories
 * 2. Memory_spaces_public - Shared space memories
 * 3. Memory_groups_{groupId} - Group memories
 */

import weaviate, { WeaviateClient, configure } from 'weaviate-client';

/**
 * Common properties shared across all memory collection types
 */
const COMMON_MEMORY_PROPERTIES = [
  // Core identity
  { name: 'id', dataType: 'text' as any },
  { name: 'content', dataType: 'text' as any },
  { name: 'content_type', dataType: 'text' as any },
  
  // Tracking arrays (v2 feature)
  { name: 'space_ids', dataType: 'text[]' as any },
  { name: 'group_ids', dataType: 'text[]' as any },
  
  // Metadata
  { name: 'created_at', dataType: 'date' as any },
  { name: 'updated_at', dataType: 'date' as any },
  { name: 'version', dataType: 'int' as any },
  
  // User context
  { name: 'user_id', dataType: 'text' as any },
  
  // Document type (memory, relationship, comment)
  { name: 'doc_type', dataType: 'text' as any },
  
  // Memory-specific fields
  { name: 'tags', dataType: 'text[]' as any },
  { name: 'weight', dataType: 'number' as any },
  { name: 'trust_score', dataType: 'number' as any },
  
  // Location data
  { name: 'location_name', dataType: 'text' as any },
  { name: 'location_lat', dataType: 'number' as any },
  { name: 'location_lon', dataType: 'number' as any },
  
  // Context
  { name: 'context_app', dataType: 'text' as any },
  { name: 'context_url', dataType: 'text' as any },
  { name: 'context_conversation_id', dataType: 'text' as any },
  
  // Relationships
  { name: 'relationship_ids', dataType: 'text[]' as any },
  { name: 'relationship_type', dataType: 'text' as any },
  { name: 'related_memory_ids', dataType: 'text[]' as any },
  { name: 'observation', dataType: 'text' as any },
  
  // Comments (Phase 1)
  { name: 'parent_id', dataType: 'text' as any },
  { name: 'thread_root_id', dataType: 'text' as any },
  { name: 'moderation_flags', dataType: 'text[]' as any },
  
  // Soft delete
  { name: 'deleted_at', dataType: 'date' as any },
  { name: 'deleted_by', dataType: 'text' as any },
  { name: 'deletion_reason', dataType: 'text' as any },
];

/**
 * Additional properties for published memories (spaces and groups)
 */
const PUBLISHED_MEMORY_PROPERTIES = [
  // Publication metadata
  { name: 'published_at', dataType: 'date' as any },
  { name: 'revised_at', dataType: 'date' as any },
  
  // Attribution
  { name: 'author_id', dataType: 'text' as any },
  { name: 'ghost_id', dataType: 'text' as any },
  { name: 'attribution', dataType: 'text' as any },
  
  // Discovery
  { name: 'discovery_count', dataType: 'int' as any },
  
  // Revision tracking
  { name: 'revision_count', dataType: 'int' as any },
  { name: 'original_memory_id', dataType: 'text' as any },
  
  // Legacy compatibility (deprecated but kept for migration)
  { name: 'spaces', dataType: 'text[]' as any },
  { name: 'space_id', dataType: 'text' as any },
  { name: 'space_memory_id', dataType: 'text' as any },
];

/**
 * Create schema for a user's private memory collection
 * 
 * @param userId - The user ID
 * @returns Weaviate collection schema configuration
 * 
 * @example
 * ```typescript
 * const schema = createUserCollectionSchema('user123')
 * await client.collections.create(schema)
 * ```
 */
export function createUserCollectionSchema(userId: string) {
  const collectionName = `Memory_users_${userId}`;
  
  return {
    name: collectionName,
    description: `Private memory collection for user: ${userId}`,
    
    // Vector configuration
    vectorizer: configure.vectorizer.text2VecOpenAI({
      model: 'text-embedding-3-small',
      dimensions: 1536,
      vectorizeCollectionName: false,
    }),
    
    // Properties
    properties: COMMON_MEMORY_PROPERTIES,
    
    // Inverted index configuration
    invertedIndex: configure.invertedIndex({
      indexNullState: true,
      indexPropertyLength: true,
      indexTimestamps: true,
    }),
  };
}

/**
 * Create schema for the shared spaces collection
 * 
 * @returns Weaviate collection schema configuration
 * 
 * @example
 * ```typescript
 * const schema = createSpaceCollectionSchema()
 * await client.collections.create(schema)
 * ```
 */
export function createSpaceCollectionSchema() {
  const collectionName = 'Memory_spaces_public';
  
  return {
    name: collectionName,
    description: 'Shared memory collection for all public spaces',
    
    // Vector configuration
    vectorizer: configure.vectorizer.text2VecOpenAI({
      model: 'text-embedding-3-small',
      dimensions: 1536,
      vectorizeCollectionName: false,
    }),
    
    // Properties (common + published)
    properties: [
      ...COMMON_MEMORY_PROPERTIES,
      ...PUBLISHED_MEMORY_PROPERTIES,
    ],
    
    // Inverted index configuration
    invertedIndex: configure.invertedIndex({
      indexNullState: true,
      indexPropertyLength: true,
      indexTimestamps: true,
    }),
  };
}

/**
 * Create schema for a group memory collection
 * 
 * @param groupId - The group ID
 * @returns Weaviate collection schema configuration
 * 
 * @example
 * ```typescript
 * const schema = createGroupCollectionSchema('group456')
 * await client.collections.create(schema)
 * ```
 */
export function createGroupCollectionSchema(groupId: string) {
  const collectionName = `Memory_groups_${groupId}`;
  
  return {
    name: collectionName,
    description: `Group memory collection for group: ${groupId}`,
    
    // Vector configuration
    vectorizer: configure.vectorizer.text2VecOpenAI({
      model: 'text-embedding-3-small',
      dimensions: 1536,
      vectorizeCollectionName: false,
    }),
    
    // Properties (common + published)
    properties: [
      ...COMMON_MEMORY_PROPERTIES,
      ...PUBLISHED_MEMORY_PROPERTIES,
    ],
    
    // Inverted index configuration
    invertedIndex: configure.invertedIndex({
      indexNullState: true,
      indexPropertyLength: true,
      indexTimestamps: true,
    }),
  };
}

/**
 * Ensure a user collection exists (create if needed)
 * 
 * @param client - Weaviate client
 * @param userId - The user ID
 * @returns True if collection was created, false if it already existed
 */
export async function ensureUserCollection(
  client: WeaviateClient,
  userId: string
): Promise<boolean> {
  const collectionName = `Memory_users_${userId}`;
  
  try {
    // Check if collection exists
    const exists = await client.collections.exists(collectionName);
    
    if (exists) {
      return false;
    }
    
    // Create collection
    const schema = createUserCollectionSchema(userId);
    await client.collections.create(schema);
    
    return true;
  } catch (error) {
    throw new Error(`Failed to ensure user collection for ${userId}: ${(error as Error).message}`);
  }
}

/**
 * Ensure the spaces collection exists (create if needed)
 * 
 * @param client - Weaviate client
 * @returns True if collection was created, false if it already existed
 */
export async function ensureSpaceCollection(client: WeaviateClient): Promise<boolean> {
  const collectionName = 'Memory_spaces_public';
  
  try {
    // Check if collection exists
    const exists = await client.collections.exists(collectionName);
    
    if (exists) {
      return false;
    }
    
    // Create collection
    const schema = createSpaceCollectionSchema();
    await client.collections.create(schema);
    
    return true;
  } catch (error) {
    throw new Error(`Failed to ensure space collection: ${(error as Error).message}`);
  }
}

/**
 * Ensure a group collection exists (create if needed)
 * 
 * @param client - Weaviate client
 * @param groupId - The group ID
 * @returns True if collection was created, false if it already existed
 */
export async function ensureGroupCollection(
  client: WeaviateClient,
  groupId: string
): Promise<boolean> {
  const collectionName = `Memory_groups_${groupId}`;
  
  try {
    // Check if collection exists
    const exists = await client.collections.exists(collectionName);
    
    if (exists) {
      return false;
    }
    
    // Create collection
    const schema = createGroupCollectionSchema(groupId);
    await client.collections.create(schema);
    
    return true;
  } catch (error) {
    throw new Error(`Failed to ensure group collection for ${groupId}: ${(error as Error).message}`);
  }
}

/**
 * Get all property names for user collections
 * 
 * @returns Array of property names
 */
export function getUserCollectionProperties(): string[] {
  return COMMON_MEMORY_PROPERTIES.map(prop => prop.name);
}

/**
 * Get all property names for space/group collections
 * 
 * @returns Array of property names
 */
export function getPublishedCollectionProperties(): string[] {
  return [
    ...COMMON_MEMORY_PROPERTIES,
    ...PUBLISHED_MEMORY_PROPERTIES,
  ].map(prop => prop.name);
}

/**
 * Validate that a collection name matches the expected v2 pattern
 * 
 * @param collectionName - The collection name to validate
 * @returns True if valid
 * @throws Error if invalid
 */
export function validateV2CollectionName(collectionName: string): boolean {
  const userPattern = /^Memory_users_[a-zA-Z0-9_-]+$/;
  const spacePattern = /^Memory_spaces_public$/;
  const groupPattern = /^Memory_groups_[a-zA-Z0-9_-]+$/;
  
  if (
    userPattern.test(collectionName) ||
    spacePattern.test(collectionName) ||
    groupPattern.test(collectionName)
  ) {
    return true;
  }
  
  throw new Error(
    `Invalid v2 collection name: ${collectionName}. ` +
    `Must match: Memory_users_{userId}, Memory_spaces_public, or Memory_groups_{groupId}`
  );
}

/**
 * Get the collection type from a collection name
 * 
 * @param collectionName - The collection name
 * @returns 'users', 'spaces', or 'groups'
 */
export function getCollectionType(collectionName: string): 'users' | 'spaces' | 'groups' {
  if (collectionName.startsWith('Memory_users_')) {
    return 'users';
  }
  if (collectionName === 'Memory_spaces_public') {
    return 'spaces';
  }
  if (collectionName.startsWith('Memory_groups_')) {
    return 'groups';
  }
  
  throw new Error(`Unknown collection type for: ${collectionName}`);
}

/**
 * Extract the ID from a user or group collection name
 * 
 * @param collectionName - The collection name
 * @returns The user ID or group ID
 */
export function extractIdFromCollectionName(collectionName: string): string | null {
  if (collectionName.startsWith('Memory_users_')) {
    return collectionName.replace('Memory_users_', '');
  }
  if (collectionName.startsWith('Memory_groups_')) {
    return collectionName.replace('Memory_groups_', '');
  }
  if (collectionName === 'Memory_spaces_public') {
    return null; // Spaces collection has no specific ID
  }
  
  throw new Error(`Cannot extract ID from: ${collectionName}`);
}
