/**
 * Unit tests for Space Schema utilities
 */

import {
  getSpaceCollectionName,
  sanitizeSpaceId,
  getSpaceDisplayName,
  isValidSpaceId,
  ensureSpaceCollection,
  ensurePublicCollection,
  PUBLIC_COLLECTION_NAME,
} from './space-schema';
import type { WeaviateClient } from 'weaviate-client';

// Mock Weaviate client
const mockWeaviateClient = {
  collections: {
    exists: jest.fn(),
    create: jest.fn(),
    get: jest.fn(),
  },
} as unknown as WeaviateClient;

describe('Space Schema Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getSpaceCollectionName', () => {
    it('should return collection name with Memory_ prefix', () => {
      expect(getSpaceCollectionName('the_void')).toBe('Memory_the_void');
      expect(getSpaceCollectionName('public_space')).toBe('Memory_public_space');
    });
  });

  describe('sanitizeSpaceId', () => {
    it('should convert display name to snake_case', () => {
      expect(sanitizeSpaceId('The Void')).toBe('the_void');
      expect(sanitizeSpaceId('Public Space')).toBe('public_space');
      expect(sanitizeSpaceId('MY SPACE')).toBe('my_space');
    });

    it('should handle multiple spaces', () => {
      expect(sanitizeSpaceId('The  Void  Space')).toBe('the_void_space');
    });

    it('should handle already lowercase', () => {
      expect(sanitizeSpaceId('the_void')).toBe('the_void');
    });
  });

  describe('getSpaceDisplayName', () => {
    it('should return display name for known space IDs', () => {
      expect(getSpaceDisplayName('the_void')).toBe('The Void');
    });

    it('should return space ID if not found in map', () => {
      expect(getSpaceDisplayName('unknown_space')).toBe('unknown_space');
    });
  });

  describe('isValidSpaceId', () => {
    it('should return true for supported spaces', () => {
      expect(isValidSpaceId('the_void')).toBe(true);
    });

    it('should return false for unsupported spaces', () => {
      expect(isValidSpaceId('unknown_space')).toBe(false);
      expect(isValidSpaceId('public_space')).toBe(false); // Not yet supported
    });
  });

  describe('ensureSpaceCollection', () => {
    it('should return existing collection if it exists', async () => {
      const mockCollection = { name: 'Memory_the_void' };
      (mockWeaviateClient.collections.exists as jest.Mock).mockResolvedValue(true);
      (mockWeaviateClient.collections.get as jest.Mock).mockReturnValue(mockCollection);

      const result = await ensureSpaceCollection(mockWeaviateClient, 'the_void');

      expect(result).toBe(mockCollection);
      expect(mockWeaviateClient.collections.exists).toHaveBeenCalledWith('Memory_the_void');
      expect(mockWeaviateClient.collections.get).toHaveBeenCalledWith('Memory_the_void');
      expect(mockWeaviateClient.collections.create).not.toHaveBeenCalled();
    });

    it('should create collection if it does not exist', async () => {
      const mockCollection = { name: 'Memory_the_void' };
      (mockWeaviateClient.collections.exists as jest.Mock).mockResolvedValue(false);
      (mockWeaviateClient.collections.create as jest.Mock).mockResolvedValue(undefined);
      (mockWeaviateClient.collections.get as jest.Mock).mockReturnValue(mockCollection);

      const result = await ensureSpaceCollection(mockWeaviateClient, 'the_void');

      expect(result).toBe(mockCollection);
      expect(mockWeaviateClient.collections.exists).toHaveBeenCalledWith('Memory_the_void');
      expect(mockWeaviateClient.collections.create).toHaveBeenCalled();
      expect(mockWeaviateClient.collections.get).toHaveBeenCalledWith('Memory_the_void');
    });

    it('should throw error for invalid space ID', async () => {
      await expect(
        ensureSpaceCollection(mockWeaviateClient, 'invalid_space')
      ).rejects.toThrow('Invalid space ID: invalid_space');

      expect(mockWeaviateClient.collections.exists).not.toHaveBeenCalled();
    });

    it('should create collection with correct schema', async () => {
      (mockWeaviateClient.collections.exists as jest.Mock).mockResolvedValue(false);
      (mockWeaviateClient.collections.create as jest.Mock).mockResolvedValue(undefined);
      (mockWeaviateClient.collections.get as jest.Mock).mockReturnValue({});

      await ensureSpaceCollection(mockWeaviateClient, 'the_void');

      const createCall = (mockWeaviateClient.collections.create as jest.Mock).mock.calls[0][0];
      expect(createCall.name).toBe('Memory_the_void');
      expect(createCall.vectorizers).toBeDefined();
      expect(createCall.properties).toBeDefined();
      expect(createCall.properties.length).toBeGreaterThan(20); // Should have many properties
      
      // Check for space-specific properties
      const propertyNames = createCall.properties.map((p: any) => p.name);
      expect(propertyNames).toContain('spaces'); // ✅ New array field
      expect(propertyNames).toContain('space_id');
      expect(propertyNames).toContain('author_id');
      expect(propertyNames).toContain('ghost_id');
      expect(propertyNames).toContain('published_at');
      expect(propertyNames).toContain('discovery_count');
      expect(propertyNames).toContain('attribution');
    });
  });

  describe('Unified Public Collection', () => {
    it('should create Memory_public collection', async () => {
      const mockCollection = { name: 'Memory_public' };
      (mockWeaviateClient.collections.exists as jest.Mock).mockResolvedValue(false);
      (mockWeaviateClient.collections.create as jest.Mock).mockResolvedValue(undefined);
      (mockWeaviateClient.collections.get as jest.Mock).mockReturnValue(mockCollection);

      const result = await ensurePublicCollection(mockWeaviateClient);

      expect(result).toBe(mockCollection);
      expect(mockWeaviateClient.collections.exists).toHaveBeenCalledWith('Memory_public');
      expect(mockWeaviateClient.collections.create).toHaveBeenCalled();
      expect(mockWeaviateClient.collections.get).toHaveBeenCalledWith('Memory_public');
    });

    it('should return existing Memory_public if it exists', async () => {
      const mockCollection = { name: 'Memory_public' };
      (mockWeaviateClient.collections.exists as jest.Mock).mockResolvedValue(true);
      (mockWeaviateClient.collections.get as jest.Mock).mockReturnValue(mockCollection);

      const result = await ensurePublicCollection(mockWeaviateClient);

      expect(result).toBe(mockCollection);
      expect(mockWeaviateClient.collections.exists).toHaveBeenCalledWith('Memory_public');
      expect(mockWeaviateClient.collections.get).toHaveBeenCalledWith('Memory_public');
      expect(mockWeaviateClient.collections.create).not.toHaveBeenCalled();
    });

    it('should have spaces array field in schema', async () => {
      (mockWeaviateClient.collections.exists as jest.Mock).mockResolvedValue(false);
      (mockWeaviateClient.collections.create as jest.Mock).mockResolvedValue(undefined);
      (mockWeaviateClient.collections.get as jest.Mock).mockReturnValue({});

      await ensurePublicCollection(mockWeaviateClient);

      const createCall = (mockWeaviateClient.collections.create as jest.Mock).mock.calls[0][0];
      const propertyNames = createCall.properties.map((p: any) => p.name);
      
      // Verify spaces array field exists
      expect(propertyNames).toContain('spaces');
      
      // Find spaces property and verify it's an array
      const spacesProperty = createCall.properties.find((p: any) => p.name === 'spaces');
      expect(spacesProperty).toBeDefined();
      expect(spacesProperty.dataType).toBe('text[]');
    });

    it('should verify PUBLIC_COLLECTION_NAME constant', () => {
      expect(PUBLIC_COLLECTION_NAME).toBe('Memory_public');
    });
  });
});
