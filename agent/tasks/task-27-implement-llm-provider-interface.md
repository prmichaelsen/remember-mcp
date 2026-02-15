# Task 27: Implement LLM Provider Interface

**Milestone**: Phase 0 - LLM Provider Abstraction  
**Estimated Time**: 2-3 hours  
**Dependencies**: None  
**Status**: Not Started

---

## Objective

Create the core LLM provider interface and type definitions that will be used by all LLM provider implementations.

## Steps

1. **Create LLM types file**
   - Create `src/llm/types.ts`
   - Define `LLMMessage` interface (role, content)
   - Define `LLMCompletionOptions` interface (temperature, maxTokens, etc.)
   - Define `LLMCompletionResult` interface (content, usage, finishReason)
   - Define `LLMProvider` interface with `complete()` and `validateConfig()` methods

2. **Add type exports**
   - Export all interfaces from `types.ts`
   - Ensure TypeScript strict mode compatibility
   - Add JSDoc comments for documentation

3. **Create index file**
   - Create `src/llm/index.ts`
   - Re-export all types for easy importing

## Verification

- [ ] TypeScript compiles without errors
- [ ] All interfaces are properly exported
- [ ] JSDoc comments are present
- [ ] Types follow existing project conventions
- [ ] Can import types: `import type { LLMProvider } from '../llm/types.js'`

## Files to Create

- `src/llm/types.ts` - Core type definitions
- `src/llm/index.ts` - Barrel export file

## Reference

See [`agent/design/llm-provider-abstraction.md`](../design/llm-provider-abstraction.md) lines 128-162 for interface definitions.

---

**Next Task**: [task-28-implement-llm-provider-factory.md](task-28-implement-llm-provider-factory.md)
