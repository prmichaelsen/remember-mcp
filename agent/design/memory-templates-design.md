# Memory Templates - Design Proposal

**Concept**: Template memories that guide the creation and structure of future memories  
**Created**: 2026-02-11  
**Status**: Proposal

---

## Overview

A **template memory** is a special type of memory that defines the structure, fields, and guidelines for creating specific types of memories. This enables consistent, structured memory creation and can guide AI assistants in capturing information in standardized ways.

---

## Use Cases

### 1. **Structured Information Capture**
```yaml
Template: "Person Profile"
Purpose: Ensure consistent capture of information about people
Fields:
  - name: required
  - relationship: required
  - contact_info: optional
  - interests: array
  - last_interaction: datetime
  - notes: text
```

### 2. **Recurring Event Memories**
```yaml
Template: "Weekly Team Meeting"
Purpose: Standardize meeting notes
Fields:
  - date: required
  - attendees: array
  - agenda_items: array
  - decisions: array
  - action_items: array
  - next_meeting: datetime
```

### 3. **Learning & Knowledge**
```yaml
Template: "Technical Concept"
Purpose: Capture technical learning consistently
Fields:
  - concept_name: required
  - category: enum [language, framework, pattern, tool]
  - definition: text
  - examples: array
  - related_concepts: array
  - resources: array
  - proficiency: enum [beginner, intermediate, advanced]
```

### 4. **Personal Preferences**
```yaml
Template: "Restaurant Preference"
Purpose: Track dining preferences
Fields:
  - restaurant_name: required
  - cuisine_type: string
  - location: object
  - rating: float (0-5)
  - favorite_dishes: array
  - price_range: enum [$, $$, $$$, $$$$]
  - last_visited: datetime
  - would_return: boolean
```

### 5. **Project Tracking**
```yaml
Template: "Project Memory"
Purpose: Track project information
Fields:
  - project_name: required
  - status: enum [planning, active, paused, completed]
  - start_date: datetime
  - end_date: datetime
  - stakeholders: array
  - milestones: array
  - risks: array
  - notes: text
```

---

## Template Memory Schema

```yaml
TemplateMemory:
  # Core Identity
  id: uuid
  user_id: string
  type: "template"  # Special memory type
  
  # Template Definition
  template_name: string           # e.g., "Person Profile", "Meeting Notes"
  template_description: string    # What this template is for
  template_version: string        # Version for template evolution
  
  # Field Definitions
  fields:
    - name: string                # Field name
      type: enum                  # string, number, boolean, datetime, array, object
      required: boolean           # Is this field required?
      default_value: any          # Optional default value
      validation: object          # Validation rules
      description: string         # Field description
      options: array              # For enum types
      
  # Usage Metadata
  usage_count: int                # How many times used
  last_used: datetime
  created_at: datetime
  updated_at: datetime
  
  # Template Behavior
  auto_apply: boolean             # Auto-suggest when context matches
  trigger_keywords: array         # Keywords that suggest this template
  trigger_context: object         # Context patterns that trigger template
  
  # Relationships
  parent_template_id: uuid        # For template inheritance
  derived_memories: array         # Memories created from this template
  
  # Organization
  category: string
  tags: array
  weight: float                   # Template importance
  trust: float                    # Who can use this template
```

---

## Template Features

### 1. **Field Validation**
```yaml
fields:
  - name: "email"
    type: "string"
    required: true
    validation:
      pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
      error_message: "Invalid email format"
      
  - name: "age"
    type: "number"
    required: false
    validation:
      min: 0
      max: 150
      error_message: "Age must be between 0 and 150"
      
  - name: "priority"
    type: "string"
    required: true
    options: ["low", "medium", "high", "critical"]
    default_value: "medium"
```

### 2. **Template Inheritance**
```yaml
# Base Template
Template: "Contact"
fields:
  - name: required
  - email: optional
  - phone: optional

# Derived Template
Template: "Business Contact"
parent_template: "Contact"
additional_fields:
  - company: required
  - job_title: required
  - linkedin: optional
```

