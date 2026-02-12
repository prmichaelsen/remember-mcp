/**
 * Unit tests for Weaviate v3 filter builders
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

      expect(result).toEqual({
        property: 'doc_type',
        operator: 'equal',
        value: 'memory',
      });
    });

    it('should build filter with doc_type and single content type', () => {
      const filters: SearchFilters = {
        types: ['note'],
      };

      const result = buildMemoryOnlyFilters(mockCollection, filters);

      expect(result).toEqual({
        operator: 'And',
        operands: [
          { property: 'doc_type', operator: 'equal', value: 'memory' },
          { property: 'type', operator: 'equal', value: 'note' },
        ],
      });
    });

    it('should build filter with doc_type and multiple content types', () => {
      const filters: SearchFilters = {
        types: ['note', 'event', 'task'],
      };

      const result = buildMemoryOnlyFilters(mockCollection, filters);

      expect(result).toEqual({
        operator: 'And',
        operands: [
          { property: 'doc_type', operator: 'equal', value: 'memory' },
          { property: 'type', operator: 'containsAny', values: ['note', 'event', 'task'] },
        ],
      });
    });

    it('should build filter with weight_min', () => {
      const filters: SearchFilters = {
        weight_min: 0.5,
      };

      const result = buildMemoryOnlyFilters(mockCollection, filters);

      expect(result).toEqual({
        operator: 'And',
        operands: [
          { property: 'doc_type', operator: 'equal', value: 'memory' },
          { property: 'weight', operator: 'gte', value: 0.5 },
        ],
      });
    });

    it('should build filter with weight_max', () => {
      const filters: SearchFilters = {
        weight_max: 0.8,
      };

      const result = buildMemoryOnlyFilters(mockCollection, filters);

      expect(result).toEqual({
        operator: 'And',
        operands: [
          { property: 'doc_type', operator: 'equal', value: 'memory' },
          { property: 'weight', operator: 'lte', value: 0.8 },
        ],
      });
    });

    it('should build filter with trust_min', () => {
      const filters: SearchFilters = {
        trust_min: 0.3,
      };

      const result = buildMemoryOnlyFilters(mockCollection, filters);

      expect(result).toEqual({
        operator: 'And',
        operands: [
          { property: 'doc_type', operator: 'equal', value: 'memory' },
          { property: 'trust', operator: 'gte', value: 0.3 },
        ],
      });
    });

    it('should build filter with date range', () => {
      const filters: SearchFilters = {
        date_from: '2024-01-01',
        date_to: '2024-12-31',
      };

      const result = buildMemoryOnlyFilters(mockCollection, filters);

      expect(result).toEqual({
        operator: 'And',
        operands: [
          { property: 'doc_type', operator: 'equal', value: 'memory' },
          { property: 'created_at', operator: 'gte', value: new Date('2024-01-01') },
          { property: 'created_at', operator: 'lte', value: new Date('2024-12-31') },
        ],
      });
    });

    it('should build filter with single tag', () => {
      const filters: SearchFilters = {
        tags: ['important'],
      };

      const result = buildMemoryOnlyFilters(mockCollection, filters);

      expect(result).toEqual({
        operator: 'And',
        operands: [
          { property: 'doc_type', operator: 'equal', value: 'memory' },
          { property: 'tags', operator: 'containsAny', values: ['important'] },
        ],
      });
    });

    it('should build filter with multiple tags', () => {
      const filters: SearchFilters = {
        tags: ['work', 'urgent', 'project-x'],
      };

      const result = buildMemoryOnlyFilters(mockCollection, filters);

      expect(result).toEqual({
        operator: 'And',
        operands: [
          { property: 'doc_type', operator: 'equal', value: 'memory' },
          { property: 'tags', operator: 'containsAny', values: ['work', 'urgent', 'project-x'] },
        ],
      });
    });

    it('should build complex filter with multiple criteria', () => {
      const filters: SearchFilters = {
        types: ['note', 'task'],
        weight_min: 0.5,
        trust_min: 0.3,
        date_from: '2024-01-01',
        tags: ['work'],
      };

      const result = buildMemoryOnlyFilters(mockCollection, filters);

      expect(result).toEqual({
        operator: 'And',
        operands: [
          { property: 'doc_type', operator: 'equal', value: 'memory' },
          { property: 'type', operator: 'containsAny', values: ['note', 'task'] },
          { property: 'weight', operator: 'gte', value: 0.5 },
          { property: 'trust', operator: 'gte', value: 0.3 },
          { property: 'created_at', operator: 'gte', value: new Date('2024-01-01') },
          { property: 'tags', operator: 'containsAny', values: ['work'] },
        ],
      });
    });
  });

  describe('buildRelationshipOnlyFilters', () => {
    it('should build filter with only doc_type when no other filters provided', () => {
      const result = buildRelationshipOnlyFilters(mockCollection);

      expect(result).toEqual({
        property: 'doc_type',
        operator: 'equal',
        value: 'relationship',
      });
    });

    it('should NOT include type filter for relationships', () => {
      const filters: SearchFilters = {
        types: ['note'], // This should be ignored for relationships
      };

      const result = buildRelationshipOnlyFilters(mockCollection, filters);

      // Should only have doc_type filter, not type filter
      expect(result).toEqual({
        property: 'doc_type',
        operator: 'equal',
        value: 'relationship',
      });
    });

    it('should build filter with weight and trust for relationships', () => {
      const filters: SearchFilters = {
        weight_min: 0.5,
        trust_min: 0.3,
      };

      const result = buildRelationshipOnlyFilters(mockCollection, filters);

      expect(result).toEqual({
        operator: 'And',
        operands: [
          { property: 'doc_type', operator: 'equal', value: 'relationship' },
          { property: 'weight', operator: 'gte', value: 0.5 },
          { property: 'trust', operator: 'gte', value: 0.3 },
        ],
      });
    });

    it('should build filter with date range and tags for relationships', () => {
      const filters: SearchFilters = {
        date_from: '2024-01-01',
        tags: ['important'],
      };

      const result = buildRelationshipOnlyFilters(mockCollection, filters);

      expect(result).toEqual({
        operator: 'And',
        operands: [
          { property: 'doc_type', operator: 'equal', value: 'relationship' },
          { property: 'created_at', operator: 'gte', value: new Date('2024-01-01') },
          { property: 'tags', operator: 'containsAny', values: ['important'] },
        ],
      });
    });
  });

  describe('buildCombinedSearchFilters', () => {
    it('should combine memory and relationship filters with OR', () => {
      const result = buildCombinedSearchFilters(mockCollection);

      expect(result).toEqual({
        operator: 'Or',
        operands: [
          { property: 'doc_type', operator: 'equal', value: 'memory' },
          { property: 'doc_type', operator: 'equal', value: 'relationship' },
        ],
      });
    });

    it('should combine memory and relationship filters with shared criteria', () => {
      const filters: SearchFilters = {
        weight_min: 0.5,
        trust_min: 0.3,
      };

      const result = buildCombinedSearchFilters(mockCollection, filters);

      expect(result).toEqual({
        operator: 'Or',
        operands: [
          {
            operator: 'And',
            operands: [
              { property: 'doc_type', operator: 'equal', value: 'memory' },
              { property: 'weight', operator: 'gte', value: 0.5 },
              { property: 'trust', operator: 'gte', value: 0.3 },
            ],
          },
          {
            operator: 'And',
            operands: [
              { property: 'doc_type', operator: 'equal', value: 'relationship' },
              { property: 'weight', operator: 'gte', value: 0.5 },
              { property: 'trust', operator: 'gte', value: 0.3 },
            ],
          },
        ],
      });
    });

    it('should handle type filter only for memories in combined search', () => {
      const filters: SearchFilters = {
        types: ['note', 'task'],
        weight_min: 0.5,
      };

      const result = buildCombinedSearchFilters(mockCollection, filters);

      expect(result).toEqual({
        operator: 'Or',
        operands: [
          {
            operator: 'And',
            operands: [
              { property: 'doc_type', operator: 'equal', value: 'memory' },
              { property: 'type', operator: 'containsAny', values: ['note', 'task'] },
              { property: 'weight', operator: 'gte', value: 0.5 },
            ],
          },
          {
            operator: 'And',
            operands: [
              { property: 'doc_type', operator: 'equal', value: 'relationship' },
              { property: 'weight', operator: 'gte', value: 0.5 },
            ],
          },
        ],
      });
    });

    it('should handle complex filters in combined search', () => {
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

      expect(result.operator).toBe('Or');
      expect(result.operands).toHaveLength(2);
      
      // Memory filters should include type
      expect(result.operands[0].operands).toContainEqual({
        property: 'type',
        operator: 'containsAny',
        values: ['note'],
      });

      // Relationship filters should NOT include type
      expect(result.operands[1].operands).not.toContainEqual(
        expect.objectContaining({ property: 'type' })
      );

      // Both should have shared filters
      const sharedFilters = [
        { property: 'weight', operator: 'gte', value: 0.5 },
        { property: 'weight', operator: 'lte', value: 0.9 },
        { property: 'trust', operator: 'gte', value: 0.3 },
        { property: 'created_at', operator: 'gte', value: new Date('2024-01-01') },
        { property: 'created_at', operator: 'lte', value: new Date('2024-12-31') },
        { property: 'tags', operator: 'containsAny', values: ['work', 'important'] },
      ];

      sharedFilters.forEach(filter => {
        expect(result.operands[0].operands).toContainEqual(filter);
        expect(result.operands[1].operands).toContainEqual(filter);
      });
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
        operator: 'And',
        operands: [
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

      // Should only have doc_type filter
      expect(result).toEqual({
        property: 'doc_type',
        operator: 'equal',
        value: 'memory',
      });
    });

    it('should handle empty tags array', () => {
      const filters: SearchFilters = {
        tags: [],
      };

      const result = buildMemoryOnlyFilters(mockCollection, filters);

      // Should only have doc_type filter
      expect(result).toEqual({
        property: 'doc_type',
        operator: 'equal',
        value: 'memory',
      });
    });

    it('should handle weight_min of 0', () => {
      const filters: SearchFilters = {
        weight_min: 0,
      };

      const result = buildMemoryOnlyFilters(mockCollection, filters);

      expect(result).toEqual({
        operator: 'And',
        operands: [
          { property: 'doc_type', operator: 'equal', value: 'memory' },
          { property: 'weight', operator: 'gte', value: 0 },
        ],
      });
    });

    it('should handle trust_min of 0', () => {
      const filters: SearchFilters = {
        trust_min: 0,
      };

      const result = buildMemoryOnlyFilters(mockCollection, filters);

      expect(result).toEqual({
        operator: 'And',
        operands: [
          { property: 'doc_type', operator: 'equal', value: 'memory' },
          { property: 'trust', operator: 'gte', value: 0 },
        ],
      });
    });

    it('should handle weight range (min and max)', () => {
      const filters: SearchFilters = {
        weight_min: 0.3,
        weight_max: 0.7,
      };

      const result = buildMemoryOnlyFilters(mockCollection, filters);

      expect(result).toEqual({
        operator: 'And',
        operands: [
          { property: 'doc_type', operator: 'equal', value: 'memory' },
          { property: 'weight', operator: 'gte', value: 0.3 },
          { property: 'weight', operator: 'lte', value: 0.7 },
        ],
      });
    });

    it('should handle trust range (min and max)', () => {
      const filters: SearchFilters = {
        trust_min: 0.2,
        trust_max: 0.8,
      };

      const result = buildMemoryOnlyFilters(mockCollection, filters);

      expect(result).toEqual({
        operator: 'And',
        operands: [
          { property: 'doc_type', operator: 'equal', value: 'memory' },
          { property: 'trust', operator: 'gte', value: 0.2 },
          { property: 'trust', operator: 'lte', value: 0.8 },
        ],
      });
    });
  });
});
