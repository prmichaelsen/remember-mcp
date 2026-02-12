/**
 * Unit tests for Weaviate v3 filter builders
 * 
 * Note: These tests verify filter builder logic, not exact Weaviate filter structure.
 * The actual Filters.and() and Filters.or() methods return Weaviate internal objects.
 */

import {
  buildCombinedSearchFilters,
  buildMemoryOnlyFilters,
  buildRelationshipOnlyFilters,
  hasFilters,
} from './weaviate-filters.js';
import type { SearchFilters } from '../types/memory.js';

/**
 * Mock Weaviate collection with filter builder
 */
function createMockCollection() {
  const mockFilter = {
    byProperty: (property: string) => ({
      equal: (value: any) => ({ property, operator: 'equal', value }),
      greaterThanOrEqual: (value: any) => ({ property, operator: 'gte', value }),
      lessThanOrEqual: (value: any) => ({ property, operator: 'lte', value }),
      containsAny: (values: any[]) => ({ property, operator: 'containsAny', values }),
    }),
  };

  return {
    filter: mockFilter,
  };
}

describe('weaviate-filters', () => {
  let mockCollection: any;

  beforeEach(() => {
    mockCollection = createMockCollection();
  });

  describe('buildMemoryOnlyFilters', () => {
    it('should build filter with only doc_type when no other filters provided', () => {
      const result = buildMemoryOnlyFilters(mockCollection);
      expect(result).toBeDefined();
      expect(result.property).toBe('doc_type');
      expect(result.value).toBe('memory');
    });

    it('should build filter with doc_type and content type', () => {
      const filters: SearchFilters = {
        types: ['note'],
      };

      const result = buildMemoryOnlyFilters(mockCollection, filters);
      expect(result).toBeDefined();
      // Filters.and() returns Weaviate internal structure
      // Just verify it's defined and has the filters property
      expect(result.filters || result.operands).toBeDefined();
    });

    it('should build filter with weight_min', () => {
      const filters: SearchFilters = {
        weight_min: 0.5,
      };

      const result = buildMemoryOnlyFilters(mockCollection, filters);
      expect(result).toBeDefined();
    });

    it('should build filter with trust and date filters', () => {
      const filters: SearchFilters = {
        trust_min: 0.3,
        date_from: '2024-01-01',
      };

      const result = buildMemoryOnlyFilters(mockCollection, filters);
      expect(result).toBeDefined();
    });

    it('should build filter with tags', () => {
      const filters: SearchFilters = {
        tags: ['work', 'important'],
      };

      const result = buildMemoryOnlyFilters(mockCollection, filters);
      expect(result).toBeDefined();
    });

    it('should build complex filter with multiple criteria', () => {
      const filters: SearchFilters = {
        types: ['note', 'todo'],
        weight_min: 0.5,
        trust_min: 0.3,
        date_from: '2024-01-01',
        tags: ['work'],
      };

      const result = buildMemoryOnlyFilters(mockCollection, filters);
      expect(result).toBeDefined();
    });
  });

  describe('buildRelationshipOnlyFilters', () => {
    it('should build filter with only doc_type', () => {
      const result = buildRelationshipOnlyFilters(mockCollection);
      expect(result).toBeDefined();
      expect(result.property).toBe('doc_type');
      expect(result.value).toBe('relationship');
    });

    it('should NOT include type filter for relationships', () => {
      const filters: SearchFilters = {
        types: ['note'],
      };

      const result = buildRelationshipOnlyFilters(mockCollection, filters);
      expect(result).toBeDefined();
      expect(result.property).toBe('doc_type');
    });

    it('should build filter with weight and trust', () => {
      const filters: SearchFilters = {
        weight_min: 0.5,
        trust_min: 0.3,
      };

      const result = buildRelationshipOnlyFilters(mockCollection, filters);
      expect(result).toBeDefined();
    });

    it('should build filter with date and tags', () => {
      const filters: SearchFilters = {
        date_from: '2024-01-01',
        tags: ['important'],
      };

      const result = buildRelationshipOnlyFilters(mockCollection, filters);
      expect(result).toBeDefined();
    });
  });

  describe('buildCombinedSearchFilters', () => {
    it('should combine memory and relationship filters', () => {
      const result = buildCombinedSearchFilters(mockCollection);
      expect(result).toBeDefined();
      // Filters.or() returns Weaviate internal structure
      expect(result.filters || result.operands).toBeDefined();
    });

    it('should handle filters that apply to both types', () => {
      const filters: SearchFilters = {
        weight_min: 0.5,
        trust_min: 0.3,
      };

      const result = buildCombinedSearchFilters(mockCollection, filters);
      expect(result).toBeDefined();
    });

    it('should handle type filter (only for memories)', () => {
      const filters: SearchFilters = {
        types: ['note'],
        weight_min: 0.5,
      };

      const result = buildCombinedSearchFilters(mockCollection, filters);
      expect(result).toBeDefined();
    });

    it('should handle complex filters', () => {
      const filters: SearchFilters = {
        types: ['note'],
        weight_min: 0.5,
        weight_max: 0.9,
        trust_min: 0.3,
        date_from: '2024-01-01',
        date_to: '2024-12-31',
        tags: ['work', 'important'],
      };

      const result = buildCombinedSearchFilters(mockCollection, filters);
      expect(result).toBeDefined();
    });
  });

  describe('hasFilters', () => {
    it('should return true for defined filter', () => {
      const filter = { property: 'doc_type', operator: 'equal', value: 'memory' };
      expect(hasFilters(filter)).toBe(true);
    });

    it('should return false for undefined', () => {
      expect(hasFilters(undefined)).toBe(false);
    });

    it('should return false for null', () => {
      expect(hasFilters(null)).toBe(false);
    });

    it('should return true for empty object', () => {
      expect(hasFilters({})).toBe(true);
    });

    it('should return true for complex filter', () => {
      const filter = {
        filters: [
          { property: 'doc_type', operator: 'equal', value: 'memory' },
          { property: 'weight', operator: 'gte', value: 0.5 },
        ],
      };
      expect(hasFilters(filter)).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle empty types array', () => {
      const filters: SearchFilters = {
        types: [],
      };

      const result = buildMemoryOnlyFilters(mockCollection, filters);
      expect(result).toBeDefined();
      expect(result.property).toBe('doc_type');
    });

    it('should handle empty tags array', () => {
      const filters: SearchFilters = {
        tags: [],
      };

      const result = buildMemoryOnlyFilters(mockCollection, filters);
      expect(result).toBeDefined();
    });

    it('should handle weight_min of 0', () => {
      const filters: SearchFilters = {
        weight_min: 0,
      };

      const result = buildMemoryOnlyFilters(mockCollection, filters);
      expect(result).toBeDefined();
    });

    it('should handle trust_min of 0', () => {
      const filters: SearchFilters = {
        trust_min: 0,
      };

      const result = buildMemoryOnlyFilters(mockCollection, filters);
      expect(result).toBeDefined();
    });

    it('should handle weight range', () => {
      const filters: SearchFilters = {
        weight_min: 0.3,
        weight_max: 0.7,
      };

      const result = buildMemoryOnlyFilters(mockCollection, filters);
      expect(result).toBeDefined();
    });

    it('should handle trust range', () => {
      const filters: SearchFilters = {
        trust_min: 0.2,
        trust_max: 0.8,
      };

      const result = buildMemoryOnlyFilters(mockCollection, filters);
      expect(result).toBeDefined();
    });
  });

  describe('undefined/null filter handling', () => {
    it('should not create Or operator with empty operands', () => {
      const emptyCollection = {
        filter: {
          byProperty: () => ({
            equal: () => undefined,
            greaterThanOrEqual: () => undefined,
            lessThanOrEqual: () => undefined,
            containsAny: () => undefined,
          }),
        },
      };
      
      const result = buildCombinedSearchFilters(emptyCollection);
      expect(result).toBeUndefined();
    });

    it('should not create And operator with empty operands', () => {
      const emptyCollection = {
        filter: {
          byProperty: () => ({
            equal: () => undefined,
          }),
        },
      };
      
      const result = buildMemoryOnlyFilters(emptyCollection);
      expect(result).toBeUndefined();
    });

    it('should handle mixed valid and undefined filters', () => {
      const result = buildCombinedSearchFilters(mockCollection, {
        types: ['note'],
      });
      
      expect(result).toBeDefined();
    });
  });
});
