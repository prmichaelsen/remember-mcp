# Content Flag System

**Concept**: Multi-flag content rating system with tiered sexual content and combinable independent flags
**Created**: 2026-02-27
**Status**: Design Specification

---

## Overview

This design defines a content flag system that supports multiple simultaneous flags per content entity. Content flags classify content appropriateness using a tiered sexual content scale and independent combinable flags. This replaces the current single `contentFlag` field with a structured multi-flag approach.

---

## Problem Statement

- The current `contentFlag` field is a single enum value, which cannot represent content that is e.g. both violent and sexually suggestive
- There is no `nudity` tier to distinguish sexually explicit content from merely NSFW content
- No enforcement of mutual exclusivity rules (e.g. `justforkids` should never combine with `nsfw`)
- Creators cannot accurately classify content that spans multiple categories

---

## Solution

Split content flags into two groups with different combination rules:

### Sexual Content Tier (mutually exclusive, pick one)

Escalating scale — only one can be selected:

| Flag | Description |
|------|-------------|
| `justforkids` | PG content suitable for children. **Mutually exclusive with ALL other flags.** |
| `sfw` | Suitable for mature adults and work environments. Mutually exclusive with sexual flags above it. |
| `suggestive` | Sexually suggestive but no explicit content |
| `nsfw` | Not safe for work — risqué but not sexually explicit |
| `nudity` | Sexually explicit content |

Hierarchy: `justforkids` < `sfw` < `suggestive` < `nsfw` < `nudity`

### Independent Flags (combinable)

Can be combined with each other and with any sexual tier flag (except `justforkids`):

| Flag | Description |
|------|-------------|
| `mature` | Explicit language or mature topics |
| `violence` | Depicts or infers violence |
| `nsfl` | Death, disturbing scenes, or suicide |

### Exclusivity Rules

1. **`justforkids`** is mutually exclusive with ALL other flags (sexual and independent)
2. **Sexual tier** flags are mutually exclusive with each other (pick exactly one)
3. **Independent flags** can be combined freely with each other
4. **Independent flags** can be combined with any sexual tier flag except `justforkids`
5. **`sfw`** is mutually exclusive with sexual content flags above it (`suggestive`, `nsfw`, `nudity`) but CAN coexist with independent flags (`mature`, `violence`, `nsfl`)

---

## Implementation

### Type Definitions

```typescript
/** Sexual content tier — mutually exclusive, pick one */
type SexualContentTier = 'justforkids' | 'sfw' | 'suggestive' | 'nsfw' | 'nudity';

/** Independent content flags — combinable */
type IndependentContentFlag = 'mature' | 'violence' | 'nsfl';

/** All possible content flag values */
type ContentFlagValue = SexualContentTier | IndependentContentFlag;

/**
 * Content flags for an entity.
 * - Exactly one SexualContentTier is required
 * - Zero or more IndependentContentFlags may be added
 * - If tier is 'justforkids', no independent flags are allowed
 */
interface ContentFlags {
  /** The sexual content tier (required, exactly one) */
  tier: SexualContentTier;
  /** Additional independent flags (empty array if justforkids) */
  flags: IndependentContentFlag[];
}
```

### Validation

```typescript
function validateContentFlags(contentFlags: ContentFlags): boolean {
  // justforkids is exclusive with everything
  if (contentFlags.tier === 'justforkids' && contentFlags.flags.length > 0) {
    return false;
  }
  // No duplicate independent flags
  if (new Set(contentFlags.flags).size !== contentFlags.flags.length) {
    return false;
  }
  return true;
}
```

### Migration from Single contentFlag

The existing `contentFlag` field maps to the new structure:

| Old `contentFlag` | New `tier` | New `flags` |
|-------------------|------------|-------------|
| `justforkids` | `justforkids` | `[]` |
| `sfw` | `sfw` | `[]` |
| `suggestive` | `suggestive` | `[]` |
| `nsfw` | `nsfw` | `[]` |
| `mature` | `sfw` | `['mature']` |
| `violence` | `sfw` | `['violence']` |
| `nsfl` | `sfw` | `['nsfl']` |
| `undefined` | `sfw` | `[]` (default) |

### Database Schema

```typescript
// On ContentEntityProperties (base-types.ts)
interface ContentEntityProperties {
  // Replace:  contentFlag?: ContentFlagValue;
  // With:
  contentFlags?: ContentFlags;
}
```

### Seed Data Updates

Add `nudity` content model to seed route:

```typescript
{
  type: 'content_model',
  modelType: 'nudity',
  name: '@overseer/content_model/nudity',
  displayName: 'Nudity',
  mainContent: 'Sexually explicit content.'
}
```

---

## Benefits

- **Accuracy**: Content can be classified across multiple dimensions simultaneously
- **Granularity**: Distinguishes NSFW (risqué) from nudity (sexually explicit)
- **Safety**: `justforkids` strictly isolated from all mature content
- **Extensibility**: Independent flags can be added without changing the tier system
- **Backwards Compatible**: Existing single flags map cleanly to new structure

---

## Trade-offs

- **Complexity**: Multi-flag validation is more complex than a single enum
- **Migration**: Existing content needs migrating from single flag to structured flags
- **UI**: Flag selection UI needs to enforce exclusivity rules client-side
- **Storage**: Slightly more data per entity (object vs string)

---

## Dependencies

- `goodneighbor-types` — type definitions need updating
- `DbContentModel` — needs `nudity` model type added
- Seed route — needs new model instance
- Search/Algolia — indexing needs to support multi-flag filtering

---

## Testing Strategy

- Validate that `justforkids` rejects any additional flags
- Validate that only one sexual tier can be selected
- Validate that independent flags combine freely
- Test migration mapping from old single-flag to new structure
- Test search filtering with multi-flag content

---

## Migration Path

1. Add `nudity` to `DbContentModel.modelType` union type
2. Add `ContentFlags` interface to `goodneighbor-types`
3. Add `contentFlags` field to `ContentEntityProperties` (alongside existing `contentFlag`)
4. Migrate existing content: map old `contentFlag` → new `contentFlags`
5. Update seed data with `nudity` model
6. Update UI to use new multi-flag selection
7. Deprecate and remove old `contentFlag` field

---

## Future Considerations

- UI components for multi-flag selection with exclusivity enforcement
- Age gate system using tier hierarchy
- Feed-level content filtering based on flags
- User preference for default content visibility
- Automated content classification (AI-assisted flagging)

---

**Status**: Design Specification
**Recommendation**: Implement migration path starting with type definitions
**Related Documents**: [content-entity-design.md](content-entity-design.md), [feed-system-design.md](feed-system-design.md), [publish-workflow-design.md](publish-workflow-design.md)
