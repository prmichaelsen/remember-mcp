/**
 * Shared helpers for e2e tests against e1.
 *
 * Bootstraps Weaviate + Firestore from .env.e1.local,
 * provides auth context factories and collection cleanup.
 */

import dotenv from 'dotenv';
dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || '.env.e1.local', override: true });

import { initWeaviateClient, getWeaviateClient } from './weaviate/client.js';
import { initFirestore } from './firestore/init.js';
import { createMemoryCollection, ensureMemoryCollection, deleteMemoryCollection } from './weaviate/schema.js';
import { invalidateCoreServicesCache } from './core-services.js';
import type { AuthContext } from './types/auth.js';

/** Generate a unique e2e user ID to avoid collisions between runs */
export function e2eUserId(prefix = 'e2e'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/** Simple AuthContext with no ghost mode */
export function e2eAuthContext(): AuthContext {
  return { accessToken: null, credentials: null };
}

/** AuthContext with ghost mode for cross-user tests */
export function e2eGhostAuthContext(ownerUserId: string, accessorUserId: string, trustLevel = 0.5): AuthContext {
  return {
    accessToken: null,
    credentials: null,
    ghostMode: {
      owner_user_id: ownerUserId,
      accessor_user_id: accessorUserId,
      accessor_trust_level: trustLevel,
    },
  };
}

let initialized = false;

/** Initialize databases (idempotent — safe to call many times) */
export async function e2eInit(): Promise<void> {
  if (initialized) return;
  await initWeaviateClient();
  initFirestore();
  initialized = true;
}

/** Ensure user collection exists, creating if needed */
export async function e2eEnsureCollection(userId: string): Promise<void> {
  await ensureMemoryCollection(userId);
}

/** Delete user collection + clear service cache */
export async function e2eCleanup(userId: string): Promise<void> {
  try {
    await deleteMemoryCollection(userId);
  } catch {
    // collection may not exist
  }
  invalidateCoreServicesCache();
}

/** Delete a space or group collection by name */
export async function e2eDeleteCollection(name: string): Promise<void> {
  try {
    const client = getWeaviateClient();
    const exists = await client.collections.exists(name);
    if (exists) {
      await client.collections.delete(name);
    }
  } catch {
    // ignore
  }
}

/** Parse JSON result from a tool handler */
export function parseResult<T = any>(jsonString: string): T {
  return JSON.parse(jsonString) as T;
}

/** Small delay for Weaviate indexing consistency */
export function waitForIndex(ms = 1500): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
