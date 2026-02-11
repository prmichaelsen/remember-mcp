# Default Template Library - Complete Specification

**Concept**: Curated default templates for remember-mcp  
**Created**: 2026-02-11  
**Updated**: 2026-02-11 (Merged person templates)  
**Status**: Design Specification (FINAL)

---

## Complete Template Library (15 Templates)

### Contacts (1 template)

#### 1. Person
```yaml
template_name: "Person"
description: "Track information about people you know - personal, professional, or both"
category: "contacts"
fields:
  - name: "name"
    type: "string"
    required: true
    description: "Person's full name"
    
  - name: "relationship"
    type: "array"
    required: false
    item_type: "string"
    options: ["friend", "family", "colleague", "client", "mentor", "acquaintance", "neighbor", "professional", "business_partner"]
    description: "Your relationship(s) - can have multiple (e.g., friend AND colleague)"
    
  - name: "how_we_met"
    type: "text"
    required: false
    description: "Story of how, where, and why you met - include fun anecdotes!"
    placeholder: "Met at Tech Conference 2026. Great conversation about AI..."
    
  - name: "met_at"
    type: "string"
    required: false
    description: "Location or event where you met"
    
  - name: "met_date"
    type: "datetime"
    required: false
    description: "When you first met"
    
  # Professional fields (optional)
  - name: "company"
    type: "string"
    required: false
    description: "Company or organization they work for"
    
  - name: "job_title"
    type: "string"
    required: false
    description: "Their job title or role"
    
  - name: "expertise"
    type: "array"
    required: false
    description: "Their areas of expertise (for professional relationships)"
    
  # Personal fields (optional)
  - name: "birthday"
    type: "datetime"
    required: false
    description: "Birthday (for personal relationships)"
    
  - name: "interests"
    type: "array"
    required: false
    description: "Their interests and hobbies"
    
  # Contact information
  - name: "contact_info"
    type: "object"
    required: false
    fields:
      - phone: string
      - email: string
      - linkedin: string
      - twitter: string
      - address: string
      - website: string
      
  # Interaction tracking
  - name: "last_interaction"
    type: "datetime"
    required: false
    description: "When you last spoke or met"
    
  - name: "follow_up"
    type: "datetime"
    required: false
    description: "When to follow up (for professional relationships)"
    
  - name: "notes"
    type: "text"
    required: false
    description: "Additional notes and observations"
    
trigger_keywords: ["met", "person", "know", "introduced", "friend", "colleague", "contact"]
```

**Why One Template**:
- ✅ Relationships often overlap (colleague becomes friend)
- ✅ Simpler for users (no confusion about which to use)
- ✅ Flexible (fill only relevant fields)
- ✅ All fields optional except name
- ✅ Works for any relationship type

**Example - Personal**:
```yaml
name: "Alex Johnson"
relationship: "friend"
how_we_met: "Met at hiking meetup. We're hiking buddies now!"
birthday: "1990-05-15"
interests: ["hiking", "rock climbing", "photography"]
contact_info:
  phone: "555-0123"
  email: "alex@example.com"
```

**Example - Professional**:
```yaml
name: "Sarah Chen"
relationship: "professional"
company: "Google"
job_title: "Senior Product Manager"
how_we_met: "Met at TechCrunch Disrupt 2026. Great talk on AI products."
expertise: ["product management", "AI", "user research"]
contact_info:
  email: "sarah.chen@google.com"
  linkedin: "linkedin.com/in/sarahchen"
follow_up: "2026-03-15"
```

**Example - Both**:
```yaml
name: "Jamie Lee"
relationship: "colleague"  # Started as colleague, became friend
company: "Acme Corp"
job_title: "Software Engineer"
birthday: "1988-03-20"  # Personal
expertise: ["React", "Node.js"]  # Professional
interests: ["coding", "gaming", "hiking"]  # Personal
# Has both personal AND professional fields!
```

---

### Work & Productivity (3 templates)

#### 2. Meeting Notes
```yaml
template_name: "Meeting Notes"
description: "Capture meeting information and action items"
category: "work"
fields:
  - meeting_title (required)
  - date (required)
  - attendees (array)
  - agenda_items (array)
  - discussion_points (text)
  - decisions_made (array)
  - action_items (array with task, assignee, due_date)
  - next_meeting (datetime)
trigger_keywords: ["meeting", "discussed", "team", "sync", "standup"]
```

#### 3. Project Tracker
```yaml
template_name: "Project Tracker"
description: "Track project information and progress"
category: "work"
fields:
  - project_name (required)
  - status (enum: planning, active, paused, completed)
  - start_date (datetime)
  - end_date (datetime)
  - stakeholders (array)
  - milestones (array)
  - current_phase (string)
  - blockers (array)
  - notes (text)
trigger_keywords: ["project", "working on", "building", "developing"]
```

#### 4. Task/Action Item
```yaml
template_name: "Task"
description: "Individual task or action item"
category: "work"
fields:
  - task_description (required)
  - due_date (datetime)
  - priority (enum: low, medium, high, urgent)
  - status (enum: todo, in_progress, blocked, done)
  - assignee (string)
  - project (string)
  - estimated_hours (number)
  - notes (text)
trigger_keywords: ["task", "todo", "need to", "action item"]
```

---

### Personal & Lifestyle (4 templates)

#### 5. Journal Entry
```yaml
template_name: "Journal Entry"
description: "Daily journal and reflections"
category: "personal"
fields:
  - date (required)
  - mood (enum: great, good, okay, bad, terrible)
  - highlights (array)
  - challenges (array)
  - gratitude (array)
  - reflections (text)
  - tomorrow_goals (array)
trigger_keywords: ["today", "feeling", "journal", "reflection"]
```

