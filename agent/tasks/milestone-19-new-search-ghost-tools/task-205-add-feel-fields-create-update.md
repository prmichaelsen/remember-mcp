# Task 205: Add `feel_*` Fields to create_memory and update_memory Schemas

**Milestone**: M19 — New Search Modes, Ghost Tools & Emotional Exposure
**Status**: Not Started
**Created**: 2026-03-07
**Estimated Hours**: 2-3
**Dependencies**: remember-core schema with 31 `feel_*` Weaviate properties

---

## Objective

Add all 31 optional `feel_*` emotional dimension fields to `remember_create_memory` and `remember_update_memory` input schemas. These are create-time hints that REM re-scores authoritatively during its consolidation cycle.

## Context

remember-core's emotional weighting design adds 31 `feel_*` properties to the Memory Weaviate schema (21 discrete emotions + 10 functional signals). The creating LLM can provide sane defaults at creation time. All fields are optional floats (0-1, except `feel_valence` which is -1 to 1).

## Complete Field List

### Layer 1: Discrete Emotions (21 dimensions)

| Property | Range | Category | Description |
|----------|-------|----------|-------------|
| `feel_emotional_significance` | 0-1 | Meta | Overall emotional weight |
| `feel_vulnerability` | 0-1 | Meta | Personal exposure/openness |
| `feel_trauma` | 0-1 | Meta | Negative formative experience intensity |
| `feel_humor` | 0-1 | Positive | Comedic/playful quality |
| `feel_happiness` | 0-1 | Core | Positive affect / joy |
| `feel_sadness` | 0-1 | Core | Negative affect / grief / loss |
| `feel_fear` | 0-1 | Core | Threat perception / anxiety |
| `feel_anger` | 0-1 | Core | Frustration / injustice |
| `feel_surprise` | 0-1 | Core | Unexpectedness / novelty |
| `feel_disgust` | 0-1 | Core | Aversion / rejection |
| `feel_contempt` | 0-1 | Core | Superiority / dismissal |
| `feel_embarrassment` | 0-1 | Self-conscious | Social discomfort |
| `feel_shame` | 0-1 | Self-conscious | Deep self-judgment |
| `feel_guilt` | 0-1 | Self-conscious | Responsibility for harm |
| `feel_excitement` | 0-1 | Positive | Anticipatory positive arousal |
| `feel_pride` | 0-1 | Positive | Accomplishment / self-evaluation |
| `feel_valence` | **-1 to 1** | VAD | Positive-negative spectrum |
| `feel_arousal` | 0-1 | VAD | Calm to excited |
| `feel_dominance` | 0-1 | VAD | Control vs submission |
| `feel_intensity` | 0-1 | Dimensional | Overall emotional magnitude |
| `feel_coherence_tension` | 0-1 | Cognitive | Conflict with existing beliefs |

### Layer 2: Functional Signals (10 dimensions)

| Property | Range | Biological Analog | Function |
|----------|-------|-------------------|----------|
| `feel_salience` | 0-1 | Fear/Surprise | How unexpected/novel (prediction error) |
| `feel_urgency` | 0-1 | Anger/Fear | Time-sensitivity of relevance (decay rate) |
| `feel_social_weight` | 0-1 | Trust/Disgust | Relationship/reputation impact |
| `feel_agency` | 0-1 | Pride/Shame | Caused by the bot's own actions? |
| `feel_novelty` | 0-1 | — | Uniqueness relative to collection |
| `feel_retrieval_utility` | 0-1 | — | Likelihood of future usefulness |
| `feel_narrative_importance` | 0-1 | — | Advances/anchors a personal story arc |
| `feel_aesthetic_quality` | 0-1 | — | Beauty, craft, artistry |
| `feel_valence` | (shared) | — | Scored independently in functional context |
| `feel_coherence_tension` | (shared) | — | Scored independently in functional context |

> **Note**: `feel_valence` and `feel_coherence_tension` appear in both layers but are scored independently. In Weaviate they are single properties — the REM scoring considers both emotional and functional context when setting the value.

## Schema Addition Pattern

