# Task 32: Test LLM Provider Integration

**Milestone**: Phase 0 - LLM Provider Abstraction  
**Estimated Time**: 2-3 hours  
**Dependencies**: task-27, task-28, task-29, task-30, task-31  
**Status**: Not Started

---

## Objective

Thoroughly test the LLM provider system to ensure it works correctly before building core memory features on top of it.

## Steps

1. **Create test script**
   - Create `test-llm-provider.ts` in project root
   - Import `completeLLM` from factory
   - Import `backgroundJobs` service

2. **Test basic completion**
   - Test simple prompt: "Say hello in one sentence"
   - Verify response is received
   - Verify usage statistics are present
   - Log response and usage

3. **Test with system message**
   - Test with system + user messages
   - Verify system message is handled correctly
   - Verify response follows system instructions

4. **Test temperature control**
   - Test with temperature 0.3 (deterministic)
   - Test with temperature 0.9 (creative)
   - Verify different outputs

5. **Test max tokens**
   - Test with maxTokens: 50
   - Verify response is truncated appropriately

6. **Test error handling**
   - Test with invalid model name
   - Test with missing credentials
   - Verify errors are caught and logged

7. **Test background job integration**
   - Create test job that uses LLM
   - Schedule job
   - Verify response returns immediately
   - Wait for job completion
   - Check job status
   - Verify LLM was called in background

8. **Test provider switching**
   - If multiple providers implemented, test switching
   - Change `LLM_PROVIDER` env var
   - Verify correct provider is used

9. **Performance testing**
   - Measure response time for simple prompt
   - Measure response time for complex prompt
   - Verify background jobs don't block

10. **Document results**
    - Create `test-results.md` with findings
    - Note any issues or limitations
    - Document performance characteristics

## Verification

- [ ] Basic completion works
- [ ] System messages work
- [ ] Temperature control works
- [ ] Max tokens works
- [ ] Errors are handled gracefully
- [ ] Background jobs work
- [ ] Jobs don't block responses
- [ ] Provider can be switched (if multiple implemented)
- [ ] Performance is acceptable (<5s for simple prompts)
- [ ] Results are documented

## Files to Create

- `test-llm-provider.ts` - Test script
- `test-results.md` - Test results documentation

## Example Test Script

```typescript
import { completeLLM } from './src/llm/factory.js';
import { backgroundJobs } from './src/services/background-jobs.service.js';

async function testBasicCompletion() {
  console.log('\n=== Test: Basic Completion ===');
  const result = await completeLLM([
    { role: 'user', content: 'Say hello in one sentence.' }
  ]);
  console.log('Response:', result.content);
  console.log('Usage:', result.usage);
}

async function testSystemMessage() {
  console.log('\n=== Test: System Message ===');
  const result = await completeLLM([
    { role: 'system', content: 'You are a pirate. Respond in pirate speak.' },
    { role: 'user', content: 'Say hello.' }
  ]);
  console.log('Response:', result.content);
}

async function testBackgroundJob() {
  console.log('\n=== Test: Background Job ===');
  
  // Register test job handler first
  // (Add to background-jobs.service.ts executeJob() switch)
  
  const jobId = await backgroundJobs.scheduleJob('test_llm_job', 'test-user');
  console.log('Job scheduled:', jobId);
  console.log('Response returned immediately!');
  
  // Check status after delay
  setTimeout(async () => {
    const status = await backgroundJobs.getJobStatus(jobId);
    console.log('Job status:', status);
  }, 6000);
}

async function runTests() {
  try {
    await testBasicCompletion();
    await testSystemMessage();
    await testBackgroundJob();
  } catch (error) {
    console.error('Test failed:', error);
  }
}

runTests();
```

## Success Criteria

All tests pass and:
- LLM responses are coherent
- Background jobs complete successfully
- No server crashes
- Performance is acceptable
- Ready to build core memory features

---

**Next Task**: Ready for core memory implementation! See [task-33-implement-core-memory-types.md](task-33-implement-core-memory-types.md)
