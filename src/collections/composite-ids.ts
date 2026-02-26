/**
 * Composite ID Utilities
 * 
 * Provides utilities for working with composite IDs in Memory Collection Pattern v2.
 * Composite IDs preserve the source reference when memories are published to spaces or groups.
 * 
 * Format: {userId}.{memoryId}
 * Example: "user123.my-recipe"
 */

/**
 * Components of a composite ID
 */
export interface CompositeIdComponents {
  userId: string
  memoryId: string
}

/**
 * Error thrown when composite ID is invalid
 */
export class InvalidCompositeIdError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidCompositeIdError'
  }
}

/**
 * Generate a composite ID from user ID and memory ID
 * 
 * @param userId - User ID (must not contain dots)
 * @param memoryId - Memory ID (must not contain dots)
 * @returns Composite ID in format {userId}.{memoryId}
 * @throws {InvalidCompositeIdError} If userId or memoryId contains dots
 * 
 * @example
 * generateCompositeId('user123', 'my-recipe')
 * // Returns: 'user123.my-recipe'
 */
export function generateCompositeId(userId: string, memoryId: string): string {
  // Validate that neither component contains dots
  if (userId.includes('.')) {
    throw new InvalidCompositeIdError(
      `User ID cannot contain dots: ${userId}`
    )
  }
  
  if (memoryId.includes('.')) {
    throw new InvalidCompositeIdError(
      `Memory ID cannot contain dots: ${memoryId}`
    )
  }
  
  // Validate that components are not empty
  if (!userId.trim()) {
    throw new InvalidCompositeIdError('User ID cannot be empty')
  }
  
  if (!memoryId.trim()) {
    throw new InvalidCompositeIdError('Memory ID cannot be empty')
  }
  
  return `${userId}.${memoryId}`
}

/**
 * Parse a composite ID into its components
 * 
 * @param compositeId - Composite ID to parse
 * @returns Object with userId and memoryId
 * @throws {InvalidCompositeIdError} If composite ID format is invalid
 * 
 * @example
 * parseCompositeId('user123.my-recipe')
 * // Returns: { userId: 'user123', memoryId: 'my-recipe' }
 */
export function parseCompositeId(compositeId: string): CompositeIdComponents {
  // Split on first dot only (in case memoryId was generated with dashes that look like dots)
  const parts = compositeId.split('.')
  
  if (parts.length !== 2) {
    throw new InvalidCompositeIdError(
      `Invalid composite ID format: ${compositeId}. Composite ID must be exactly 2 parts separated by a dot. Expected format: {userId}.{memoryId}`
    )
  }
  
  const [userId, memoryId] = parts
  
  // Validate components are not empty
  if (!userId.trim()) {
    throw new InvalidCompositeIdError(
      `Invalid composite ID: ${compositeId}. User ID is empty`
    )
  }
  
  if (!memoryId.trim()) {
    throw new InvalidCompositeIdError(
      `Invalid composite ID: ${compositeId}. Memory ID is empty`
    )
  }
  
  return { userId, memoryId }
}

/**
 * Check if a string is a composite ID
 * 
 * @param id - String to check
 * @returns true if valid composite ID, false otherwise
 * 
 * @example
 * isCompositeId('user123.my-recipe') // true
 * isCompositeId('simple-id') // false
 * isCompositeId('too.many.dots') // false
 */
export function isCompositeId(id: string): boolean {
  try {
    parseCompositeId(id)
    return true
  } catch (error) {
    if (error instanceof InvalidCompositeIdError) {
      return false
    }
    throw error
  }
}

/**
 * Validate a composite ID (returns true on valid, throws on invalid)
 *
 * @param id - Composite ID to validate
 * @returns true if valid
 * @throws {InvalidCompositeIdError} If composite ID is invalid
 *
 * @example
 * validateCompositeId('user123.my-recipe') // Returns true
 * validateCompositeId('invalid') // Throws InvalidCompositeIdError
 */
export function validateCompositeId(id: string): true {
  parseCompositeId(id) // Will throw if invalid
  return true
}

/**
 * Extract user ID from a composite ID
 * 
 * @param compositeId - Composite ID
 * @returns User ID component
 * 
 * @example
 * getUserIdFromComposite('user123.my-recipe')
 * // Returns: 'user123'
 */
export function getUserIdFromComposite(compositeId: string): string {
  const { userId } = parseCompositeId(compositeId)
  return userId
}

/**
 * Extract memory ID from a composite ID
 * 
 * @param compositeId - Composite ID
 * @returns Memory ID component
 * 
 * @example
 * getMemoryIdFromComposite('user123.my-recipe')
 * // Returns: 'my-recipe'
 */
export function getMemoryIdFromComposite(compositeId: string): string {
  const { memoryId } = parseCompositeId(compositeId)
  return memoryId
}

/**
 * Check if an ID belongs to a specific user
 * 
 * @param compositeId - Composite ID to check
 * @param userId - User ID to match
 * @returns true if composite ID belongs to user, false otherwise
 * 
 * @example
 * belongsToUser('user123.my-recipe', 'user123') // true
 * belongsToUser('user123.my-recipe', 'user456') // false
 */
export function belongsToUser(compositeId: string, userId: string): boolean {
  try {
    const { userId: idUserId } = parseCompositeId(compositeId)
    return idUserId === userId
  } catch {
    return false
  }
}
