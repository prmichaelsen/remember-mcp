/**
 * Unit tests for Memory Collection Pattern v2 Core Infrastructure
 * 
 * Tests core functionality of:
 * - Dot notation collection utilities
 * - Composite ID utilities  
 * - Tracking array management
 * - Schema definitions
 */

import {
  CollectionType,
  getCollectionName,
  parseCollectionName,
  validateCollectionName,
  isUserCollection,
  isSpacesCollection,
  isGroupCollection,
} from './dot-notation.js';

import {
  generateCompositeId,
  parseCompositeId,
  isCompositeId,
  validateCompositeId,
} from './composite-ids.js';

import {
  addToSpaceIds,
  removeFromSpaceIds,
  addToGroupIds,
  removeFromGroupIds,
  isPublishedToSpace,
  isPublishedToGroup,
  getPublishedLocations,
  isPublished,
  getPublishedCount,
  initializeTracking,
  addMultipleSpaceIds,
  addMultipleGroupIds,
  type MemoryWithTracking,
} from './tracking-arrays.js';

import {
  createUserCollectionSchema,
  createSpaceCollectionSchema,
  createGroupCollectionSchema,
  getUserCollectionProperties,
  getPublishedCollectionProperties,
  validateV2CollectionName,
  getCollectionType,
  extractIdFromCollectionName,
} from '../schema/v2-collections.js';

// ============================================================================
// Dot Notation Collection Utilities Tests
// ============================================================================

describe('Dot Notation Collection Utilities', () => {
  describe('getCollectionName', () => {
    it('should generate user collection name', () => {
      expect(getCollectionName(CollectionType.USERS, 'user123')).toBe('Memory_users_user123');
    });

    it('should generate spaces collection name', () => {
      expect(getCollectionName(CollectionType.SPACES)).toBe('Memory_spaces_public');
    });

    it('should generate group collection name', () => {
      expect(getCollectionName(CollectionType.GROUPS, 'group456')).toBe('Memory_groups_group456');
    });

    it('should throw error for user collection without ID', () => {
      expect(() => getCollectionName(CollectionType.USERS)).toThrow('User ID is required');
    });

    it('should throw error for ID with invalid characters', () => {
      expect(() => getCollectionName(CollectionType.USERS, 'user.123')).toThrow();
    });
  });

  describe('parseCollectionName', () => {
    it('should parse user collection name', () => {
      const result = parseCollectionName('Memory_users_user123');
      expect(result.type).toBe(CollectionType.USERS);
      expect(result.id).toBe('user123');
    });

    it('should parse spaces collection name', () => {
      const result = parseCollectionName('Memory_spaces_public');
      expect(result.type).toBe(CollectionType.SPACES);
      expect(result.id).toBeUndefined();
    });

    it('should parse group collection name', () => {
      const result = parseCollectionName('Memory_groups_group456');
      expect(result.type).toBe(CollectionType.GROUPS);
      expect(result.id).toBe('group456');
    });
  });

  describe('Collection type checkers', () => {
    it('should identify user collections', () => {
      expect(isUserCollection('Memory_users_user123')).toBe(true);
      expect(isUserCollection('Memory_spaces_public')).toBe(false);
    });

    it('should identify spaces collection', () => {
      expect(isSpacesCollection('Memory_spaces_public')).toBe(true);
      expect(isSpacesCollection('Memory_users_user123')).toBe(false);
    });

    it('should identify group collections', () => {
      expect(isGroupCollection('Memory_groups_group456')).toBe(true);
      expect(isGroupCollection('Memory_users_user123')).toBe(false);
    });
  });
});

// ============================================================================
// Composite ID Utilities Tests
// ============================================================================

