/**
 * Space Memory type definitions for remember-mcp
 * 
 * Space memories are memories published to shared collections
 * where they can be discovered by other users.
 */

import type { Memory, SearchOptions, SearchResult } from './memory.js';

/**
 * Space memory - a memory published to a shared space
 * 
 * Extends Memory with additional fields for attribution and discovery
 */
export interface SpaceMemory extends Omit<Memory, 'user_id' | 'doc_type'> {
  /**
   * Space identifier (snake_case)
   * Examples: 'the_void', 'public_space'
   */
  space_id: string;

  /**
   * Original author's user_id (for permissions)
   * This is private and not shown publicly
   */
  author_id: string;

  /**
   * Optional ghost profile ID for pseudonymous publishing
   * If present, memory is attributed to ghost instead of user
   */
  ghost_id?: string;

  /**
   * When the memory was published to the space
   */
  published_at: string;

  /**
   * How many times this memory has been discovered/viewed
   */
  discovery_count: number;

  /**
   * Attribution type
   * - 'user': Published as the user (shows author_id)
   * - 'ghost': Published as a ghost (shows ghost_id)
   */
  attribution: 'user' | 'ghost';

  /**
   * Document type discriminator
   * Always 'space_memory' for space memories
   */
  doc_type: 'space_memory';
}

/**
 * Search options for space memories
 * Same as SearchOptions but for space collections
 */
export interface SpaceSearchOptions extends Omit<SearchOptions, 'include_relationships'> {
  /**
   * Space to search
   */
  space: string;
}

/**
 * Search result for space memories
 */
export interface SpaceSearchResult extends Omit<SearchResult, 'memories' | 'relationships'> {
  /**
   * Found space memories
   */
  space_memories: SpaceMemory[];
}

/**
 * Supported space IDs
 */
export type SpaceId = 'the_void';

/**
 * Space display names mapped to IDs
 */
export const SPACE_DISPLAY_NAMES: Record<SpaceId, string> = {
  the_void: 'The Void',
};

/**
 * Supported spaces constant
 */
export const SUPPORTED_SPACES: SpaceId[] = ['the_void'];
