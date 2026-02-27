# Task 182: Trust Enforcement Service

**Milestone**: M7 — Trust & Permissions
**Status**: pending
**Dependencies**: Task 180 (types)

---

## Objective

Implement prompt-based trust enforcement — format memories based on trust level for inclusion in LLM prompts. See `agent/design/trust-system-implementation.md`.

## Deliverables

### 1. `src/services/trust-enforcement.ts`

Core function: `formatMemoryForPrompt(memory, trustLevel)`:

- **Trust 1.0 (Full Access)**: Full content, all details
- **Trust 0.75 (Partial Access)**: Content with sensitive fields redacted
- **Trust 0.5 (Summary Only)**: Title + summary only, no content
- **Trust 0.25 (Metadata Only)**: Type, date, tags — no content or summary
- **Trust 0.0 (Existence Only)**: "A memory exists about this topic" — hint only

Additional functions:
- `getTrustLevelLabel(trust: number)` — human-readable label
- `getTrustInstructions(trust: number)` — LLM instruction text for each level
- `redactSensitiveFields(memory, trust)` — field-level redaction for partial access

Key rules:
- Trust is continuous 0-1, but behavior maps to nearest threshold
- Self-access ALWAYS returns full content (trust=1.0 equivalent)
- Redaction is additive — lower trust = more redacted

### 2. `src/services/trust-validator.ts`

Validation for trust-sensitive operations:

- `validateTrustAssignment(trustLevel, content?)` — warn if trust < 0.25 (very private)
- `suggestTrustLevel(contentType, tags?)` — suggest appropriate trust based on content type
- `isTrustSufficient(memoryTrust, accessorTrust)` — simple comparison

### 3. Tests

- `src/services/trust-enforcement.spec.ts` — test all 5 trust levels, edge cases, self-access
- `src/services/trust-validator.spec.ts` — test validation and suggestions

## Acceptance Criteria

- [ ] All 5 trust levels format correctly
- [ ] Self-access always returns full content
- [ ] Redaction works for partial access
- [ ] Trust labels and instructions are clear
- [ ] Validator catches low-trust assignments
- [ ] All tests pass
