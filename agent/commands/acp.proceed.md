# Command: proceed

> **🤖 Agent Directive**: If you are reading this file, the command `@acp-proceed` has been invoked. Follow the steps below to execute this command.

**Namespace**: acp
**Version**: 1.0.0
**Created**: 2026-02-16
**Last Updated**: 2026-02-16
**Status**: Active

---

**Purpose**: Continue with the current or next task, executing steps and updating progress tracking
**Category**: Workflow
**Frequency**: As Needed

---

## What This Command Does

This command enables you to continue working on the current task or move to the next task in the project. It reads the current task from `agent/progress.yaml`, loads the task document, guides you through executing the task steps, verifies completion, and updates progress tracking.

Use this command when you're ready to work on tasks after initializing context with `@acp-init`, or when continuing work during an active session. It's the primary command for making progress on the project's task list.

Unlike `@acp-status` which only displays information, `@acp-proceed` is an active command that guides task execution and modifies `agent/progress.yaml` to track progress.

---

## Prerequisites

- [ ] ACP installed in project
- [ ] `agent/progress.yaml` exists and has current task defined
- [ ] Current task document exists in `agent/tasks/`
- [ ] Context initialized (recommended to run `@acp-init` first)

---

## Steps

### 1. Read Progress Tracking

Read `agent/progress.yaml` to identify the current task.

**Actions**:
- Open and parse `agent/progress.yaml`
- Find the current milestone
- Identify the current task (first task with status `in_progress` or `not_started`)
- Note task ID, name, and file path

**Expected Outcome**: Current task identified

### 2. Load Task Document

Read the task document to understand what needs to be done.

**Actions**:
- Open the task file (e.g., `agent/tasks/task-3-implement-feature.md`)
- Read the objective
- Review all steps
- Note verification criteria
- Check for dependencies

**Expected Outcome**: Task requirements understood

### 3. Check Prerequisites

Verify any task prerequisites are met.

**Actions**:
- Review prerequisites section in task document
- Check if dependencies are satisfied
- Verify required tools/files are available
- Report any missing prerequisites

**Expected Outcome**: Prerequisites confirmed or blockers identified

### 4. Execute Task Steps

Work through the task steps sequentially.

**Actions**:
- Follow each step in the task document
- Execute required actions (create files, run commands, etc.)
- Document any deviations from the plan
- Handle errors appropriately

**Expected Outcome**: Task steps completed

### 5. Verify Completion

Check all verification items from the task document.

**Actions**:
- Go through verification checklist
- Run tests if specified
- Confirm all acceptance criteria met
- Note any incomplete items

**Expected Outcome**: Task verified as complete or issues identified

### 6. Update Progress Tracking

Update `agent/progress.yaml` with task completion.

**Actions**:
- Mark task status as `completed`
- Set completion date to today
- Update milestone progress percentage
- Increment `tasks_completed` count
- Add entry to `recent_work` section
- Update `next_steps` if needed

**Expected Outcome**: Progress tracking reflects completed work

### 7. Report Progress

Provide summary of what was accomplished.

**Actions**:
- Summarize task completion
- Show updated milestone progress
- Identify next task
- Note any blockers or issues

**Expected Outcome**: User informed of progress and next steps

---

## Verification

- [ ] Current task identified from progress.yaml
- [ ] Task document read and understood
- [ ] Prerequisites checked
- [ ] All task steps executed
- [ ] Verification checklist completed
- [ ] progress.yaml updated with completion
- [ ] Milestone progress percentage updated
- [ ] Recent work entry added
- [ ] Next task identified

---

## Expected Output

### Files Modified
- `agent/progress.yaml` - Task marked complete, progress updated, recent work added
- Task-specific files (as defined in task document)

