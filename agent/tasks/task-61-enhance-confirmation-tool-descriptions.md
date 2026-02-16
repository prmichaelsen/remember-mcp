# Task 61: Enhance Confirmation Tool Descriptions with Safety Guidelines

**Milestone**: M10 (Shared Spaces & Confirmation Flow)
**Estimated Time**: 1 hour
**Dependencies**: Tasks 36-38 (Publish, Confirm, Deny tools)
**Status**: Not Started

---

## Objective

Update the tool descriptions for `remember_confirm` and `remember_deny` to include critical safety guidelines that prevent agents from chaining confirmation actions inappropriately. These guidelines ensure agents follow proper confirmation workflows and obtain explicit user consent before executing sensitive operations.

---

## Context

The current tool descriptions for `remember_confirm` and `remember_deny` don't explicitly warn agents about the critical requirement to obtain user confirmation in a separate interaction. This can lead to agents attempting to chain confirmation calls immediately after receiving a token, bypassing the intended user consent step.

**Problem**: Agents might do this:
```typescript
// ❌ WRONG: Chaining confirm immediately
const publishResult = await remember_publish({ memory_id: "abc", spaces: ["the_void"] });
const confirmResult = await remember_confirm({ token: publishResult.token });  // NO USER CONSENT!
```

**Correct behavior**: Agents should do this:
```typescript
// ✅ CORRECT: Get token, ask user, then confirm in separate message
const publishResult = await remember_publish({ memory_id: "abc", spaces: ["the_void"] });
// Agent: "User, do you want to publish this memory to The Void? Token: xyz"
// [User responds in SEPARATE message: "Yes"]
// Agent in NEW message: 
const confirmResult = await remember_confirm({ token: publishResult.token });
```

---

## Steps

### 1. Update remember_confirm Tool Description

Modify [`src/tools/confirm.ts`](../../src/tools/confirm.ts) tool description:

**Current**:
```typescript
description: 'Confirm and execute a pending action using the token. Works for any action that requires confirmation (publish, delete, etc.).',
```

**Updated**:
```typescript
description: `Confirm and execute a pending action using the token. Works for any action that requires confirmation (publish, delete, etc.).

⚠️ CRITICAL SAFETY REQUIREMENTS:
Before executing this tool, you MUST:
1. Have received the confirmation token in a PREVIOUS tool response
2. Have presented the token details to the user for review
3. Have received EXPLICIT user confirmation in a SEPARATE user message
4. NEVER chain this tool with other tool calls in the same response
5. ALWAYS treat confirmations as standalone, deliberate actions

Violating these requirements bypasses user consent and is a security violation.`,
```

### 2. Update remember_deny Tool Description

Modify [`src/tools/deny.ts`](../../src/tools/deny.ts) tool description:

**Current**:
```typescript
description: 'Deny a pending action. The request will be marked as denied and the token invalidated. Works for any action that requires confirmation.',
```

**Updated**:
```typescript
description: `Deny a pending action. The request will be marked as denied and the token invalidated. Works for any action that requires confirmation.

⚠️ CRITICAL SAFETY REQUIREMENTS:
Before executing this tool, you MUST:
1. Have received the confirmation token in a PREVIOUS tool response
2. Have presented the token details to the user for review
3. Have received EXPLICIT user denial in a SEPARATE user message
4. NEVER chain this tool with other tool calls in the same response
5. ALWAYS treat denials as standalone, deliberate actions

This ensures proper user consent workflow is followed.`,
```

### 3. Add Safety Notes to Tool Comments

Add JSDoc comments above the tool definitions emphasizing the safety requirements:

```typescript
/**
 * Tool definition for remember_confirm
 * 
 * CRITICAL SAFETY: This tool must ONLY be called after explicit user confirmation
 * in a separate message. Never chain with other tools or call immediately after
 * receiving a token. The confirmation workflow requires:
 * 
 * 1. Agent calls remember_publish (or other confirmable action)
 * 2. Agent receives token in response
 * 3. Agent presents details to user and asks for confirmation
 * 4. User responds in SEPARATE message with explicit yes/no
 * 5. Agent calls remember_confirm or remember_deny in NEW response
 * 
 * Chaining confirmations bypasses user consent and violates security model.
 */
export const confirmTool: Tool = {
  // ... tool definition
};
```

### 4. Update Design Document

Update [`agent/design/publish-tools-confirmation-flow.md`](../../agent/design/publish-tools-confirmation-flow.md) to include these safety guidelines:

Add a new section:

