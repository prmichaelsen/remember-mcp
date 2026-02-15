# Task 31: Implement Background Job Service

**Milestone**: Phase 0 - LLM Provider Abstraction  
**Estimated Time**: 4-5 hours  
**Dependencies**: task-29 (config), Firestore setup  
**Status**: Not Started

---

## Objective

Create a background job service that can execute long-running LLM operations without blocking tool responses, with Firestore persistence for job status.

## Steps

1. **Create job types**
   - Create `src/services/background-jobs.service.ts`
   - Define `BackgroundJob` interface:
     - id, type, userId, status, timestamps, error
   - Define job types: `'core_memory_rebuild'` (extensible)
   - Define status types: `'pending' | 'running' | 'completed' | 'failed'`

2. **Implement BackgroundJobService class**
   - Create singleton service class
   - Add `runningJobs` Map to track active jobs
   - Implement `scheduleJob()` method:
     - Generate unique job ID
     - Create job object
     - Save to Firestore
     - Start processing (fire and forget)
     - Return job ID

3. **Implement job processing**
   - Implement `processJob()` private method:
     - Check if already running (prevent duplicates)
     - Track in runningJobs Map
     - Call executeJob()
     - Clean up from Map when done
   
4. **Implement job execution**
   - Implement `executeJob()` private method:
     - Update status to 'running' in Firestore
     - Switch on job type
     - Execute appropriate handler
     - Update status to 'completed' or 'failed'
     - Log results

5. **Implement Firestore persistence**
   - Create `src/services/background-jobs-firestore.ts`
   - Implement `saveJobToFirestore()`
   - Implement `updateJobInFirestore()`
   - Implement `getJobFromFirestore()`
   - Implement `cleanupOldJobs()` (remove jobs older than 7 days)

6. **Add job status query**
   - Implement `getJobStatus()` method
   - Query Firestore for job by ID
   - Return job object or null

7. **Export singleton**
   - Create and export singleton instance
   - Export types for use in other files

8. **Add error handling**
   - Wrap all async operations in try/catch
   - Log errors appropriately
   - Update job status to 'failed' on error
   - Don't crash the server on job failure

## Verification

- [ ] TypeScript compiles without errors
- [ ] Can schedule a job
- [ ] Job is saved to Firestore
- [ ] Job executes in background
- [ ] Tool response returns immediately
- [ ] Job status updates correctly
- [ ] Failed jobs are marked as failed
- [ ] Can query job status
- [ ] Old jobs are cleaned up
- [ ] Server doesn't crash on job failure
- [ ] Multiple jobs can run concurrently
- [ ] Duplicate jobs are prevented

## Files to Create

- `src/services/background-jobs.service.ts` - Main service
- `src/services/background-jobs-firestore.ts` - Firestore persistence

## Testing

Create a test job handler:
```typescript
// In executeJob()
case 'test_job':
  await new Promise(resolve => setTimeout(resolve, 5000));
  console.log('Test job completed');
  break;
```

Schedule and verify:
```typescript
const jobId = await backgroundJobs.scheduleJob('test_job', 'test-user');
console.log('Job scheduled:', jobId);
// Response should return immediately

// Check status after 6 seconds
setTimeout(async () => {
  const status = await backgroundJobs.getJobStatus(jobId);
  console.log('Job status:', status);
}, 6000);
```

## Reference

See [`agent/design/core-memory-user-profile.md`](../design/core-memory-user-profile.md) lines 593-750 for background job implementation.

---

**Next Task**: [task-32-test-llm-provider-integration.md](task-32-test-llm-provider-integration.md)
