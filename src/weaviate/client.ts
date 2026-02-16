import weaviate, { WeaviateClient } from 'weaviate-client';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

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
 * Weaviate collection names must start with uppercase letter and contain only alphanumeric
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
 * Get collection name for user's memories
 */
export function getMemoryCollectionName(userId: string): string {
  return `Memory_${sanitizeUserId(userId)}`;
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
 * Centralized to ensure consistency across all tools
 */
export const ALL_MEMORY_PROPERTIES = [
  'user_id',
  'doc_type',
  'type',
  'title',
  'content',
  'tags',
  'weight',
  'base_weight',
  'trust',  // ✅ Fixed: was 'trust_level', schema has 'trust'
  'confidence',
  'context',
  'location',
  'relationships',
  'created_at',
  'updated_at',
  'version',
  'attribution',
  'source_url',
  'author',
  'parent_id',
  'thread_root_id',
  'moderation_flags',
] as const;

/**
 * Fetch a memory object by ID with all properties
 *
 * This utility ensures all memory properties are fetched consistently
 * across all tools, preventing bugs where properties are missing.
 *
 * @param collection - Weaviate collection
 * @param memoryId - Memory ID to fetch
 * @returns Memory object with all properties
 */
export async function fetchMemoryWithAllProperties(
  collection: any,
  memoryId: string
) {
  return await collection.query.fetchObjectById(memoryId, {
    returnProperties: ALL_MEMORY_PROPERTIES,
  });
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