### Console Output
```
📋 Current Task: task-3-implement-core-logic

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Objective: Implement the core business logic for the application

Steps:
  1. Create service layer classes
  2. Implement data access methods
  3. Add error handling
  4. Write unit tests

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Executing task steps...

✅ Step 1: Created service layer classes
✅ Step 2: Implemented data access methods
✅ Step 3: Added error handling
✅ Step 4: Wrote unit tests

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Verification:
✅ All service classes created
✅ Unit tests pass
✅ TypeScript compiles without errors
✅ Code follows project patterns

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Task 3 Complete!

Updated progress.yaml:
- Task 3: completed (2026-02-16)
- Milestone 1: 60% complete (3/5 tasks)
- Added to recent work

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 Next Task: task-4-add-integration-tests
File: agent/tasks/task-4-add-integration-tests.md
Estimated: 3 hours
```

### Status Update
- Task status: `not_started` → `completed`
- Milestone progress: 40% → 60%
- Tasks completed: 2 → 3

---

## Examples

### Example 1: Continuing Current Task

**Context**: You're in the middle of task-3 and want to continue working on it

**Invocation**: `@acp-proceed`

**Result**: Loads task-3, shows remaining steps, guides you through completion, updates progress when done

### Example 2: Starting Next Task

**Context**: Just finished task-2, ready to start task-3

**Invocation**: `@acp-proceed`

**Result**: Identifies task-3 as next, loads task document, guides through all steps, marks complete when done

### Example 3: Task with Blockers

**Context**: Task has unmet prerequisites

**Invocation**: `@acp-proceed`

**Result**: Identifies missing prerequisites, reports blockers, suggests resolution steps, does not proceed until resolved

---

## Related Commands

- [`@acp-init`](acp.init.md) - Use before proceeding to ensure full context loaded
- [`@acp-status`](acp.status.md) - Use to check which task is current before proceeding
- [`@acp-update`](acp.update.md) - Use to manually update progress if needed
- [`@acp-sync`](acp.sync.md) - Use after completing tasks to sync documentation

---

## Troubleshooting

### Issue 1: No current task found

**Symptom**: Error message "No current task identified"

**Cause**: All tasks are completed or progress.yaml doesn't have a current task

**Solution**: Review progress.yaml and either mark a task as `in_progress` or create new tasks for the next milestone

### Issue 2: Task document not found

**Symptom**: Error message "Cannot read task file"

**Cause**: Task file path in progress.yaml is incorrect or file doesn't exist

**Solution**: Verify the file path in progress.yaml matches the actual task file location, or create the missing task document

### Issue 3: Prerequisites not met

**Symptom**: Command reports missing prerequisites

**Cause**: Task has dependencies that aren't satisfied yet

**Solution**: Complete prerequisite tasks first, or resolve the dependencies, then run `@acp-proceed` again

### Issue 4: Verification fails

**Symptom**: Some verification items don't pass

**Cause**: Task steps weren't completed correctly or there are errors

**Solution**: Review the failed verification items, fix issues, then re-run verification steps

---

## Security Considerations

### File Access
- **Reads**: `agent/progress.yaml`, current task document, related design documents
- **Writes**: `agent/progress.yaml` (updates task status and progress), task-specific files as defined in task document
- **Executes**: May execute commands as specified in task steps (e.g., `npm test`, `npm run build`)

### Network Access
- **APIs**: May make API calls if task requires it
- **Repositories**: May interact with git if task requires it

### Sensitive Data
- **Secrets**: Should not access secrets unless task explicitly requires configuration
- **Credentials**: Should not access credentials files

---

## Notes

- This command modifies `agent/progress.yaml` to track progress
- Task execution may create, modify, or delete files as specified in the task document
- Always review task steps before proceeding to understand what will be done
- Use `@acp-status` first to see which task is current
- If task is complex, consider breaking it into smaller steps
- Update progress.yaml manually if command doesn't complete successfully

---

**Namespace**: acp
**Command**: proceed
**Version**: 1.0.0
**Created**: 2026-02-16
**Last Updated**: 2026-02-16
**Status**: Active
**Compatibility**: ACP 1.0.3+
**Author**: ACP Project
