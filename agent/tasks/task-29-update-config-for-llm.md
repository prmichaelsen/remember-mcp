# Task 29: Update Config for LLM Providers

**Milestone**: Phase 0 - LLM Provider Abstraction  
**Estimated Time**: 1-2 hours  
**Dependencies**: None (can be done in parallel with task-27/28)  
**Status**: Not Started

---

## Objective

Update the configuration system to support multiple LLM providers with provider-specific settings.

## Steps

1. **Update config.ts**
   - Add `llm` configuration section
   - Add provider selection (`LLM_PROVIDER` env var)
   - Add model selection (`LLM_MODEL` env var)
   - Add provider-specific configs:
     - `openai`: apiKey, orgId
     - `anthropic`: apiKey
     - `bedrock`: region, accessKeyId, secretAccessKey, sessionToken
     - `cohere`: apiKey

2. **Add type definitions**
   - Define `LLMProvider` type: `'openai' | 'anthropic' | 'bedrock' | 'cohere' | 'custom'`
   - Export type for use in other files

3. **Set defaults**
   - Default provider: 'openai'
   - Default model: 'gpt-4o-mini'
   - Fallback to empty strings for missing keys

4. **Update .env.example**
   - Add LLM provider configuration section
   - Document all environment variables
   - Provide examples for each provider
   - Mark optional vs required variables

5. **Update config validation**
   - Add LLM config to validation output
   - Mask sensitive keys in logs
   - Validate required fields per provider

## Verification

- [ ] TypeScript compiles without errors
- [ ] Config exports `llm` section
- [ ] All provider configs are present
- [ ] `.env.example` is updated with examples
- [ ] Config validation includes LLM settings
- [ ] Sensitive keys are masked in logs
- [ ] Can access config: `import { config } from './config.js'`
- [ ] `config.llm.provider` returns correct type

## Files to Modify

- `src/config.ts` - Add LLM configuration
- `.env.example` - Add LLM environment variables

## Reference

See [`agent/design/llm-provider-abstraction.md`](../design/llm-provider-abstraction.md):
- Lines 33-67 for environment variables
- Lines 75-123 for config structure
- Lines 508-568 for .env.example

---

**Next Task**: [task-30-implement-bedrock-provider.md](task-30-implement-bedrock-provider.md)
