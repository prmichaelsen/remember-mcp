# Complete Remember-MCP Tool Set

**Project**: remember-mcp  
**Created**: 2026-02-11  
**Status**: Final Specification

---

## Complete Tool Set (18 Tools)

### Core Memory Operations (6 tools)

#### 1. `remember_create_memory`
Create a new memory with optional template

**Parameters**:
- `content`: Memory content (string or structured object)
- `template_id`: Optional template to use
- `type`: Content type (inventory, note, event, etc.)
- `weight`: Significance (0-1, default from preferences)
- `trust`: Access control (0-1, default from preferences)
- `tags`: Array of tags
- `references`: Array of source URLs
- `skip_template_suggestion`: Boolean to skip auto-suggestion

**Returns**: Memory ID or template suggestion

---

#### 2. `remember_update_memory`
Update an existing memory

**Parameters**:
- `memory_id`: ID of memory to update
- `updates`: Partial memory object with fields to update
- `reason`: Optional reason for update (for history)

**Returns**: Updated memory

---

#### 3. `remember_delete_memory`
Delete a memory

**Parameters**:
- `memory_id`: ID of memory to delete
- `delete_relationships`: Boolean - also delete connected relationships?

**Returns**: Confirmation

---

#### 4. `remember_search_memory`
Hybrid search for memories

**Parameters**:
- `query`: Search query string
- `alpha`: Balance between semantic (1.0) and keyword (0.0), default from preferences
- `filters`: Content type, tags, date range, weight threshold, trust level, location
- `include_relationships`: Boolean - include relationships in results
- `limit`: Max results (default from preferences)
- `offset`: Pagination offset

**Returns**: Array of memories (and optionally relationships)

---

#### 5. `remember_find_similar`
Find memories similar to a reference memory

**Parameters**:
- `reference_id`: Memory ID to find similar to
- `similarity_threshold`: Minimum similarity (0-1)
- `limit`: Max results
- `filters`: Optional filters

**Returns**: Array of similar memories with similarity scores

---

#### 6. `remember_query_memory`
RAG + GraphQL queries for complex questions

**Parameters**:
- `question`: Natural language question
- `max_sources`: Max memories to use for context
- `filters`: Optional filters
- `include_relationships`: Boolean - include relationship context

**Returns**: AI-generated answer with source citations

---

### Relationship Operations (4 tools)

#### 7. `remember_create_relationship`
Create a relationship between memories

**Parameters**:
- `memory_ids`: Array of 2...N memory IDs to connect
- `relationship_type`: Free-form string (e.g., "inspired_by", "contradicts")
- `observation`: Description of the connection
- `strength`: Relationship strength (0-1)
- `confidence`: Confidence in relationship (0-1)

**Returns**: Relationship ID

---

#### 8. `remember_update_relationship`
Update an existing relationship

**Parameters**:
- `relationship_id`: ID of relationship to update
- `updates`: Partial relationship object
- `reason`: Optional reason for update

**Returns**: Updated relationship

---

#### 9. `remember_search_relationship`
Search relationships by observation or type

**Parameters**:
- `query`: Search query (searches observation text)
- `memory_id`: Optional - filter to relationships involving this memory
- `relationship_type`: Optional - filter by type
- `limit`: Max results

**Returns**: Array of relationships

---

#### 10. `remember_delete_relationship`
Delete a relationship

**Parameters**:
- `relationship_id`: ID of relationship to delete
- `update_memories`: Boolean - remove relationship ID from connected memories?

**Returns**: Confirmation

---

### Preference Management (2 tools)

#### 11. `remember_update_preferences`
Update user preferences through conversation

**Parameters**:
- `preference_path`: Dot-notation path (e.g., "templates.auto_suggest")
- `value`: New value (boolean, number, string, or array)
- `reason`: Optional reason for change

**Returns**: Old value, new value, confirmation message

**Examples**:
- "Stop suggesting templates" → `{ preference_path: "templates.auto_suggest", value: false }`
- "Show 20 results" → `{ preference_path: "search.default_limit", value: 20 }`

---

#### 12. `remember_get_preferences`
Get current user preferences

**Parameters**:
- `category`: Optional filter (templates, search, privacy, etc.)

**Returns**: User preferences object or filtered by category

---

### Template Management (5 tools - Optional, Phase 3)

#### 13. `remember_create_template`
Create a custom template

**Parameters**:
- `template_name`: Name of template
- `description`: What template is for
- `fields`: Array of field definitions
- `trigger_keywords`: Keywords that suggest this template
- `auto_apply`: Boolean - auto-suggest this template

