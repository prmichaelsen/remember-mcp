# Content Type Expansion Analysis

**Current File**: [`src/types/content-types.ts`](../src/types/content-types.ts)  
**Last Updated**: 2026-02-11

---

## Current Content Types (13 types)

### Existing Types
1. `code` - Source code files
2. `note` - Personal notes and documentation
3. `screenplay` - Screenplay and script content
4. `todo` - Task lists and todos
5. `documentation` - Technical documentation
6. `conversation` - Chat logs and conversations
7. `image` - Image files and visual content
8. `contact` - Contact information
9. `video` - Video files and recordings
10. `event` - Calendar events and activities
11. `audio` - Audio files and recordings
12. `transcript` - Transcriptions of audio or video content
13. `system` - Agent instructions (reserved for internal use only)

---

## Proposed Additional Content Types

### 🎯 High Priority Additions

#### 1. `checklist` ✅
**Use Cases**:
- Grocery shopping lists
- Camping preparation
- Luggage packing
- Travel checklists
- Project setup checklists
- Onboarding checklists
- Pre-flight checklists

**Difference from `todo`**:
- `todo`: Individual tasks with due dates, priorities, assignments
- `checklist`: Reusable templates, sequential steps, completion tracking

**Schema Extension**:
```typescript
ChecklistMetadata extends DocumentMetadata {
  items: Array<{
    text: string;
    checked: boolean;
    order: number;
    optional?: boolean;
  }>;
  template: boolean;  // Is this a reusable template?
  category: 'shopping' | 'travel' | 'preparation' | 'process' | 'other';
}
```

#### 2. `recipe`
**Use Cases**:
- Cooking recipes
- Cocktail recipes
- DIY project instructions
- Chemical formulas
- Manufacturing processes

**Why Separate from `documentation`**:
- Structured ingredients list
- Step-by-step instructions
- Timing and measurements
- Serving sizes and scaling

#### 3. `bookmark` / `link`
**Use Cases**:
- Web bookmarks
- Resource collections
- Reference links
- Reading lists

**Schema Extension**:
```typescript
BookmarkMetadata extends DocumentMetadata {
  url: string;
  domain: string;
  favicon?: string;
  preview?: string;
  archived: boolean;
  readLater: boolean;
}
```

#### 4. `journal` / `diary`
**Use Cases**:
- Daily journal entries
- Mood tracking
- Gratitude journals
- Dream logs
- Reflections

**Why Separate from `note`**:
- Temporal/chronological nature
- Personal reflection focus
- Privacy considerations
- Mood/emotion tracking

#### 5. `reference`
**Use Cases**:
- Quick reference guides
- Cheat sheets
- Command references
- API documentation snippets
- Keyboard shortcuts

**Why Separate from `documentation`**:
- Concise, lookup-focused
- Often tabular or list format
- Frequently accessed

### 🔄 Medium Priority Additions

#### 6. `template`
**Use Cases**:
- Email templates
- Document templates
- Code templates/snippets
- Message templates

#### 7. `form` / `survey`
**Use Cases**:
- Questionnaires
- Feedback forms
- Data collection forms
- Surveys

#### 8. `invoice` / `receipt`
**Use Cases**:
- Financial documents
- Purchase receipts
- Invoices
- Expense tracking

#### 9. `contract` / `agreement`
**Use Cases**:
- Legal documents
- Terms of service
- Agreements
- Policies

#### 10. `presentation` / `slide`
**Use Cases**:
- Presentation slides
- Pitch decks
- Slide notes

**Note**: Currently missing from the list but mentioned in original IMPLEMENTATION_PLAN.md

#### 11. `spreadsheet` / `table`
**Use Cases**:
- Data tables
- Spreadsheet data
- CSV content
- Structured data

**Note**: Also mentioned in original docs but missing from implementation

#### 12. `email`
**Use Cases**:
- Email messages
- Email threads
- Drafts

**Note**: Mentioned in original docs but missing from implementation

#### 13. `article` / `blog`
**Use Cases**:
- Blog posts
- Articles
- Long-form content
- Published writing

**Note**: Mentioned in original docs but missing from implementation

#### 14. `webpage`
**Use Cases**:
- Saved web pages
- Web content
- HTML documents

**Note**: Mentioned in original docs but missing from implementation

#### 15. `social`
**Use Cases**:
- Social media posts
- Tweets
- Status updates

**Note**: Mentioned in original docs but missing from implementation

### 🌟 Specialized Additions

#### 16. `pdf`
**Use Cases**:
- PDF documents
- Scanned documents
- Reports

