import weaviate, { WeaviateClient } from 'weaviate-client';
import { config } from '../config.js';

let client: WeaviateClient | null = null;

/**
 * Initialize Weaviate client
 */
export async function initWeaviateClient(): Promise<WeaviateClient> {
  if (client) {
    return client;
  }

  // Weaviate v3 client initialization
  client = await weaviate.connectToWeaviateCloud(config.weaviate.url, {
    authCredentials: config.weaviate.apiKey
      ? new weaviate.ApiKey(config.weaviate.apiKey)
      : undefined,
    headers: config.openai.apiKey
      ? { 'X-OpenAI-Api-Key': config.openai.apiKey }
      : undefined,
  });

  console.log('[Weaviate] Client initialized');
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
    console.log('[Weaviate] Connection successful, ready:', isReady);
    return isReady;
  } catch (error) {
    console.error('[Weaviate] Connection failed:', error);
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
 * Check if collection exists
 */
export async function collectionExists(collectionName: string): Promise<boolean> {
  try {
    const weaviateClient = getWeaviateClient();
    const exists = await weaviateClient.collections.exists(collectionName);
    return exists;
  } catch (error) {
    console.error(`[Weaviate] Error checking collection ${collectionName}:`, error);
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
    console.log('[Weaviate] Client closed');
  }
}
