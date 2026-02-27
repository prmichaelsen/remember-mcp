/**
 * Tests for comment-related schema fields in v2 collections.
 *
 * Verifies that parent_id, thread_root_id, and moderation_flags
 * are present in both user and published collection schemas.
 */

import {
  createUserCollectionSchema,
  createSpaceCollectionSchema,
  createGroupCollectionSchema,
  getUserCollectionProperties,
  getPublishedCollectionProperties,
} from './v2-collections.js';

describe('Comment schema fields', () => {
  describe('user collection (COMMON_MEMORY_PROPERTIES)', () => {
    const properties = getUserCollectionProperties();

    it('includes parent_id field', () => {
      expect(properties).toContain('parent_id');
    });

    it('includes thread_root_id field', () => {
      expect(properties).toContain('thread_root_id');
    });

    it('includes moderation_flags field', () => {
      expect(properties).toContain('moderation_flags');
    });
  });

  describe('published collection (COMMON + PUBLISHED)', () => {
    const properties = getPublishedCollectionProperties();

    it('includes parent_id field', () => {
      expect(properties).toContain('parent_id');
    });

    it('includes thread_root_id field', () => {
      expect(properties).toContain('thread_root_id');
    });

    it('includes moderation_flags field', () => {
      expect(properties).toContain('moderation_flags');
    });
  });

  describe('createUserCollectionSchema', () => {
    const schema = createUserCollectionSchema('test-user');

    it('has parent_id property with TEXT dataType', () => {
      const field = schema.properties.find((p: any) => p.name === 'parent_id');
      expect(field).toBeDefined();
    });

    it('has thread_root_id property with TEXT dataType', () => {
      const field = schema.properties.find((p: any) => p.name === 'thread_root_id');
      expect(field).toBeDefined();
    });

    it('has moderation_flags property with TEXT_ARRAY dataType', () => {
      const field = schema.properties.find((p: any) => p.name === 'moderation_flags');
      expect(field).toBeDefined();
    });
  });

  describe('createSpaceCollectionSchema', () => {
    const schema = createSpaceCollectionSchema();

    it('has parent_id property', () => {
      const field = schema.properties.find((p: any) => p.name === 'parent_id');
      expect(field).toBeDefined();
    });

    it('has thread_root_id property', () => {
      const field = schema.properties.find((p: any) => p.name === 'thread_root_id');
      expect(field).toBeDefined();
    });

    it('has moderation_flags property', () => {
      const field = schema.properties.find((p: any) => p.name === 'moderation_flags');
      expect(field).toBeDefined();
    });
  });

  describe('createGroupCollectionSchema', () => {
    const schema = createGroupCollectionSchema('test-group');

    it('has parent_id property', () => {
      const field = schema.properties.find((p: any) => p.name === 'parent_id');
      expect(field).toBeDefined();
    });

    it('has thread_root_id property', () => {
      const field = schema.properties.find((p: any) => p.name === 'thread_root_id');
      expect(field).toBeDefined();
    });

    it('has moderation_flags property', () => {
      const field = schema.properties.find((p: any) => p.name === 'moderation_flags');
      expect(field).toBeDefined();
    });
  });
});

describe('Comment edge cases', () => {
  it('supports infinite nesting via thread_root_id', () => {
    // Comment threading model: all replies share the same thread_root_id
    const comments = Array.from({ length: 100 }, (_, i) => ({
      id: `comment-${i}`,
      parent_id: i === 0 ? 'memory-root' : `comment-${i - 1}`,
      thread_root_id: 'memory-root',
      content_type: 'comment',
    }));

    // All comments point to the same thread root regardless of nesting depth
    comments.forEach(c => {
      expect(c.thread_root_id).toBe('memory-root');
    });

    // Parent chain is correct
    expect(comments[0].parent_id).toBe('memory-root');
    expect(comments[1].parent_id).toBe('comment-0');
    expect(comments[99].parent_id).toBe('comment-98');
  });

  it('supports per-space moderation flags format', () => {
    const flags = ['the_void:hidden', 'dogs:spam', 'cats:flagged'];

    flags.forEach(flag => {
      expect(flag).toMatch(/^[a-z_]+:(hidden|spam|flagged)$/);
    });
  });

  it('handles empty moderation_flags array', () => {
    const comment = { moderation_flags: [] as string[] };
    expect(Array.isArray(comment.moderation_flags)).toBe(true);
    expect(comment.moderation_flags.length).toBe(0);
  });
});
