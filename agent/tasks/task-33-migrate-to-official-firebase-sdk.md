# Task 33: Migrate to Official Firebase Admin SDK

**Milestone**: Infrastructure Improvement  
**Estimated Time**: 3-4 hours  
**Dependencies**: None (can be done anytime)  
**Status**: Not Started

---

## Objective

Migrate from `@prmichaelsen/firebase-admin-sdk-v8` to the official `firebase-admin` SDK for better support, types, and features.

## Problem

Currently using a custom v8-style wrapper that:
- Lacks official support
- Has incomplete type definitions
- Doesn't match modern Firebase patterns
- Makes integration harder

## Solution

Migrate to official `firebase-admin` SDK which:
- Has full TypeScript support
- Is officially maintained by Google
- Has complete documentation
- Supports all Firebase features

## Steps

1. **Install official SDK**
   ```bash
   npm install firebase-admin
   npm uninstall @prmichaelsen/firebase-admin-sdk-v8
   ```

2. **Update Firestore initialization**
   - Modify `src/firestore/init.ts`
   - Use `admin.initializeApp()` and `admin.firestore()`
   - Update service account initialization

3. **Update all Firestore usage**
   - Replace wrapper functions with native Firestore API
   - Update `src/services/preferences-database.service.ts`
   - Update `src/services/background-jobs-firestore.ts`
   - Update any other files using Firestore

4. **Update patterns documentation**
   - Update `agent/patterns/firebase-admin-sdk-v8-usage.md`
   - Rename to `firebase-admin-usage.md`
   - Document new patterns

5. **Test all Firestore operations**
   - Test preferences service
   - Test background jobs
   - Test any other Firestore operations

## Benefits

- ✅ Official support and updates
- ✅ Better TypeScript types
- ✅ Complete feature set
- ✅ Better documentation
- ✅ Easier to find help/examples

## Migration Example

**Before (v8 wrapper):**
```typescript
import { getDocument, setDocument } from '../firestore/init.js';

const doc = await getDocument('collection', 'docId');
await setDocument('collection', 'docId', data);
```

**After (official SDK):**
```typescript
import { getFirestore } from '../firestore/init.js';

const db = getFirestore();
const doc = await db.collection('collection').doc('docId').get();
await db.collection('collection').doc('docId').set(data);
```

## Files to Modify

- `src/firestore/init.ts` - Initialization
- `src/services/preferences-database.service.ts` - Preferences
- `src/services/background-jobs-firestore.ts` - Background jobs
- `agent/patterns/firebase-admin-sdk-v8-usage.md` - Documentation
- Any other files using Firestore

## Verification

- [ ] TypeScript compiles without errors
- [ ] All Firestore operations work
- [ ] Tests pass
- [ ] Documentation updated
- [ ] No references to old SDK remain

---

**Priority**: Medium (not blocking, but should be done soon)  
**Impact**: Improves maintainability and developer experience