describe('Composite ID Utilities', () => {
  describe('generateCompositeId', () => {
    it('should generate composite ID', () => {
      expect(generateCompositeId('user123', 'my-recipe')).toBe('user123.my-recipe');
    });

    it('should throw error for userId with dots', () => {
      expect(() => generateCompositeId('user.123', 'recipe')).toThrow('cannot contain dots');
    });

    it('should throw error for empty userId', () => {
      expect(() => generateCompositeId('', 'recipe')).toThrow('cannot be empty');
    });
  });

  describe('parseCompositeId', () => {
    it('should parse composite ID', () => {
      const result = parseCompositeId('user123.my-recipe');
      expect(result.userId).toBe('user123');
      expect(result.memoryId).toBe('my-recipe');
    });

    it('should throw error for invalid format', () => {
      expect(() => parseCompositeId('invalid')).toThrow('must be exactly 2 parts');
    });
  });

  describe('isCompositeId', () => {
    it('should identify valid composite IDs', () => {
      expect(isCompositeId('user123.my-recipe')).toBe(true);
      expect(isCompositeId('simple-id')).toBe(false);
    });
  });

  describe('validateCompositeId', () => {
    it('should validate correct composite IDs', () => {
      expect(validateCompositeId('user123.my-recipe')).toBe(true);
    });

    it('should throw error for invalid IDs', () => {
      expect(() => validateCompositeId('invalid')).toThrow();
    });
  });
});

// ============================================================================
// Tracking Array Management Tests
// ============================================================================

describe('Tracking Array Management', () => {
  describe('addToSpaceIds', () => {
    it('should add space ID to existing arrays', () => {
      const memory: MemoryWithTracking = { space_ids: [], group_ids: [] };
      const result = addToSpaceIds(memory, 'cooking');
      expect(result.space_ids).toEqual(['cooking']);
    });

    it('should not add duplicate space IDs', () => {
      const memory: MemoryWithTracking = { space_ids: ['cooking'], group_ids: [] };
      const result = addToSpaceIds(memory, 'cooking');
      expect(result.space_ids).toEqual(['cooking']);
    });

    it('should be immutable', () => {
      const memory: MemoryWithTracking = { space_ids: ['cooking'], group_ids: [] };
      const result = addToSpaceIds(memory, 'recipes');
      expect(memory.space_ids).toEqual(['cooking']); // Original unchanged
      expect(result.space_ids).toEqual(['cooking', 'recipes']);
    });
  });

  describe('removeFromSpaceIds', () => {
    it('should remove space ID', () => {
      const memory: MemoryWithTracking = { space_ids: ['cooking', 'recipes'], group_ids: [] };
      const result = removeFromSpaceIds(memory, 'cooking');
      expect(result.space_ids).toEqual(['recipes']);
    });
  });

  describe('addToGroupIds', () => {
    it('should add group ID', () => {
      const memory: MemoryWithTracking = { space_ids: [], group_ids: ['family'] };
      const result = addToGroupIds(memory, 'friends');
      expect(result.group_ids).toEqual(['family', 'friends']);
    });
  });

  describe('removeFromGroupIds', () => {
    it('should remove group ID', () => {
      const memory: MemoryWithTracking = { space_ids: [], group_ids: ['family', 'friends'] };
      const result = removeFromGroupIds(memory, 'family');
      expect(result.group_ids).toEqual(['friends']);
    });
  });

  describe('Publication checks', () => {
    it('should check if published to space', () => {
      const memory: MemoryWithTracking = { space_ids: ['cooking'], group_ids: [] };
      expect(isPublishedToSpace(memory, 'cooking')).toBe(true);
      expect(isPublishedToSpace(memory, 'travel')).toBe(false);
    });

    it('should check if published to group', () => {
      const memory: MemoryWithTracking = { space_ids: [], group_ids: ['family'] };
      expect(isPublishedToGroup(memory, 'family')).toBe(true);
      expect(isPublishedToGroup(memory, 'coworkers')).toBe(false);
    });

    it('should get publication locations', () => {
      const memory: MemoryWithTracking = { space_ids: ['cooking'], group_ids: ['family'] };
      const result = getPublishedLocations(memory);
      expect(result).toEqual({ spaces: ['cooking'], groups: ['family'] });
    });

    it('should check if published anywhere', () => {
      const memory1: MemoryWithTracking = { space_ids: ['cooking'], group_ids: [] };
      expect(isPublished(memory1)).toBe(true);
      
      const memory2: MemoryWithTracking = { space_ids: [], group_ids: [] };
      expect(isPublished(memory2)).toBe(false);
    });

    it('should count publications', () => {
      const memory: MemoryWithTracking = { space_ids: ['cooking', 'recipes'], group_ids: ['family'] };
      expect(getPublishedCount(memory)).toBe(3);
    });
  });

  describe('Batch operations', () => {
    it('should add multiple space IDs', () => {
      const memory: MemoryWithTracking = { space_ids: ['cooking'], group_ids: [] };
      const result = addMultipleSpaceIds(memory, ['recipes', 'baking']);
      expect(result.space_ids).toEqual(['cooking', 'recipes', 'baking']);
    });

    it('should add multiple group IDs', () => {
      const memory: MemoryWithTracking = { space_ids: [], group_ids: ['family'] };
      const result = addMultipleGroupIds(memory, ['friends', 'coworkers']);
      expect(result.group_ids).toEqual(['family', 'friends', 'coworkers']);
    });
  });

  describe('Utility functions', () => {
    it('should initialize tracking arrays', () => {
      const memory = { content: 'My recipe' };
      const result = initializeTracking(memory);
      expect(result.space_ids).toEqual([]);
      expect(result.group_ids).toEqual([]);
    });
  });
});