### 3. **Auto-Suggestion**
```yaml
Template: "Restaurant Review"
auto_apply: true
trigger_keywords: ["restaurant", "ate at", "dinner at", "lunch at"]
trigger_context:
  location_present: true
  time_of_day: ["lunch", "dinner"]
  
# When user says: "Had great sushi at Nobu yesterday"
# System suggests: "Would you like to create a Restaurant Review memory?"
```

### 4. **Computed Fields**
```yaml
fields:
  - name: "full_name"
    type: "computed"
    formula: "concat(first_name, ' ', last_name)"
    
  - name: "days_since_last_contact"
    type: "computed"
    formula: "date_diff(now(), last_contact_date)"
    
  - name: "completion_percentage"
    type: "computed"
    formula: "count(completed_items) / count(total_items) * 100"
```

### 5. **Conditional Fields**
```yaml
fields:
  - name: "has_children"
    type: "boolean"
    
  - name: "children_names"
    type: "array"
    required: false
    conditional:
      show_if: "has_children == true"
      
  - name: "children_ages"
    type: "array"
    required: false
    conditional:
      show_if: "has_children == true"
```

---

## Template Operations

### New Tool: `remember_create_template`
```typescript
remember_create_template({
  template_name: "Book Review",
  description: "Template for tracking books I've read",
  fields: [
    { name: "title", type: "string", required: true },
    { name: "author", type: "string", required: true },
    { name: "rating", type: "number", required: true, validation: { min: 1, max: 5 } },
    { name: "genre", type: "string", required: false },
    { name: "date_finished", type: "datetime", required: false },
    { name: "summary", type: "text", required: false },
    { name: "favorite_quotes", type: "array", required: false },
    { name: "would_recommend", type: "boolean", required: true }
  ],
  auto_apply: true,
  trigger_keywords: ["finished reading", "just read", "book review"]
})
```

### Enhanced: `remember_create_memory` (with template)
```typescript
remember_create_memory({
  template_id: "template_book_review_123",
  content: {
    title: "The Pragmatic Programmer",
    author: "Andrew Hunt and David Thomas",
    rating: 5,
    genre: "Technical",
    date_finished: "2026-02-10",
    summary: "Excellent guide to software craftsmanship...",
    favorite_quotes: [
      "Don't live with broken windows",
      "DRY - Don't Repeat Yourself"
    ],
    would_recommend: true
  }
})
```

### New Tool: `remember_list_templates`
```typescript
remember_list_templates({
  category: "personal",
  sort_by: "usage_count",
  limit: 10
})
```

### New Tool: `remember_update_template`
```typescript
remember_update_template({
  template_id: "template_book_review_123",
  add_fields: [
    { name: "isbn", type: "string", required: false }
  ],
  version: "1.1"
})
```

### New Tool: `remember_validate_memory`
```typescript
remember_validate_memory({
  template_id: "template_book_review_123",
  content: {
    title: "Some Book",
    // Missing required field: author
    rating: 6  // Invalid: exceeds max of 5
  }
})
// Returns: validation errors
```

### New Tool: `remember_delete_template`
```typescript
remember_delete_template({
  template_id: "template_book_review_123",
  delete_derived_memories: false  // Keep memories created from template
})
```

---

## Integration with Existing Memory System

### Memory Schema Extension
```yaml
Memory:
  # ... existing fields ...
  
  # Template Integration
  template_id: uuid              # Which template was used (if any)
  template_version: string       # Template version at creation time
  template_compliance: boolean   # Does memory still match template?
  template_validation_errors: array  # Any validation issues
  structured_content: object     # Template-structured data
```

### Template-Aware Search
```typescript
remember_search_memory({
  query: "technical books",
  filters: {
    template_id: "template_book_review_123",
    "structured_content.rating": { gte: 4 }
  }
})
```

### Template Analytics
```typescript
remember_template_analytics({
  template_id: "template_book_review_123",
  metrics: [
    "usage_count",
    "average_completion_rate",
    "most_common_values",
    "field_usage_statistics"
  ]
})
```

---

## Advanced Features

### 1. **Template Suggestions**
AI assistant analyzes conversation and suggests appropriate template:

```
User: "I just met Sarah at the conference. She's a product manager at Google."