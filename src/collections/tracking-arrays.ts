/**
 * Tracking Array Management
 * 
 * Provides utilities for managing space_ids and group_ids tracking arrays
 * in Memory Collection Pattern v2. These arrays track where memories have
 * been published.
 */

/**
 * Memory with tracking arrays
 */
export interface MemoryWithTracking {
  space_ids: string[];
  group_ids: string[];
  [key: string]: any; // Allow other properties
}

/**
 * Published locations summary
 */
export interface PublishedLocations {
  spaces: string[]
  groups: string[]
}

/**
 * Add a space ID to the space_ids array (immutable)
 * 
 * @param memory - Memory object with tracking arrays
 * @param spaceId - Space ID to add
 * @returns New memory object with updated space_ids
 * 
 * @example
 * const memory = { space_ids: ['cooking'], group_ids: [] }
 * addToSpaceIds(memory, 'recipes')
 * // Returns: { space_ids: ['cooking', 'recipes'], group_ids: [] }
 */
export function addToSpaceIds<T extends MemoryWithTracking>(
  memory: T,
  spaceId: string
): T {
  // Don't add if already present
  if (memory.space_ids.includes(spaceId)) {
    return memory
  }
  
  return {
    ...memory,
    space_ids: [...memory.space_ids, spaceId],
  }
}

/**
 * Remove a space ID from the space_ids array (immutable)
 * 
 * @param memory - Memory object with tracking arrays
 * @param spaceId - Space ID to remove
 * @returns New memory object with updated space_ids
 * 
 * @example
 * const memory = { space_ids: ['cooking', 'recipes'], group_ids: [] }
 * removeFromSpaceIds(memory, 'cooking')
 * // Returns: { space_ids: ['recipes'], group_ids: [] }
 */
export function removeFromSpaceIds<T extends MemoryWithTracking>(
  memory: T,
  spaceId: string
): T {
  return {
    ...memory,
    space_ids: memory.space_ids.filter(id => id !== spaceId),
  }
}

/**
 * Add a group ID to the group_ids array (immutable)
 * 
 * @param memory - Memory object with tracking arrays
 * @param groupId - Group ID to add
 * @returns New memory object with updated group_ids
 * 
 * @example
 * const memory = { space_ids: [], group_ids: ['family'] }
 * addToGroupIds(memory, 'friends')
 * // Returns: { space_ids: [], group_ids: ['family', 'friends'] }
 */
export function addToGroupIds<T extends MemoryWithTracking>(
  memory: T,
  groupId: string
): T {
  // Don't add if already present
  if (memory.group_ids.includes(groupId)) {
    return memory
  }
  
  return {
    ...memory,
    group_ids: [...memory.group_ids, groupId],
  }
}

/**
 * Remove a group ID from the group_ids array (immutable)
 * 
 * @param memory - Memory object with tracking arrays
 * @param groupId - Group ID to remove
 * @returns New memory object with updated group_ids
 * 
 * @example
 * const memory = { space_ids: [], group_ids: ['family', 'friends'] }
 * removeFromGroupIds(memory, 'family')
 * // Returns: { space_ids: [], group_ids: ['friends'] }
 */
export function removeFromGroupIds<T extends MemoryWithTracking>(
  memory: T,
  groupId: string
): T {
  return {
    ...memory,
    group_ids: memory.group_ids.filter(id => id !== groupId),
  }
}

/**
 * Check if memory is published to a specific space
 * 
 * @param memory - Memory object with tracking arrays
 * @param spaceId - Space ID to check
 * @returns true if published to space, false otherwise
 * 
 * @example
 * const memory = { space_ids: ['cooking'], group_ids: [] }
 * isPublishedToSpace(memory, 'cooking') // true
 * isPublishedToSpace(memory, 'recipes') // false
 */
export function isPublishedToSpace(
  memory: MemoryWithTracking,
  spaceId: string
): boolean {
  return memory.space_ids.includes(spaceId)
}

/**
 * Check if memory is published to a specific group
 * 
 * @param memory - Memory object with tracking arrays
 * @param groupId - Group ID to check
 * @returns true if published to group, false otherwise
 * 
 * @example
 * const memory = { space_ids: [], group_ids: ['family'] }
 * isPublishedToGroup(memory, 'family') // true
 * isPublishedToGroup(memory, 'friends') // false
 */