**Note**: Mentioned in original docs but missing from implementation

#### 17. `meeting`
**Use Cases**:
- Meeting notes
- Action items
- Attendees
- Decisions

**Note**: Mentioned in original docs but missing from implementation

#### 18. `project`
**Use Cases**:
- Project overviews
- Project plans
- Milestones
- Deliverables

#### 19. `idea` / `brainstorm`
**Use Cases**:
- Random ideas
- Brainstorming sessions
- Concepts
- Inspiration

#### 20. `quote` / `excerpt`
**Use Cases**:
- Memorable quotes
- Book excerpts
- Highlights
- Citations

#### 21. `location` / `place`
**Use Cases**:
- Place recommendations
- Location notes
- Venue information
- Travel destinations

#### 22. `person` / `profile`
**Use Cases**:
- People notes
- Professional profiles
- Relationship context
- Contact details (more detailed than `contact`)

#### 23. `habit` / `routine`
**Use Cases**:
- Daily routines
- Habit tracking
- Recurring activities
- Schedules

#### 24. `goal` / `objective`
**Use Cases**:
- Personal goals
- Professional objectives
- Milestones
- KPIs

#### 25. `memory` / `reflection`
**Use Cases**:
- Personal memories
- Significant moments
- Life events
- Reflections

**Note**: Particularly relevant for remember-mcp project!

---

## Recommended Implementation Strategy

### Phase 1: Add Missing Core Types (Immediate)
Add types that were documented but not implemented:
```typescript
export type ContentType = 
  // Existing
  | 'code' | 'note' | 'screenplay' | 'todo' | 'documentation' 
  | 'conversation' | 'image' | 'contact' | 'video' | 'event' 
  | 'audio' | 'transcript' | 'system'
  // Add these (from original docs)
  | 'email' | 'article' | 'webpage' | 'social' | 'pdf' 
  | 'spreadsheet' | 'presentation' | 'meeting';
```

### Phase 2: Add High-Value Types
```typescript
export type ContentType = 
  // ... existing types ...
  // High priority additions
  | 'checklist' | 'recipe' | 'bookmark' | 'journal' | 'reference';
```

### Phase 3: Add Specialized Types (As Needed)
```typescript
export type ContentType = 
  // ... existing types ...
  // Specialized additions
  | 'template' | 'form' | 'invoice' | 'contract' | 'project'
  | 'idea' | 'quote' | 'location' | 'person' | 'habit' 
  | 'goal' | 'memory';
```

---

## Updated Content Types with Descriptions

```typescript
export const CONTENT_TYPES_DESCRIPTION = `Type of content:
  Core Types:
  - 'code': Source code files and programming content
  - 'note': Personal notes and quick documentation
  - 'documentation': Technical documentation and guides
  - 'reference': Quick reference guides and cheat sheets
  
  Task & Planning:
  - 'todo': Individual tasks with due dates and priorities
  - 'checklist': Reusable checklists and sequential steps
  - 'project': Project plans and overviews
  - 'goal': Goals, objectives, and milestones
  - 'habit': Routines and habit tracking
  
  Communication:
  - 'email': Email messages and threads
  - 'conversation': Chat logs and conversations
  - 'meeting': Meeting notes and action items
  - 'contact': Contact information
  - 'person': Detailed person profiles and relationship context
  
  Content & Media:
  - 'article': Articles and blog posts
  - 'webpage': Saved web pages and HTML content
  - 'social': Social media posts and updates
  - 'image': Image files and visual content
  - 'video': Video files and recordings
  - 'audio': Audio files and recordings
  - 'transcript': Transcriptions of audio or video
  - 'presentation': Presentation slides and decks
  - 'spreadsheet': Data tables and spreadsheet content
  - 'pdf': PDF documents and scanned files
  
  Creative:
  - 'screenplay': Screenplay and script content
  - 'recipe': Cooking recipes and instructions
  - 'idea': Brainstorming and concepts
  - 'quote': Memorable quotes and excerpts
  
  Personal:
  - 'journal': Daily journal entries and reflections
  - 'memory': Personal memories and significant moments
  - 'event': Calendar events and activities
  
  Organizational:
  - 'bookmark': Web bookmarks and resource collections
  - 'template': Reusable templates
  - 'form': Forms and surveys
  - 'location': Place information and recommendations
  
  Business:
  - 'invoice': Invoices and receipts
  - 'contract': Contracts and agreements
  
  System:
  - 'system': Agent instructions (reserved for internal use only)`;
```

---

## Checklist-Specific Implementation

