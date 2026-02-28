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
} from '@prmichaelsen/remember-core';
import type { Logger } from '@prmichaelsen/remember-core';
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

/**
 * Create core services scoped to a specific user.
 * Call after databases have been initialized (initWeaviateClient + initFirestore).
 */
export function createCoreServices(userId: string): CoreServices {
  const collection = getMemoryCollection(userId);
  const weaviateClient = getWeaviateClient();

  return {
    memory: new MemoryService(collection, userId, coreLogger),
    relationship: new RelationshipService(collection, userId, coreLogger),
    space: new SpaceService(weaviateClient, collection, userId, tokenService, coreLogger),
    preferences: preferencesService,
    token: tokenService,
  };
}

export { coreLogger, tokenService, preferencesService };