```typescript
// Added to inputSchema.properties for both create_memory and update_memory:

// Layer 1: Discrete Emotions (all optional, 0-1 floats except feel_valence)
feel_emotional_significance: { type: 'number', minimum: 0, maximum: 1 },
feel_vulnerability: { type: 'number', minimum: 0, maximum: 1 },
feel_trauma: { type: 'number', minimum: 0, maximum: 1 },
feel_humor: { type: 'number', minimum: 0, maximum: 1 },
feel_happiness: { type: 'number', minimum: 0, maximum: 1 },
feel_sadness: { type: 'number', minimum: 0, maximum: 1 },
feel_fear: { type: 'number', minimum: 0, maximum: 1 },
feel_anger: { type: 'number', minimum: 0, maximum: 1 },
feel_surprise: { type: 'number', minimum: 0, maximum: 1 },
feel_disgust: { type: 'number', minimum: 0, maximum: 1 },
feel_contempt: { type: 'number', minimum: 0, maximum: 1 },
feel_embarrassment: { type: 'number', minimum: 0, maximum: 1 },
feel_shame: { type: 'number', minimum: 0, maximum: 1 },
feel_guilt: { type: 'number', minimum: 0, maximum: 1 },
feel_excitement: { type: 'number', minimum: 0, maximum: 1 },
feel_pride: { type: 'number', minimum: 0, maximum: 1 },
feel_valence: { type: 'number', minimum: -1, maximum: 1 },  // Note: -1 to 1
feel_arousal: { type: 'number', minimum: 0, maximum: 1 },
feel_dominance: { type: 'number', minimum: 0, maximum: 1 },
feel_intensity: { type: 'number', minimum: 0, maximum: 1 },
feel_coherence_tension: { type: 'number', minimum: 0, maximum: 1 },

// Layer 2: Functional Signals (all optional, 0-1 floats)
feel_salience: { type: 'number', minimum: 0, maximum: 1 },
feel_urgency: { type: 'number', minimum: 0, maximum: 1 },
feel_social_weight: { type: 'number', minimum: 0, maximum: 1 },
feel_agency: { type: 'number', minimum: 0, maximum: 1 },
feel_novelty: { type: 'number', minimum: 0, maximum: 1 },
feel_retrieval_utility: { type: 'number', minimum: 0, maximum: 1 },
feel_narrative_importance: { type: 'number', minimum: 0, maximum: 1 },
feel_aesthetic_quality: { type: 'number', minimum: 0, maximum: 1 },
```

## Key Decisions

- **These are hints, not permanent values**: Tool description must say "create-time hints, REM re-scores authoritatively during consolidation cycles"
- **`feel_valence` range is -1 to 1**: All other feel_* fields are 0-1. This is intentional — valence represents positive-negative spectrum.
- **`feel_valence` and `feel_coherence_tension` are shared**: They appear in both Layer 1 (discrete emotions) and Layer 2 (functional signals) conceptually, but are single Weaviate properties.
- **No composite fields on create/update**: `feel_significance`, `functional_significance`, `total_significance` are computed by REM only — they are NOT accepted on create/update.
- **Consider grouping**: Optionally group under a nested `emotions` object to avoid polluting the top-level parameter list. Evaluate whether the existing tool pattern uses nested objects or flat params.
- **31 unique properties total**: 21 Layer 1 + 10 Layer 2, but `feel_valence` and `feel_coherence_tension` overlap → 29 unique Weaviate property names.

## Steps

1. Update `src/tools/create-memory.ts`:
   - Add all feel_* fields to inputSchema (per schema above)
   - Add description note about hints vs REM authoritative scoring
   - Extract feel_* fields from args and pass to core `create()` call
2. Update `src/tools/update-memory.ts`:
   - Add same feel_* fields to inputSchema
   - Extract and pass to core `update()` call
3. Write tests:
   - Verify feel_* fields are passed through to core on create
   - Verify feel_* fields are passed through to core on update
   - Verify feel_valence accepts -1 to 1
   - Verify composite fields (total_significance, etc.) are NOT accepted

## Verification

- [ ] All 31 `feel_*` fields accepted on create_memory
- [ ] All 31 `feel_*` fields accepted on update_memory
- [ ] Fields passed through to core service calls
- [ ] `feel_valence` correctly allows -1 to 1 range
- [ ] All other `feel_*` fields correctly allow 0 to 1 range
- [ ] Composite fields NOT accepted (feel_significance, functional_significance, total_significance)
- [ ] Tool descriptions clearly state these are create-time hints
- [ ] Tests passing
- [ ] TypeScript clean