```markdown
## Safety Guidelines for Agents

### Critical Requirements

Agents using the confirmation flow MUST follow these rules:

1. **Separate Messages**: Confirmation must happen in a separate user message
   - ❌ WRONG: Chain confirm immediately after publish
   - ✅ CORRECT: Wait for user response, then confirm

2. **Explicit Consent**: User must explicitly say "yes" or "confirm"
   - ❌ WRONG: Assume user wants to confirm
   - ✅ CORRECT: Ask user and wait for explicit response

3. **No Chaining**: Never call confirm/deny with other tools
   - ❌ WRONG: `[remember_publish, remember_confirm]` in same response
   - ✅ CORRECT: `remember_publish` in one response, wait, then `remember_confirm`

4. **Present Details**: Show user what they're confirming
   - ❌ WRONG: "Do you want to confirm?"
   - ✅ CORRECT: "Do you want to publish 'My Memory' to The Void and Dogs spaces?"

5. **Standalone Actions**: Treat confirmations as deliberate, standalone operations
   - ❌ WRONG: Confirm as part of larger workflow
   - ✅ CORRECT: Confirm as dedicated action

### Example Correct Flow

\`\`\`
Agent Message 1:
  Tool: remember_publish({ memory_id: "abc", spaces: ["the_void"] })
  Response: { token: "xyz123" }
  Agent to User: "I'd like to publish your memory 'Hiking Tips' to The Void. 
                  This will make it discoverable by other users. 
                  Do you want to proceed?"

User Message 2:
  "Yes, publish it"

Agent Message 3:
  Tool: remember_confirm({ token: "xyz123" })
  Response: { success: true, space_memory_id: "def456" }
  Agent to User: "Memory published successfully to The Void!"
\`\`\`

### Example Incorrect Flow

\`\`\`
Agent Message 1:
  Tool 1: remember_publish({ memory_id: "abc", spaces: ["the_void"] })
  Tool 2: remember_confirm({ token: "xyz123" })  // ❌ NO USER CONSENT!
  Agent to User: "Published your memory!"
\`\`\`

This bypasses user consent and violates the security model.
```

### 5. Test the Updated Descriptions

Verify the updated descriptions appear correctly:

```bash
# Build the project
npm run build

# Check that tools are registered with updated descriptions
# (Manual verification in MCP client or by inspecting tool definitions)
```

---

## Verification

- [ ] `remember_confirm` tool description includes safety requirements
- [ ] `remember_deny` tool description includes safety requirements
- [ ] JSDoc comments added above tool definitions
- [ ] Design document updated with safety guidelines section
- [ ] Safety guidelines include examples of correct and incorrect flows
- [ ] Tool descriptions use ⚠️ emoji for visibility
- [ ] All 5 critical requirements listed in both tools
- [ ] TypeScript compiles without errors: `npm run typecheck`
- [ ] Build successful: `npm run build`
- [ ] All tests passing: `npm test`

---

## Expected Output

### Updated Tool Descriptions

Both `remember_confirm` and `remember_deny` will have enhanced descriptions that:
- Clearly state the 5 critical safety requirements
- Use visual indicators (⚠️) to draw attention
- Explain the security implications
- Provide clear guidance on proper usage

### Design Document Enhancement

The publish-tools-confirmation-flow design document will have a new "Safety Guidelines for Agents" section that:
- Explains the correct confirmation workflow
- Shows examples of correct and incorrect flows
- Emphasizes the security model
- Provides clear dos and don'ts

---

## Common Issues and Solutions

### Issue 1: Tool descriptions too long

**Symptom**: MCP clients truncate or don't display full description
**Solution**: Keep critical requirements concise. Use numbered list format for scannability.

### Issue 2: Agents still chain confirmations

**Symptom**: Agents call confirm immediately after publish
**Solution**: This is an agent behavior issue, not a code issue. The enhanced descriptions help, but agent prompts may need adjustment. Consider adding system-level constraints in MCP client configuration.

### Issue 3: Description formatting issues

**Symptom**: Line breaks or formatting don't appear correctly in MCP clients
**Solution**: Use simple text formatting. Avoid complex markdown. Use numbered lists and clear sections.

---

## Resources

- [MCP Tool Schema](https://github.com/modelcontextprotocol/specification): Tool description best practices
- [Confirmation Flow Design](../../agent/design/publish-tools-confirmation-flow.md): Original design document
- [Security Best Practices](https://owasp.org/www-community/controls/): General security guidelines

---

## Notes

- **This is a documentation/UX improvement**, not a code behavior change
- **Agents can still bypass** these guidelines if they choose to - this is guidance, not enforcement
- **Consider system-level enforcement** in future (e.g., MCP server could reject chained confirms)
- **Tool descriptions are agent-facing**, not user-facing - they guide agent behavior
- **Keep descriptions concise** while being comprehensive about safety requirements
- **Visual indicators** (⚠️, ❌, ✅) help draw attention to critical information

---

**Next Task**: Task 62: Add System-Level Confirmation Chaining Prevention (Optional)
**Related Design Docs**: [publish-tools-confirmation-flow.md](../../agent/design/publish-tools-confirmation-flow.md)
**Estimated Completion Date**: TBD
