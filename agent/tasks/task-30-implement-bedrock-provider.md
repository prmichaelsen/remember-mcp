# Task 30: Implement Bedrock LLM Provider

**Milestone**: Phase 0 - LLM Provider Abstraction
**Estimated Time**: 3-4 hours
**Dependencies**: task-27, task-28, task-29
**Status**: Not Started

---

## Objective

Implement the AWS Bedrock LLM provider to enable Claude Sonnet 4 usage through Bedrock.

**Model**: `anthropic.claude-sonnet-4-5-20250929-v1:0`

## Steps

1. **Install dependencies**
   - Add `@aws-sdk/client-bedrock-runtime` to package.json
   - Run `npm install`

2. **Create provider directory**
   - Create `src/llm/providers/` directory
   - Create `src/llm/providers/bedrock.provider.ts`

3. **Implement BedrockLLMProvider class**
   - Import `BedrockRuntimeClient`, `InvokeModelCommand` from AWS SDK
   - Import `LLMProvider` interface and types
   - Import config
   - Create class implementing `LLMProvider`

4. **Implement constructor**
   - Initialize `BedrockRuntimeClient` with credentials from config
   - Use `config.llm.bedrock.region` (us-east-1)
   - Use `config.llm.bedrock.accessKeyId`
   - Use `config.llm.bedrock.secretAccessKey`
   - Use `config.llm.bedrock.sessionToken` (optional)
   - Store client as private property

5. **Implement complete() method**
   - Accept messages and options
   - Get model from options or use `config.llm.model` (default: anthropic.claude-sonnet-4-5-20250929-v1:0)
   - Convert to Anthropic Bedrock format:
     - Extract system message (role === 'system')
     - Filter out system messages from conversation
     - Build request body:
       ```typescript
       {
         anthropic_version: 'bedrock-2023-05-31',
         max_tokens: options?.maxTokens || 4096,
         temperature: options?.temperature || 0.7,
         messages: conversationMessages,
         system: systemMessage?.content
       }
       ```
   - Create `InvokeModelCommand`:
     ```typescript
     new InvokeModelCommand({
       modelId: model,
       contentType: 'application/json',
       accept: 'application/json',
       body: JSON.stringify(body)
     })
     ```
   - Send command and parse response
   - Convert response to `LLMCompletionResult`:
     ```typescript
     {
       content: result.content[0].text,
       model: model,
       usage: {
         inputTokens: result.usage.input_tokens,
         outputTokens: result.usage.output_tokens,
         totalTokens: result.usage.input_tokens + result.usage.output_tokens
       },
       finishReason: result.stop_reason === 'end_turn' ? 'stop' : result.stop_reason
     }
     ```
   - Handle errors gracefully

6. **Implement validateConfig() method**
   - Check required config values:
     - `config.llm.bedrock.region` (should be 'us-east-1')
     - `config.llm.bedrock.accessKeyId`
     - `config.llm.bedrock.secretAccessKey`
   - Throw descriptive errors if missing:
     ```typescript
     if (!config.llm.bedrock.region) throw new Error('AWS_REGION required for Bedrock');
     if (!config.llm.bedrock.accessKeyId) throw new Error('AWS_ACCESS_KEY_ID required for Bedrock');
     if (!config.llm.bedrock.secretAccessKey) throw new Error('AWS_SECRET_ACCESS_KEY required for Bedrock');
     ```

7. **Add error handling**
   - Wrap AWS SDK calls in try/catch
   - Provide clear error messages
   - Log errors with context
   - Re-throw with additional context

8. **Update factory**
   - Import `BedrockLLMProvider` in factory.ts
   - Add case for 'bedrock' provider
   - Instantiate and return provider
   - Log: `[LLM] Using Bedrock provider with model: ${config.llm.model}`

## Verification

- [ ] TypeScript compiles without errors
- [ ] AWS SDK dependency installed
- [ ] Provider implements LLMProvider interface
- [ ] Constructor initializes Bedrock client
- [ ] complete() method works with test prompt
- [ ] validateConfig() checks required fields
- [ ] Errors are handled gracefully
- [ ] Factory can instantiate Bedrock provider
- [ ] Can complete a simple prompt: "Say hello"
- [ ] Response includes usage statistics

## Files to Create

- `src/llm/providers/bedrock.provider.ts` - Bedrock implementation

## Files to Modify

- `src/llm/factory.ts` - Add Bedrock case
- `package.json` - Add AWS SDK dependency

## Testing

Create a simple test script to verify:
```typescript
import { completeLLM } from './llm/factory.js';

const result = await completeLLM([
  { role: 'user', content: 'Say hello in one sentence.' }
]);

console.log('Response:', result.content);
console.log('Usage:', result.usage);
```

## Reference

See [`agent/design/llm-provider-abstraction.md`](../design/llm-provider-abstraction.md) lines 166-226 for Bedrock implementation.

---

**Next Task**: [task-31-implement-background-job-service.md](task-31-implement-background-job-service.md)
