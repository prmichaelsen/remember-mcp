import weaviate, { WeaviateClient } from 'weaviate-client';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { createDebugLogger } from '../utils/debug.js';

let client: WeaviateClient | null = null;

/**
 * Initialize Weaviate client
 *
 * Connection strategy:
 * - If WEAVIATE_REST_URL is set → use cloud connection (remote/self-hosted)
 * - If URL contains localhost/127.0.0.1 → use local connection
 * - Otherwise → use cloud connection (remote/self-hosted)
 */
export async function initWeaviateClient(): Promise<WeaviateClient> {
  if (client) {
    return client;
  }

  const weaviateUrl = config.weaviate.url;
  
  // Check if URL is localhost (use local connection)
  // Everything else uses cloud connection (remote/self-hosted)
  const isLocal = weaviateUrl.includes('localhost') || weaviateUrl.includes('127.0.0.1');
  
  // Use appropriate connection method
  if (!isLocal) {
    // Use connectToWeaviateCloud() for ALL remote instances (cloud or self-hosted)
    logger.info('Connecting to remote Weaviate', {
      module: 'weaviate-client',
      url: weaviateUrl,
    });
    client = await weaviate.connectToWeaviateCloud(weaviateUrl, {
      authCredentials: config.weaviate.apiKey
        ? new weaviate.ApiKey(config.weaviate.apiKey)
        : undefined,
      headers: config.openai.apiKey
        ? { 'X-OpenAI-Api-Key': config.openai.apiKey }
        : undefined,
    });
  } else {
    // connectToLocal() for localhost only
    logger.info('Connecting to local Weaviate', {
      module: 'weaviate-client',
      url: weaviateUrl,
    });
    const localConfig: any = {
      host: weaviateUrl.replace(/^https?:\/\//, '').split(':')[0],
      port: weaviateUrl.includes(':')
        ? parseInt(weaviateUrl.split(':').pop() || '8080')
        : 8080,
      scheme: weaviateUrl.startsWith('https') ? 'https' : 'http',
    };
    
    if (config.weaviate.apiKey) {
      localConfig.authClientSecret = new weaviate.ApiKey(config.weaviate.apiKey);
    }
    
    if (config.openai.apiKey) {
      localConfig.headers = { 'X-OpenAI-Api-Key': config.openai.apiKey };
    }
    
    client = await weaviate.connectToLocal(localConfig);
  }

  logger.info('Weaviate client initialized successfully', {
    module: 'weaviate-client',
    isLocal,
  });
  return client;
}

/**
 * Get Weaviate client instance
 */
export function getWeaviateClient(): WeaviateClient {
  if (!client) {
    throw new Error('Weaviate client not initialized. Call initWeaviateClient() first.');
  }
  return client;
}

/**
 * Test Weaviate connection
 */
export async function testWeaviateConnection(): Promise<boolean> {
  try {
    const weaviateClient = getWeaviateClient();
    const isReady = await weaviateClient.isReady();
    logger.info('Weaviate connection test successful', {
      module: 'weaviate-client',
      isReady,
    });
    return isReady;
  } catch (error) {
    logger.error('Weaviate connection test failed', {
      module: 'weaviate-client',
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Sanitize user_id for collection name
 * @deprecated v2 uses literal userId — no sanitization needed. Kept for migration script only.
 */
export function sanitizeUserId(userId: string): string {
  // Remove special characters, keep alphanumeric
  let sanitized = userId.replace(/[^a-zA-Z0-9]/g, '_');

  // If starts with number, prepend underscore
  if (/^[0-9]/.test(sanitized)) {
    sanitized = '_' + sanitized;
  }

  // Ensure starts with uppercase letter
  return sanitized.charAt(0).toUpperCase() + sanitized.slice(1);
}

/**
 * Get collection name for user's memories (v2 format)
 */
export function getMemoryCollectionName(userId: string): string {
  return `Memory_users_${userId}`;
}

/**
 * Get collection name for user's templates
 */
export function getTemplateCollectionName(userId: string): string {
  return `Template_${sanitizeUserId(userId)}`;
}

/**
 * Get collection name for user's audit logs
 */
export function getAuditCollectionName(userId: string): string {
  return `Audit_${sanitizeUserId(userId)}`;
}

/**
 * List of all memory properties to fetch
 * Centralized to ensure consistency across all tools.
 * Includes both v2 canonical names and v1 compat names.
 */
export const ALL_MEMORY_PROPERTIES = [
  // Core identity
  'user_id',
  'doc_type',

  // Memory fields
  'content',
  'content_type', // v2 canonical
  'title',
  'summary',
  'type', // v1 compat (v2: content_type)

  // Scoring fields
  'weight',
  'base_weight',
  'trust_score', // v2 canonical
  'trust', // v1 compat (v2: trust_score)
  'confidence',
  'computed_weight',

  // Location fields (v2)
  'location_name',
  'location_lat', // v2 canonical
  'location_lon', // v2 canonical
  // Location fields (v1 compat)
  'location_gps_lat',
  'location_gps_lng',
  'location_address',
  'location_city',
  'location_country',
  'location_source',

  // Locale fields
  'locale_language',
  'locale_timezone',

  // Context fields
  'context_conversation_id',
  'context_summary',
  'context_timestamp',
  'context_app',
  'context_url',

  // Relationships (v2)
  'relationship_ids', // v2 canonical
  'related_memory_ids', // v2 canonical
  // Relationships (v1 compat)
  'relationships',
  'memory_ids',
  // Common relationship fields
  'relationship_type',
  'observation',
  'strength',

  // Access tracking
  'access_count',
  'last_accessed_at',

  // Metadata
  'tags',
  'references',
  'created_at',
  'updated_at',
  'version',
  'template_id',

  // Tracking arrays (v2)
  'space_ids',
  'group_ids',

  // Comment/threading fields
  'parent_id',
  'thread_root_id',
  'moderation_flags',

  // Space/publishing fields
  'spaces', // legacy
  'space_id', // legacy
  'author_id',
  'ghost_id',
  'attribution',
  'published_at',
  'discovery_count',
  'space_memory_id', // legacy
  'original_memory_id',
  'revised_at',
  'revision_count',
  'revision_history',

  // Soft delete fields
  'deleted_at',
  'deleted_by',
  'deletion_reason',
] as const;

/**
 * Fetch a memory object by ID with all properties
 *
 * This utility ensures all memory properties are fetched consistently
 * across all tools, preventing bugs where properties are missing.
 *
 * NOTE: Some properties may not exist on all records (e.g., old records
 * created before schema updates). This function handles that gracefully
 * by falling back to fetching without property specification if the
 * full property query fails.
 *
 * @param collection - Weaviate collection
 * @param memoryId - Memory ID to fetch
 * @returns Memory object with all properties that exist on the record
 */
export async function fetchMemoryWithAllProperties(
  collection: any,
  memoryId: string
) {
  const debug = createDebugLogger({
    tool: 'weaviate-client',
    operation: 'fetchMemoryWithAllProperties',
  });

  debug.debug('Fetching memory', {
    memoryId,
    collectionName: collection.name,
    propertyCount: ALL_MEMORY_PROPERTIES.length,
  });

  try {
    // Try to fetch with all properties specified
    const result = await debug.time('Fetch with all properties', async () => {
      return await collection.query.fetchObjectById(memoryId, {
        returnProperties: ALL_MEMORY_PROPERTIES,
      });
    });
    
    debug.trace('Fetch result', {
      found: !!result,
      propertyCount: result?.properties ? Object.keys(result.properties).length : 0,
      hasSpaces: !!result?.properties?.spaces,
      hasAuthorId: !!result?.properties?.author_id,
    });
    
    return result;
  } catch (error) {
    // If that fails (e.g., property doesn't exist on this record),
    // fetch without specifying properties - Weaviate will return
    // all properties that actually exist on the record
    debug.warn('Fetch with all properties failed, falling back', {
      error: error instanceof Error ? error.message : String(error),
    });
    
    logger.warn('Failed to fetch with all properties, falling back to unspecified fetch', {
      module: 'weaviate-client',
      memoryId,
      error: error instanceof Error ? error.message : String(error),
    });
    
    return await debug.time('Fetch without property specification', async () => {
      return await collection.query.fetchObjectById(memoryId);
    });
  }
}

/**
 * Check if collection exists
 */
export async function collectionExists(collectionName: string): Promise<boolean> {
  try {
    const weaviateClient = getWeaviateClient();
    const exists = await weaviateClient.collections.exists(collectionName);
    return exists;
  } catch (error) {
    logger.error('Error checking collection existence', {
      module: 'weaviate-client',
      collectionName,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Close Weaviate client connection
 */
export async function closeWeaviateClient(): Promise<void> {
  if (client) {
    // Weaviate client doesn't have explicit close method
    client = null;
    logger.info('Weaviate client closed', {
      module: 'weaviate-client',
    });
  }
}
