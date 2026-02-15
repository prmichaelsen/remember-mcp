# Task 28: Implement LLM Provider Factory

**Milestone**: Phase 0 - LLM Provider Abstraction  
**Estimated Time**: 2-3 hours  
**Dependencies**: task-27-implement-llm-provider-interface.md  
**Status**: Not Started

---

## Objective

Create the LLM provider factory that instantiates the correct provider based on configuration and provides a singleton instance.

## Steps

1. **Create factory file**
   - Create `src/llm/factory.ts`
   - Import `LLMProvider` interface from `types.ts`
   - Import config from `../config.js`

2. **Implement provider singleton**
   - Create `providerInstance` variable (initially null)
   - Implement `getLLMProvider()` function
   - Return cached instance if exists
   - Otherwise create new instance based on `config.llm.provider`

3. **Add provider switching logic**
   - Switch on provider type (bedrock, openai, anthropic)
   - Import provider classes dynamically
   - Call `validateConfig()` on instantiation
   - Log which provider is being used
   - Throw error for unsupported providers

4. **Add convenience function**
   - Implement `completeLLM()` function
   - Wrapper around `getLLMProvider().complete()`
   - Makes it easy to call LLM without getting provider first

5. **Add error handling**
   - Handle missing provider implementations gracefully
   - Provide clear error messages
   - Validate configuration before use

## Verification

- [ ] TypeScript compiles without errors
- [ ] Factory returns singleton instance
- [ ] Throws error for unsupported providers
- [ ] Validates configuration on instantiation
- [ ] Logs provider selection
- [ ] `completeLLM()` convenience function works
- [ ] Can be imported: `import { getLLMProvider, completeLLM } from '../llm/factory.js'`

## Files to Create

- `src/llm/factory.ts` - Provider factory and singleton

## Reference

See [`agent/design/llm-provider-abstraction.md`](../design/llm-provider-abstraction.md) lines 328-376 for factory implementation.

---

**Next Task**: [task-29-update-config-for-llm.md](task-29-update-config-for-llm.md)