**Returns**: Template ID

---

#### 14. `remember_list_templates`
List available templates

**Parameters**:
- `include_default`: Boolean - include default templates
- `include_user`: Boolean - include user's custom templates
- `category`: Optional category filter
- `sort_by`: popularity, name, recent

**Returns**: Array of templates

---

#### 15. `remember_get_template`
Get template details

**Parameters**:
- `template_id`: Template ID

**Returns**: Full template definition

---

#### 16. `remember_update_template`
Update a user template

**Parameters**:
- `template_id`: Template ID (must be user's template)
- `updates`: Partial template object

**Returns**: Updated template

---

#### 17. `remember_delete_template`
Delete a user template

**Parameters**:
- `template_id`: Template ID (must be user's template)

**Returns**: Confirmation

---

### Permission Management (1 tool - Phase 2)

#### 18. `remember_grant_access`
Grant another user access to your memories

**Parameters**:
- `accessor_user_id`: User to grant access to
- `trust_level`: Trust level (0-1)
- `trust_summary`: Brief explanation
- `allowed_tags`: Optional - limit to specific tags
- `excluded_tags`: Optional - exclude specific tags
- `expires_at`: Optional expiration date

**Returns**: Permission confirmation

---

## Tool Organization by Phase

### Phase 1: MVP (12 tools)

**Memory Operations** (6):
1. remember_create_memory
2. remember_update_memory
3. remember_delete_memory
4. remember_search_memory
5. remember_find_similar
6. remember_query_memory

**Relationship Operations** (4):
7. remember_create_relationship
8. remember_update_relationship
9. remember_search_relationship
10. remember_delete_relationship

**Preferences** (2):
11. remember_update_preferences
12. remember_get_preferences

### Phase 2: Trust & Permissions (1 tool)

**Permission Management** (1):
13. remember_grant_access

### Phase 3: Templates (5 tools)

**Template Management** (5):
14. remember_create_template
15. remember_list_templates
16. remember_get_template
17. remember_update_template
18. remember_delete_template

---

## Additional Tools from Design Documents

### Suggested Additional Tools (Optional)

#### A. `remember_revoke_access`
Revoke access from a user

**Parameters**:
- `accessor_user_id`: User to revoke access from
- `reason`: Reason for revocation

---

#### B. `remember_list_accessors`
List who can access your memories

**Parameters**:
- `sort_by`: trust_level, last_accessed, granted_at

**Returns**: Array of users with access and their trust levels

---

#### C. `remember_reset_block`
Reset a memory block after trust violations

**Parameters**:
- `accessor_user_id`: User to unblock
- `memory_id`: Memory to unblock
- `reason`: Reason for reset

---

#### D. `remember_get_access_logs`
View access attempts to your memories

**Parameters**:
- `accessor_user_id`: Optional filter
- `memory_id`: Optional filter
- `blocked_only`: Boolean - only show blocked attempts

**Returns**: Array of access attempt logs

---

#### E. `remember_suggest_templates`
Explicitly request template suggestions

**Parameters**:
- `content`: Content to analyze
- `limit`: Max suggestions

**Returns**: Array of template suggestions

---

#### F. `remember_copy_template`
Copy a default template to customize

**Parameters**:
- `source_template_id`: Default template to copy
- `customizations`: Optional modifications

**Returns**: New user template ID

---

#### G. `remember_validate_memory`
Validate memory against template

**Parameters**:
- `template_id`: Template to validate against
- `content`: Memory content to validate

**Returns**: Validation result with errors

---

## Recommended Final Tool Set

### MVP (Phase 1): 12 Core Tools
- 6 memory operations
- 4 relationship operations
- 2 preference management

### Phase 2: +5 Permission Tools
- remember_grant_access
- remember_revoke_access
- remember_list_accessors
- remember_reset_block
- remember_get_access_logs

### Phase 3: +7 Template Tools
- remember_create_template
- remember_list_templates
- remember_get_template
- remember_update_template
- remember_delete_template
- remember_copy_template
- remember_validate_memory

**Total**: 24 tools (12 MVP + 5 permissions + 7 templates)

---

## Tool Count Summary

| Phase | Tools | Total |
|-------|-------|-------|
| Phase 1 (MVP) | 12 | 12 |
| Phase 2 (Permissions) | +5 | 17 |
| Phase 3 (Templates) | +7 | 24 |

---

**Status**: Final Specification  
**MVP Tools**: 12  
**Complete Tool Set**: 24  
**All tools support natural conversation interface**