#### 6. Goal Tracker
```yaml
template_name: "Goal"
description: "Personal or professional goals"
category: "personal"
fields:
  - goal_name (required)
  - category (enum: health, career, financial, personal, learning)
  - target_date (datetime)
  - current_progress (float, 0-1)  # ✅ 0-1 for consistency with weight/trust
  - milestones (array)
  - obstacles (array)
  - notes (text)
trigger_keywords: ["goal", "want to", "achieve", "target"]
```

**Note**: Progress uses 0-1 float (not 0-100 int) for consistency with weight, trust, confidence, and other scoring fields throughout the system.

#### 7. Habit Tracker
```yaml
template_name: "Habit"
description: "Track daily habits and routines"
category: "personal"
fields:
  - habit_name (required)
  - frequency (enum: daily, weekly, monthly)
  - current_streak (number)
  - best_streak (number)
  - trigger (string)
  - reward (string)
  - notes (text)
trigger_keywords: ["habit", "routine", "daily", "every day"]
```

#### 8. Inventory Item
```yaml
template_name: "Inventory Item"
description: "Track items and their storage locations"
category: "organization"
fields:
  - item_name (required)
  - quantity (required)
  - storage_location (required)
  - category (enum: tools, camping, electronics, household, seasonal, sports, kitchen)
  - condition (enum: new, good, worn, needs_repair)
  - purchase_date (datetime)
  - value (number)
  - notes (text)
trigger_keywords: ["stored", "put", "kept", "where is", "inventory"]
```

---

### Entertainment & Reviews (3 templates)

#### 9. Restaurant Review
```yaml
template_name: "Restaurant Review"
description: "Track dining experiences"
category: "entertainment"
fields:
  - restaurant_name (required)
  - cuisine_type (string)
  - rating (number, 1-5)
  - favorite_dishes (array)
  - price_range (enum: $, $$, $$$, $$$$)
  - would_return (boolean)
  - notes (text)
trigger_keywords: ["restaurant", "ate at", "dinner", "lunch", "food"]
```

#### 10. Book Review
```yaml
template_name: "Book Review"
description: "Track books you've read"
category: "entertainment"
fields:
  - title (required)
  - author (required)
  - rating (number, 1-5)
  - genre (string)
  - date_finished (datetime)
  - summary (text)
  - favorite_quotes (array)
  - would_recommend (boolean)
trigger_keywords: ["book", "reading", "finished reading", "author"]
```

#### 11. Movie/Show Review
```yaml
template_name: "Movie Review"
description: "Track movies and shows you've watched"
category: "entertainment"
fields:
  - title (required)
  - type (enum: movie, tv_show, documentary)
  - rating (number, 1-5)
  - genre (string)
  - date_watched (datetime)
  - summary (text)
  - would_recommend (boolean)
trigger_keywords: ["movie", "watched", "show", "film", "series"]
```

---

### Creative & Learning (4 templates)

#### 12. Recipe
```yaml
template_name: "Recipe"
description: "Cooking recipes and instructions"
category: "creative"
fields:
  - recipe_name (required)
  - cuisine_type (string)
  - servings (number)
  - prep_time (number, minutes)
  - cook_time (number, minutes)
  - ingredients (array)
  - instructions (array)
  - difficulty (enum: easy, medium, hard)
  - notes (text)
trigger_keywords: ["recipe", "cooking", "ingredients", "make"]
```

#### 13. Idea Capture
```yaml
template_name: "Idea"
description: "Quick ideas and brainstorms"
category: "creative"
fields:
  - idea_title (required)
  - description (text)
  - category (string)
  - potential_impact (enum: low, medium, high)
  - next_steps (array)
  - related_ideas (array)
trigger_keywords: ["idea", "thought", "what if", "brainstorm"]
```

#### 14. Learning Note
```yaml
template_name: "Learning Note"
description: "Capture things you've learned"
category: "learning"
fields:
  - topic (required)
  - category (string)
  - key_concepts (array)
  - examples (array)
  - resources (array)
  - proficiency (enum: beginner, intermediate, advanced)
  - notes (text)
trigger_keywords: ["learned", "discovered", "found out", "TIL"]
```

#### 15. Travel Destination
```yaml
template_name: "Travel Destination"
description: "Places you've visited or want to visit"
category: "travel"
fields:
  - destination_name (required)
  - country (string)
  - visited (boolean)
  - visit_date (datetime)
  - rating (number, 1-5)
  - highlights (array)
  - recommendations (array)
  - would_return (boolean)
  - notes (text)
trigger_keywords: ["travel", "visited", "trip", "destination", "vacation"]
```

---

## Template Categories

```typescript
const TEMPLATE_CATEGORIES = {
  contacts: ['person'],  // Single unified person template
  work: ['meeting_notes', 'project_tracker', 'task'],
  personal: ['journal_entry', 'goal_tracker', 'habit_tracker'],
  organization: ['inventory_item'],
  entertainment: ['restaurant_review', 'book_review', 'movie_review'],
  creative: ['recipe', 'idea_capture'],
  learning: ['learning_note'],
  travel: ['travel_destination']
};
```

---

**Status**: Design Specification (FINAL)  
**Total Templates**: 15 (1 person, 3 work, 4 personal, 3 entertainment, 4 creative/learning)  
**Key Design**: Single flexible Person template for all relationship types