export function isPublishedToGroup(
  memory: MemoryWithTracking,
  groupId: string
): boolean {
  return memory.group_ids.includes(groupId)
}

/**
 * Get all published locations for a memory
 * 
 * @param memory - Memory object with tracking arrays
 * @returns Object with spaces and groups arrays
 * 
 * @example
 * const memory = { space_ids: ['cooking', 'recipes'], group_ids: ['family'] }
 * getPublishedLocations(memory)
 * // Returns: { spaces: ['cooking', 'recipes'], groups: ['family'] }
 */
export function getPublishedLocations(
  memory: MemoryWithTracking
): PublishedLocations {
  return {
    spaces: [...memory.space_ids],
    groups: [...memory.group_ids],
  }
}

/**
 * Check if memory is published anywhere
 * 
 * @param memory - Memory object with tracking arrays
 * @returns true if published to any space or group, false otherwise
 * 
 * @example
 * const memory = { space_ids: ['cooking'], group_ids: [] }
 * isPublished(memory) // true
 * 
 * const unpublished = { space_ids: [], group_ids: [] }
 * isPublished(unpublished) // false
 */
export function isPublished(memory: MemoryWithTracking): boolean {
  return memory.space_ids.length > 0 || memory.group_ids.length > 0
}

/**
 * Get count of published locations
 * 
 * @param memory - Memory object with tracking arrays
 * @returns Total number of spaces and groups memory is published to
 * 
 * @example
 * const memory = { space_ids: ['cooking', 'recipes'], group_ids: ['family'] }
 * getPublishedCount(memory) // 3
 */
export function getPublishedCount(memory: MemoryWithTracking): number {
  return memory.space_ids.length + memory.group_ids.length
}

/**
 * Initialize tracking arrays on a memory object (immutable)
 * 
 * @param memory - Memory object (may not have tracking arrays)
 * @returns New memory object with initialized tracking arrays
 * 
 * @example
 * const memory = { id: '123', content: 'test' }
 * initializeTracking(memory)
 * // Returns: { id: '123', content: 'test', space_ids: [], group_ids: [] }
 */
export function initializeTracking<T extends Record<string, any>>(
  memory: T
): T & MemoryWithTracking {
  return {
    ...memory,
    space_ids: (memory as any).space_ids || [],
    group_ids: (memory as any).group_ids || [],
  }
}

/**
 * Add multiple space IDs at once (immutable)
 * 
 * @param memory - Memory object with tracking arrays
 * @param spaceIds - Array of space IDs to add
 * @returns New memory object with updated space_ids
 * 
 * @example
 * const memory = { space_ids: ['cooking'], group_ids: [] }
 * addMultipleSpaceIds(memory, ['recipes', 'baking'])
 * // Returns: { space_ids: ['cooking', 'recipes', 'baking'], group_ids: [] }
 */
export function addMultipleSpaceIds<T extends MemoryWithTracking>(
  memory: T,
  spaceIds: string[]
): T {
  const newSpaceIds = [...memory.space_ids]
  
  for (const spaceId of spaceIds) {
    if (!newSpaceIds.includes(spaceId)) {
      newSpaceIds.push(spaceId)
    }
  }
  
  return {
    ...memory,
    space_ids: newSpaceIds,
  }
}

/**
 * Add multiple group IDs at once (immutable)
 * 
 * @param memory - Memory object with tracking arrays
 * @param groupIds - Array of group IDs to add
 * @returns New memory object with updated group_ids
 * 
 * @example
 * const memory = { space_ids: [], group_ids: ['family'] }
 * addMultipleGroupIds(memory, ['friends', 'coworkers'])
 * // Returns: { space_ids: [], group_ids: ['family', 'friends', 'coworkers'] }
 */
export function addMultipleGroupIds<T extends MemoryWithTracking>(
  memory: T,
  groupIds: string[]
): T {
  const newGroupIds = [...memory.group_ids]
  
  for (const groupId of groupIds) {
    if (!newGroupIds.includes(groupId)) {
      newGroupIds.push(groupId)
    }
  }
  
  return {
    ...memory,
    group_ids: newGroupIds,
  }
}