// ============================================================================
// Schema Definitions Tests
// ============================================================================

describe('Schema Definitions', () => {
  describe('Schema creation', () => {
    it('should create user collection schema', () => {
      const schema = createUserCollectionSchema('user123');
      expect(schema.name).toBe('Memory_users_user123');
      expect(schema.description).toContain('user123');
      expect(schema.properties).toBeDefined();
      expect(schema.vectorizer).toBeDefined();
    });

    it('should create space collection schema', () => {
      const schema = createSpaceCollectionSchema();
      expect(schema.name).toBe('Memory_spaces_public');
      expect(schema.properties).toBeDefined();
    });

    it('should create group collection schema', () => {
      const schema = createGroupCollectionSchema('group456');
      expect(schema.name).toBe('Memory_groups_group456');
      expect(schema.properties).toBeDefined();
    });
  });

  describe('Property lists', () => {
    it('should get user collection properties', () => {
      const props = getUserCollectionProperties();
      expect(props).toContain('id');
      expect(props).toContain('content');
      expect(props).toContain('space_ids');
      expect(props).toContain('group_ids');
    });

    it('should get published collection properties', () => {
      const props = getPublishedCollectionProperties();
      expect(props).toContain('id');
      expect(props).toContain('published_at');
      expect(props).toContain('author_id');
    });
  });

  describe('Collection name validation', () => {
    it('should validate v2 collection names', () => {
      expect(validateV2CollectionName('Memory_users_user123')).toBe(true);
      expect(validateV2CollectionName('Memory_spaces_public')).toBe(true);
      expect(validateV2CollectionName('Memory_groups_group456')).toBe(true);
    });

    it('should reject invalid collection names', () => {
      expect(() => validateV2CollectionName('InvalidName')).toThrow('Invalid v2 collection name');
    });
  });

  describe('Collection type detection', () => {
    it('should detect collection types', () => {
      expect(getCollectionType('Memory_users_user123')).toBe('users');
      expect(getCollectionType('Memory_spaces_public')).toBe('spaces');
      expect(getCollectionType('Memory_groups_group456')).toBe('groups');
    });
  });

  describe('ID extraction', () => {
    it('should extract user ID', () => {
      expect(extractIdFromCollectionName('Memory_users_user123')).toBe('user123');
    });

    it('should extract group ID', () => {
      expect(extractIdFromCollectionName('Memory_groups_group456')).toBe('group456');
    });

    it('should return null for spaces collection', () => {
      expect(extractIdFromCollectionName('Memory_spaces_public')).toBeNull();
    });
  });
});
