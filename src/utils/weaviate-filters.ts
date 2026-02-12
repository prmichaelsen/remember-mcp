/**
 * Weaviate v3 Filter Builder Utilities
 *
 * Provides helper functions to build Weaviate v3 filters using the fluent API.
 * Replaces old v2 filter format (path/operator/valueText) with v3 collection.filter.byProperty()
 */

import type { SearchFilters } from '../types/memory.js';

/**
 * Build filters for searching both memories and relationships
 * Uses OR logic: (doc_type=memory AND memory_filters) OR (doc_type=relationship AND relationship_filters)
 *
 * @param collection - Weaviate collection instance
 * @param filters - Optional search filters
 * @returns Combined filter or undefined if no filters
 */
export function buildCombinedSearchFilters(
  collection: any,
  filters?: SearchFilters
): any {
  // Build memory-specific filters
  const memoryFilters = buildDocTypeFilters(collection, 'memory', filters);
  
  // Build relationship-specific filters
  const relationshipFilters = buildDocTypeFilters(collection, 'relationship', filters);
  
  // Combine with OR: search both memories and relationships
  if (memoryFilters && relationshipFilters) {
    return combineFiltersWithOr([memoryFilters, relationshipFilters]);
  } else if (memoryFilters) {
    return memoryFilters;
  } else if (relationshipFilters) {
    return relationshipFilters;
  }
  
  return undefined;
}

/**
 * Build filters for a specific doc_type (memory or relationship)
 *
 * @param collection - Weaviate collection instance
 * @param docType - 'memory' or 'relationship'
 * @param filters - Optional search filters
 * @returns Combined filter for this doc_type
 */
function buildDocTypeFilters(
  collection: any,
  docType: 'memory' | 'relationship',
  filters?: SearchFilters
): any {
  const filterList: any[] = [];

  // Always filter by doc_type
  filterList.push(
    collection.filter.byProperty('doc_type').equal(docType)
  );

  // Type filter (content type) - only applies to memories, not relationships
  if (docType === 'memory' && filters?.types && filters.types.length > 0) {
    if (filters.types.length === 1) {
      filterList.push(
        collection.filter.byProperty('type').equal(filters.types[0])
      );
    } else {
      filterList.push(
        collection.filter.byProperty('type').containsAny(filters.types)
      );
    }
  }

  // Weight filter (minimum) - applies to both memories and relationships
  if (filters?.weight_min !== undefined) {
    filterList.push(
      collection.filter.byProperty('weight').greaterThanOrEqual(filters.weight_min)
    );
  }

  // Weight filter (maximum)
  if (filters?.weight_max !== undefined) {
    filterList.push(
      collection.filter.byProperty('weight').lessThanOrEqual(filters.weight_max)
    );
  }

  // Trust filter (minimum) - applies to both
  if (filters?.trust_min !== undefined) {
    filterList.push(
      collection.filter.byProperty('trust').greaterThanOrEqual(filters.trust_min)
    );
  }

  // Trust filter (maximum)
  if (filters?.trust_max !== undefined) {
    filterList.push(
      collection.filter.byProperty('trust').lessThanOrEqual(filters.trust_max)
    );
  }

  // Date range filter (from) - applies to both
  if (filters?.date_from) {
    filterList.push(
      collection.filter.byProperty('created_at').greaterThanOrEqual(new Date(filters.date_from))
    );
  }

  // Date range filter (to)
  if (filters?.date_to) {
    filterList.push(
      collection.filter.byProperty('created_at').lessThanOrEqual(new Date(filters.date_to))
    );
  }

  // Tags filter - applies to both
  if (filters?.tags && filters.tags.length > 0) {
    if (filters.tags.length === 1) {
      filterList.push(
        collection.filter.byProperty('tags').containsAny([filters.tags[0]])
      );
    } else {
      filterList.push(
        collection.filter.byProperty('tags').containsAny(filters.tags)
      );
    }
  }

  // Combine filters with AND
  return combineFiltersWithAnd(filterList);
}

/**
 * Build filters for memory-only search (backward compatibility)
 *
 * @param collection - Weaviate collection instance
 * @param filters - Optional search filters
 * @returns Combined filter or undefined if no filters
 */
export function buildMemoryOnlyFilters(
  collection: any,
  filters?: SearchFilters
): any {
  return buildDocTypeFilters(collection, 'memory', filters);
}

/**
 * Build filters specifically for relationship-only search
 *
 * @param collection - Weaviate collection instance
 * @param filters - Optional search filters
 * @returns Combined filter or undefined if no filters
 */
export function buildRelationshipOnlyFilters(
  collection: any,
  filters?: SearchFilters
): any {
  return buildDocTypeFilters(collection, 'relationship', filters);
}

/**
 * Combine multiple filters with AND logic
 *
 * @param filters - Array of filter objects
 * @returns Combined filter or undefined
 */
function combineFiltersWithAnd(filters: any[]): any {
  if (filters.length === 0) {
    return undefined;
  }
  if (filters.length === 1) {
    return filters[0];
  }
  
  // Weaviate v3 uses operator/operands structure for combining filters
  return {
    operator: 'And',
    operands: filters
  };
}

/**
 * Combine multiple filters with OR logic
 *
 * @param filters - Array of filter objects
 * @returns Combined filter or undefined
 */
function combineFiltersWithOr(filters: any[]): any {
  if (filters.length === 0) {
    return undefined;
  }
  if (filters.length === 1) {
    return filters[0];
  }
  
  // Weaviate v3 uses operator/operands structure for combining filters
  return {
    operator: 'Or',
    operands: filters
  };
}

/**
 * Helper to check if a filter result is empty
 */
export function hasFilters(filter: any): boolean {
  return filter !== undefined && filter !== null;
}
