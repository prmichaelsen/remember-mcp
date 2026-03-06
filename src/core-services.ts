/**
 * Bridge module: initializes remember-core services from remember-mcp infrastructure.
 *
 * Core services are scoped per-user (MemoryService, RelationshipService, SpaceService)
 * except PreferencesDatabaseService and ConfirmationTokenService which are singletons.
 */

import {
  MemoryService,
  RelationshipService,
  SpaceService,
  PreferencesDatabaseService,
  ConfirmationTokenService,
  createLogger,
  createModerationClient,
} from '@prmichaelsen/remember-core';
import type { Logger, ModerationClient } from '@prmichaelsen/remember-core';
import { getWeaviateClient } from './weaviate/client.js';
import { getMemoryCollection } from './weaviate/schema.js';

export interface CoreServices {
  memory: MemoryService;
  relationship: RelationshipService;
  space: SpaceService;
  preferences: PreferencesDatabaseService;
  token: ConfirmationTokenService;
}

// Singletons — shared across all user scopes
const coreLogger: Logger = createLogger('info');
const tokenService = new ConfirmationTokenService(coreLogger);
const preferencesService = new PreferencesDatabaseService(coreLogger);
const moderationClient: ModerationClient | undefined = process.env.ANTHROPIC_API_KEY
  ? createModerationClient({ apiKey: process.env.ANTHROPIC_API_KEY })
  : undefined;

/** Cached CoreServices per userId — avoids re-instantiation on every tool call */
const coreServicesCache = new Map<string, CoreServices>();

/**
 * Create (or return cached) core services scoped to a specific user.
 * Call after databases have been initialized (initWeaviateClient + initFirestore).
 */
export function createCoreServices(userId: string): CoreServices {
  const cached = coreServicesCache.get(userId);
  if (cached) return cached;

  const collection = getMemoryCollection(userId);
  const weaviateClient = getWeaviateClient();

  const services: CoreServices = {
    memory: new MemoryService(collection, userId, coreLogger),
    relationship: new RelationshipService(collection, userId, coreLogger),
    space: new SpaceService(weaviateClient, collection, userId, tokenService, coreLogger, { moderationClient }),
    preferences: preferencesService,
    token: tokenService,
  };

  coreServicesCache.set(userId, services);
  return services;
}

/** Clear the core services cache (for tests or forced refresh) */
export function invalidateCoreServicesCache(): void {
  coreServicesCache.clear();
}

export { coreLogger, tokenService, preferencesService };