### Enhanced Schema for Checklist Type

```typescript
// Add to content-types.ts
export interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
  order: number;
  optional?: boolean;
  notes?: string;
  dueDate?: string;
  assignee?: string;
}

export interface ChecklistMetadata extends DocumentMetadata {
  contentType: 'checklist';
  items: ChecklistItem[];
  isTemplate: boolean;
  category: 'shopping' | 'travel' | 'packing' | 'preparation' | 'process' | 'maintenance' | 'other';
  completionPercentage: number;
  totalItems: number;
  completedItems: number;
  lastUsed?: string;
  useCount?: number;
}

// Example checklist categories
export const CHECKLIST_CATEGORIES = {
  shopping: 'Shopping lists (groceries, supplies, etc.)',
  travel: 'Travel preparation and itineraries',
  packing: 'Packing lists for trips or moves',
  preparation: 'Event or activity preparation',
  process: 'Step-by-step processes and procedures',
  maintenance: 'Maintenance and inspection checklists',
  other: 'Other checklist types'
} as const;
```

### Example Checklist Documents

```typescript
// Grocery Shopping Checklist
{
  content: "Weekly grocery shopping",
  contentType: "checklist",
  title: "Weekly Groceries",
  metadata: {
    isTemplate: true,
    category: "shopping",
    items: [
      { id: "1", text: "Milk", checked: false, order: 1 },
      { id: "2", text: "Eggs", checked: false, order: 2 },
      { id: "3", text: "Bread", checked: false, order: 3 },
      { id: "4", text: "Vegetables", checked: false, order: 4 },
      { id: "5", text: "Fruits", checked: false, order: 5 }
    ],
    completionPercentage: 0,
    totalItems: 5,
    completedItems: 0
  }
}

// Camping Preparation Checklist
{
  content: "Camping trip preparation",
  contentType: "checklist",
  title: "Camping Prep - Summer 2026",
  metadata: {
    isTemplate: false,
    category: "preparation",
    items: [
      { id: "1", text: "Reserve campsite", checked: true, order: 1 },
      { id: "2", text: "Check tent condition", checked: true, order: 2 },
      { id: "3", text: "Buy firewood", checked: false, order: 3 },
      { id: "4", text: "Pack sleeping bags", checked: false, order: 4 },
      { id: "5", text: "Prepare food supplies", checked: false, order: 5 },
      { id: "6", text: "Check weather forecast", checked: false, order: 6, optional: true }
    ],
    completionPercentage: 33,
    totalItems: 6,
    completedItems: 2
  }
}
```

---

## Migration Path

### Step 1: Update Type Definition
```typescript
// src/types/content-types.ts
export type ContentType = 
  | 'code' | 'note' | 'screenplay' | 'todo' | 'documentation' 
  | 'conversation' | 'image' | 'contact' | 'video' | 'event' 
  | 'audio' | 'transcript' | 'system'
  // Phase 1: Missing core types
  | 'email' | 'article' | 'webpage' | 'social' | 'pdf' 
  | 'spreadsheet' | 'presentation' | 'meeting'
  // Phase 2: High-value additions
  | 'checklist' | 'recipe' | 'bookmark' | 'journal' | 'reference';
```

### Step 2: Update Constants Array
```typescript
export const CONTENT_TYPES = [
  // ... existing types ...
  'checklist', 'recipe', 'bookmark', 'journal', 'reference'
] as const;
```

### Step 3: Update Description
Add descriptions for new types to `CONTENT_TYPES_DESCRIPTION`

### Step 4: Add Type-Specific Interfaces
Create specialized interfaces for types that need them (like `ChecklistMetadata`)

### Step 5: Update Tools
Ensure all tools (search, index, etc.) work with new content types

---

## Benefits of Content Type Expansion

1. **Better Organization**: More specific types enable better categorization
2. **Improved Search**: Filter by specific content types for more relevant results
3. **Type-Specific Features**: Enable specialized functionality per type
4. **User Experience**: Users can think in terms of what they're storing
5. **Analytics**: Better insights into what users store and search for
6. **Future Extensibility**: Foundation for type-specific tools and features

---

## Recommendation

**Immediate Action**: Add `checklist` type along with other missing core types from the original documentation (email, article, webpage, social, pdf, spreadsheet, presentation, meeting).

This gives users 21 content types total, covering most common use cases while maintaining a clean, understandable taxonomy.

---

**Status**: Proposal for Review  
**Next Step**: Update [`src/types/content-types.ts`](../src/types/content-types.ts) with approved additions
