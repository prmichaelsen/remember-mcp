/**
 * Dot Notation Collection Utilities
 * 
 * Provides utilities for working with Memory Collection Pattern v2's
 * dot notation collection naming scheme.
 * 
 * Collection Types:
 * - USERS: Memory_users_{userId} - Private user memories
 * - SPACES: Memory_spaces_public - All public space memories
 * - GROUPS: Memory_groups_{groupId} - Group memories
 */

/**
 * Collection type enum for Memory Collection Pattern v2
 */
export enum CollectionType {
  USERS = 'USERS',
  SPACES = 'SPACES',
  GROUPS = 'GROUPS',
}

/**
 * Metadata about a parsed collection
 */
export interface CollectionMetadata {
  type: CollectionType
  id?: string
  name: string
}

/**
 * Error thrown when collection name is invalid
 */
export class InvalidCollectionNameError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidCollectionNameError'
  }
}

/**
 * Get the Weaviate collection name for a given type and optional ID
 * 
 * @param type - Collection type (USERS, SPACES, or GROUPS)
 * @param id - Optional ID (required for USERS and GROUPS, not used for SPACES)
 * @returns Weaviate collection name
 * 
 * @example
 * getCollectionName(CollectionType.USERS, 'user123')
 * // Returns: 'Memory_users_user123'
 * 
 * @example
 * getCollectionName(CollectionType.SPACES)
 * // Returns: 'Memory_spaces_public'
 * 
 * @example
 * getCollectionName(CollectionType.GROUPS, 'group456')
 * // Returns: 'Memory_groups_group456'
 */
export function getCollectionName(type: CollectionType, id?: string): string {
  switch (type) {
    case CollectionType.USERS:
      if (!id) {
        throw new InvalidCollectionNameError('User ID is required for USERS collection type')
      }
      if (id.includes('.')) {
        throw new InvalidCollectionNameError(`User ID cannot contain dots: ${id}`)
      }
      return `Memory_users_${id}`
    
    case CollectionType.SPACES:
      // SPACES collection is always public, ID is not used
      return 'Memory_spaces_public'
    
    case CollectionType.GROUPS:
      if (!id) {
        throw new InvalidCollectionNameError('Group ID is required for GROUPS collection type')
      }
      if (id.includes('.')) {
        throw new InvalidCollectionNameError(`Group ID cannot contain dots: ${id}`)
      }
      return `Memory_groups_${id}`
    
    default:
      throw new InvalidCollectionNameError(`Unknown collection type: ${type}`)
  }
}

/**
 * Parse a collection name into its components
 * 
 * @param name - Weaviate collection name
 * @returns Collection metadata with type, optional ID, and name
 * 
 * @example
 * parseCollectionName('Memory_users_user123')
 * // Returns: { type: CollectionType.USERS, id: 'user123', name: 'Memory_users_user123' }
 * 
 * @example
 * parseCollectionName('Memory_spaces_public')
 * // Returns: { type: CollectionType.SPACES, id: undefined, name: 'Memory_spaces_public' }
 * 
 * @example
 * parseCollectionName('Memory_groups_group456')
 * // Returns: { type: CollectionType.GROUPS, id: 'group456', name: 'Memory_groups_group456' }
 */
export function parseCollectionName(name: string): CollectionMetadata {
  // Match pattern: Memory_{type}_{id} or Memory_{type}_public
  const match = name.match(/^Memory_(users|spaces|groups)_(.+)$/)
  
  if (!match) {
    throw new InvalidCollectionNameError(
      `Invalid collection name format: ${name}. Expected format: Memory_{type}_{id}`
    )
  }
  
  const [, typeStr, idOrPublic] = match
  
  switch (typeStr) {
    case 'users':
      return {
        type: CollectionType.USERS,
        id: idOrPublic,
        name,
      }
    
    case 'spaces':
      if (idOrPublic !== 'public') {
        throw new InvalidCollectionNameError(
          `Invalid SPACES collection name: ${name}. Expected: Memory_spaces_public`
        )
      }
      return {
        type: CollectionType.SPACES,
        id: undefined,
        name,
      }
    
    case 'groups':
      return {
        type: CollectionType.GROUPS,
        id: idOrPublic,
        name,
      }
    
    default:
      throw new InvalidCollectionNameError(`Unknown collection type: ${typeStr}`)
  }
}

/**
 * Validate a collection name
 * 
 * @param name - Collection name to validate
 * @returns true if valid, false otherwise
 * 
 * @example
 * validateCollectionName('Memory_users_user123') // true
 * validateCollectionName('Memory_spaces_public') // true
 * validateCollectionName('Invalid_name') // false
 */
export function validateCollectionName(name: string): boolean {
  try {
    parseCollectionName(name)
    return true
  } catch (error) {
    if (error instanceof InvalidCollectionNameError) {
      return false
    }
    throw error
  }
}

/**
 * Check if a collection name is a user collection
 * 
 * @param name - Collection name to check
 * @returns true if user collection, false otherwise
 */
export function isUserCollection(name: string): boolean {
  try {
    const metadata = parseCollectionName(name)
    return metadata.type === CollectionType.USERS
  } catch {
    return false
  }
}

/**
 * Check if a collection name is the spaces collection
 * 
 * @param name - Collection name to check
 * @returns true if spaces collection, false otherwise
 */
export function isSpacesCollection(name: string): boolean {
  return name === 'Memory_spaces_public'
}

/**
 * Check if a collection name is a group collection
 * 
 * @param name - Collection name to check
 * @returns true if group collection, false otherwise
 */
export function isGroupCollection(name: string): boolean {
  try {
    const metadata = parseCollectionName(name)
    return metadata.type === CollectionType.GROUPS
  } catch {
    return false
  }
}
