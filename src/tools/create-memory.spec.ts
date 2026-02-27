/**
 * Unit tests for remember_create_memory and remember_update_memory tools (Task 170)
 *
 * Tests cover:
 * - Tool definition schemas
 * - Tracking arrays (space_ids, group_ids) are NOT user-settable via input schema
 * - Required fields and optional fields
 */

import { createMemoryTool } from './create-memory.js';
import { updateMemoryTool } from './update-memory.js';

// ---------------------------------------------------------------------------
// createMemoryTool definition
// ---------------------------------------------------------------------------

describe('createMemoryTool definition', () => {
  it('has correct tool name', () => {
    expect(createMemoryTool.name).toBe('remember_create_memory');
  });

  it('has a non-empty description', () => {
    expect(createMemoryTool.description.length).toBeGreaterThan(0);
  });

  it('requires only content', () => {
    expect(createMemoryTool.inputSchema.required).toEqual(['content']);
  });

  it('has content as a string property', () => {
    const props = createMemoryTool.inputSchema.properties as Record<string, any>;
    expect(props.content).toBeDefined();
    expect(props.content.type).toBe('string');
  });

  it('has optional type property', () => {
    const props = createMemoryTool.inputSchema.properties as Record<string, any>;
    expect(props.type).toBeDefined();
    expect(createMemoryTool.inputSchema.required).not.toContain('type');
  });

  it('has optional weight property with range 0-1', () => {
    const props = createMemoryTool.inputSchema.properties as Record<string, any>;
    expect(props.weight).toBeDefined();
    expect(props.weight.minimum).toBe(0);
    expect(props.weight.maximum).toBe(1);
  });

  it('has optional tags array', () => {
    const props = createMemoryTool.inputSchema.properties as Record<string, any>;
    expect(props.tags).toBeDefined();
    expect(props.tags.type).toBe('array');
  });

  it('does NOT expose space_ids in input schema (managed by publish/retract)', () => {
    const props = createMemoryTool.inputSchema.properties as Record<string, any>;
    expect(props.space_ids).toBeUndefined();
  });

  it('does NOT expose group_ids in input schema (managed by publish/retract)', () => {
    const props = createMemoryTool.inputSchema.properties as Record<string, any>;
    expect(props.group_ids).toBeUndefined();
  });

  it('does NOT require space_ids or group_ids', () => {
    const required = createMemoryTool.inputSchema.required as string[];
    expect(required).not.toContain('space_ids');
    expect(required).not.toContain('group_ids');
  });

  it('has moderation_flags with default empty array', () => {
    const props = createMemoryTool.inputSchema.properties as Record<string, any>;
    expect(props.moderation_flags).toBeDefined();
    expect(props.moderation_flags.default).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// updateMemoryTool definition
// ---------------------------------------------------------------------------

describe('updateMemoryTool definition', () => {
  it('has correct tool name', () => {
    expect(updateMemoryTool.name).toBe('remember_update_memory');
  });

  it('has a non-empty description', () => {
    expect(updateMemoryTool.description.length).toBeGreaterThan(0);
  });

  it('requires only memory_id', () => {
    expect(updateMemoryTool.inputSchema.required).toEqual(['memory_id']);
  });

  it('has memory_id as a string property', () => {
    const props = updateMemoryTool.inputSchema.properties as Record<string, any>;
    expect(props.memory_id).toBeDefined();
    expect(props.memory_id.type).toBe('string');
  });

  it('does NOT expose space_ids in input schema (managed by publish/retract)', () => {
    const props = updateMemoryTool.inputSchema.properties as Record<string, any>;
    expect(props.space_ids).toBeUndefined();
  });

  it('does NOT expose group_ids in input schema (managed by publish/retract)', () => {
    const props = updateMemoryTool.inputSchema.properties as Record<string, any>;
    expect(props.group_ids).toBeUndefined();
  });

  it('does NOT require space_ids or group_ids', () => {
    const required = updateMemoryTool.inputSchema.required as string[];
    expect(required).not.toContain('space_ids');
    expect(required).not.toContain('group_ids');
  });

  it('has optional content, title, type, weight, trust, tags properties', () => {
    const props = updateMemoryTool.inputSchema.properties as Record<string, any>;
    expect(props.content).toBeDefined();
    expect(props.title).toBeDefined();
    expect(props.type).toBeDefined();
    expect(props.weight).toBeDefined();
    expect(props.trust).toBeDefined();
    expect(props.tags).toBeDefined();
  });
});
