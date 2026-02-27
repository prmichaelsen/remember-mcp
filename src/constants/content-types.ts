/**
 * Content type constants and descriptions
 * Based on agent/design/content-types-expansion.md and default-template-library.md
 */

import type { ContentType } from '../types/memory.js';

/**
 * All available content types
 */
export const CONTENT_TYPES: readonly ContentType[] = [
  // Core types
  'code',
  'note',
  'documentation',
  'reference',
  // Task & Planning
  'todo',
  'checklist',
  'project',
  'goal',
  'habit',
  // Communication
  'email',
  'conversation',
  'meeting',
  'person', // Unified person template (replaces both 'contact' and 'person')
  // Content & Media
  'article',
  'webpage',
  'social',
  'image',
  'video',
  'audio',
  'transcript',
  'presentation',
  'spreadsheet',
  'pdf',
  // Creative
  'song',
  'screenplay',
  'recipe',
  'idea',
  'quote',
  'poetry',
  // Personal
  'journal',
  'memory',
  'event',
  // Organizational
  'bookmark',
  'form',
  'location',
  // Business
  'invoice',
  'contract',
  // System
  'system',
  'action',
  'audit',
  'history',
  // Cross-user & Threading
  'ghost',
  'comment',
] as const;

/**
 * Content type metadata
 */
export interface ContentTypeMetadata {
  name: ContentType;
  category: string;
  description: string;
  examples: string[];
  common_fields?: string[];
}

/**
 * Comprehensive content type descriptions
 */
export const CONTENT_TYPE_METADATA: Record<ContentType, ContentTypeMetadata> = {
  // Core Types
  code: {
    name: 'code',
    category: 'core',
    description: 'Source code files and programming content',
    examples: ['Code snippets', 'Functions', 'Scripts', 'Configuration files'],
    common_fields: ['language', 'framework', 'purpose'],
  },
  note: {
    name: 'note',
    category: 'core',
    description: 'Personal notes and quick documentation',
    examples: ['Quick notes', 'Reminders', 'Observations', 'Thoughts'],
  },
  documentation: {
    name: 'documentation',
    category: 'core',
    description: 'Technical documentation and guides',
    examples: ['API docs', 'User guides', 'Technical specs', 'How-to guides'],
  },
  reference: {
    name: 'reference',
    category: 'core',
    description: 'Quick reference guides and cheat sheets',
    examples: ['Command references', 'Keyboard shortcuts', 'API references', 'Cheat sheets'],
  },

  // Task & Planning
  todo: {
    name: 'todo',
    category: 'task',
    description: 'Individual tasks with due dates and priorities',
    examples: ['Task items', 'Action items', 'Assignments'],
    common_fields: ['due_date', 'priority', 'status', 'assignee'],
  },
  checklist: {
    name: 'checklist',
    category: 'task',
    description: 'Reusable checklists and sequential steps',
    examples: ['Grocery lists', 'Packing lists', 'Process checklists', 'Preparation lists'],
    common_fields: ['items', 'completion_percentage'],
  },
  project: {
    name: 'project',
    category: 'task',
    description: 'Project plans and overviews',
    examples: ['Project documentation', 'Project plans', 'Milestones'],
    common_fields: ['status', 'start_date', 'end_date', 'stakeholders'],
  },
  goal: {
    name: 'goal',
    category: 'task',
    description: 'Goals, objectives, and milestones',
    examples: ['Personal goals', 'Professional objectives', 'KPIs'],
    common_fields: ['target_date', 'progress', 'milestones'],
  },
  habit: {
    name: 'habit',
    category: 'task',
    description: 'Routines and habit tracking',
    examples: ['Daily habits', 'Routines', 'Recurring activities'],
    common_fields: ['frequency', 'streak', 'trigger'],
  },

  // Communication
  email: {
    name: 'email',
    category: 'communication',
    description: 'Email messages and threads',
    examples: ['Email messages', 'Email threads', 'Drafts'],
    common_fields: ['from', 'to', 'subject', 'date'],
  },
  conversation: {
    name: 'conversation',
    category: 'communication',
    description: 'Chat logs and conversations',
    examples: ['Chat messages', 'Conversation logs', 'Discussions'],
    common_fields: ['participants', 'platform'],
  },
  meeting: {
    name: 'meeting',
    category: 'communication',
    description: 'Meeting notes and action items',
    examples: ['Meeting notes', 'Standup notes', 'Conference calls'],
    common_fields: ['attendees', 'agenda', 'decisions', 'action_items'],
  },
  person: {
    name: 'person',
    category: 'communication',
    description: 'Track information about people - personal, professional, or both',
    examples: ['Friends', 'Family', 'Colleagues', 'Professional contacts', 'Business partners'],
    common_fields: ['name', 'relationship', 'company', 'job_title', 'how_we_met', 'contact_info', 'birthday', 'interests'],
  },

  // Content & Media
  article: {
    name: 'article',
    category: 'content',
    description: 'Articles and blog posts',
    examples: ['Blog posts', 'News articles', 'Long-form content'],
    common_fields: ['author', 'publication', 'url'],
  },
  webpage: {
    name: 'webpage',
    category: 'content',
    description: 'Saved web pages and HTML content',
    examples: ['Web pages', 'HTML documents', 'Web content'],
    common_fields: ['url', 'domain', 'archived_at'],
  },
  social: {
    name: 'social',
    category: 'content',
    description: 'Social media posts and updates',
    examples: ['Tweets', 'Posts', 'Status updates'],
    common_fields: ['platform', 'author', 'url'],
  },
  image: {
    name: 'image',
    category: 'media',
    description: 'Image files and visual content',
    examples: ['Photos', 'Screenshots', 'Diagrams', 'Illustrations'],
    common_fields: ['file_path', 'dimensions', 'format'],
  },
  video: {
    name: 'video',
    category: 'media',
    description: 'Video files and recordings',
    examples: ['Videos', 'Recordings', 'Tutorials'],
    common_fields: ['duration', 'format', 'url'],
  },
  audio: {
    name: 'audio',
    category: 'media',
    description: 'Audio files and recordings',
    examples: ['Voice notes', 'Podcasts', 'Music', 'Recordings'],
    common_fields: ['duration', 'format'],
  },
  transcript: {
    name: 'transcript',
    category: 'media',
    description: 'Transcriptions of audio or video',
    examples: ['Meeting transcripts', 'Podcast transcripts', 'Video captions'],
    common_fields: ['source_media', 'speakers'],
  },
  presentation: {
    name: 'presentation',
    category: 'content',
    description: 'Presentation slides and decks',
    examples: ['Slide decks', 'Pitch decks', 'Presentations'],
    common_fields: ['slide_count', 'format'],
  },
  spreadsheet: {
    name: 'spreadsheet',
    category: 'content',
    description: 'Data tables and spreadsheet content',
    examples: ['Spreadsheets', 'Data tables', 'CSV content'],
    common_fields: ['rows', 'columns', 'format'],
  },
  pdf: {
    name: 'pdf',
    category: 'content',
    description: 'PDF documents and scanned files',
    examples: ['PDF documents', 'Scanned documents', 'Reports'],
    common_fields: ['pages', 'file_size'],
  },

  // Creative
  song: {
    name: 'song',
    category: 'creative',
    description: 'Music tracks and songs',
    examples: ['Songs', 'Music tracks', 'Albums', 'Playlists'],
    common_fields: ['artist', 'album', 'genre', 'duration', 'release_date', 'url'],
  },
  screenplay: {
    name: 'screenplay',
    category: 'creative',
    description: 'Screenplay and script content',
    examples: ['Screenplays', 'Scripts', 'Dialogue'],
    common_fields: ['characters', 'scenes'],
  },
  recipe: {
    name: 'recipe',
    category: 'creative',
    description: 'Cooking recipes and instructions',
    examples: ['Recipes', 'Cooking instructions', 'Meal plans'],
    common_fields: ['ingredients', 'instructions', 'servings', 'prep_time', 'cook_time'],
  },
  idea: {
    name: 'idea',
    category: 'creative',
    description: 'Brainstorming and concepts',
    examples: ['Ideas', 'Brainstorms', 'Concepts', 'Inspiration'],
    common_fields: ['category', 'potential_impact'],
  },
  quote: {
    name: 'quote',
    category: 'creative',
    description: 'Memorable quotes and excerpts',
    examples: ['Quotes', 'Excerpts', 'Highlights', 'Citations'],
    common_fields: ['author', 'source'],
  },
  poetry: {
    name: 'poetry',
    category: 'creative',
    description: 'Poems and poetic content',
    examples: ['Poems', 'Verses', 'Haiku', 'Sonnets', 'Free verse'],
    common_fields: ['author', 'form', 'theme'],
  },

  // Personal
  journal: {
    name: 'journal',
    category: 'personal',
    description: 'Daily journal entries and reflections',
    examples: ['Journal entries', 'Diary entries', 'Reflections'],
    common_fields: ['date', 'mood', 'highlights'],
  },
  memory: {
    name: 'memory',
    category: 'personal',
    description: 'Personal memories and significant moments',
    examples: ['Life events', 'Significant moments', 'Memories'],
    common_fields: ['date', 'people_involved', 'location'],
  },
  event: {
    name: 'event',
    category: 'personal',
    description: 'Calendar events and activities',
    examples: ['Events', 'Activities', 'Appointments'],
    common_fields: ['date', 'time', 'location', 'attendees'],
  },

  // Organizational
  bookmark: {
    name: 'bookmark',
    category: 'organizational',
    description: 'Web bookmarks and resource collections',
    examples: ['Bookmarks', 'Resource links', 'Reading lists'],
    common_fields: ['url', 'domain', 'read_later'],
  },
  form: {
    name: 'form',
    category: 'organizational',
    description: 'Forms and surveys',
    examples: ['Questionnaires', 'Feedback forms', 'Surveys'],
    common_fields: ['fields', 'responses'],
  },
  location: {
    name: 'location',
    category: 'organizational',
    description: 'Place information and recommendations',
    examples: ['Places', 'Venues', 'Destinations', 'Locations'],
    common_fields: ['address', 'gps', 'rating'],
  },

  // Business
  invoice: {
    name: 'invoice',
    category: 'business',
    description: 'Invoices and receipts',
    examples: ['Invoices', 'Receipts', 'Bills'],
    common_fields: ['amount', 'date', 'vendor', 'items'],
  },
  contract: {
    name: 'contract',
    category: 'business',
    description: 'Contracts and agreements',
    examples: ['Contracts', 'Agreements', 'Terms of service'],
    common_fields: ['parties', 'effective_date', 'terms'],
  },

  // System
  system: {
    name: 'system',
    category: 'system',
    description: 'Agent instructions (reserved for internal use only)',
    examples: ['System prompts', 'Agent instructions', 'Configuration'],
  },
  action: {
    name: 'action',
    category: 'system',
    description: 'Agent actions and operations',
    examples: ['Actions taken', 'Operations performed', 'Commands executed'],
    common_fields: ['action_type', 'status', 'result'],
  },
  audit: {
    name: 'audit',
    category: 'system',
    description: 'Audit logs and compliance records',
    examples: ['Audit logs', 'Access logs', 'Security events'],
    common_fields: ['event_type', 'actor', 'target', 'result'],
  },
  history: {
    name: 'history',
    category: 'system',
    description: 'Change history and version tracking',
    examples: ['Edit history', 'Version history', 'Change logs'],
    common_fields: ['target_id', 'change_type', 'previous_value', 'new_value'],
  },

  // Cross-user & Threading
  ghost: {
    name: 'ghost',
    category: 'cross_user',
    description: 'Ghost conversation memory — stores context from AI-mediated cross-user interactions',
    examples: ['Ghost conversation context', 'Cross-user interaction history'],
    common_fields: ['ghost_owner_id', 'conversing_user_id'],
  },
  comment: {
    name: 'comment',
    category: 'cross_user',
    description: 'Threaded comments on shared memories in spaces and groups',
    examples: ['Comments on shared memories', 'Discussion replies', 'Feedback'],
    common_fields: ['parent_id', 'thread_root_id'],
  },
};

/**
 * Content type categories
 */
export const CONTENT_TYPE_CATEGORIES = {
  core: ['code', 'note', 'documentation', 'reference'],
  task: ['todo', 'checklist', 'project', 'goal', 'habit'],
  communication: ['email', 'conversation', 'meeting', 'person'],
  content: ['article', 'webpage', 'social', 'presentation', 'spreadsheet', 'pdf'],
  media: ['image', 'video', 'audio', 'transcript'],
  creative: ['song', 'screenplay', 'recipe', 'idea', 'quote', 'poetry'],
  personal: ['journal', 'memory', 'event'],
  organizational: ['bookmark', 'form', 'location'],
  business: ['invoice', 'contract'],
  system: ['system', 'action', 'audit', 'history'],
  cross_user: ['ghost', 'comment'],
} as const;

/**
 * Get content type metadata
 */
export function getContentTypeMetadata(type: ContentType): ContentTypeMetadata {
  return CONTENT_TYPE_METADATA[type];
}

/**
 * Get content types by category
 */
export function getContentTypesByCategory(category: keyof typeof CONTENT_TYPE_CATEGORIES): ContentType[] {
  return CONTENT_TYPE_CATEGORIES[category] as unknown as ContentType[];
}

/**
 * Validate content type
 */
export function isValidContentType(type: string): type is ContentType {
  return CONTENT_TYPES.includes(type as ContentType);
}

/**
 * Get content type description for LLM prompts
 * Generated dynamically from CONTENT_TYPE_METADATA
 */
export function getContentTypeDescription(): string {
  const categoryNames: Record<string, string> = {
    core: 'Core Types',
    task: 'Task & Planning',
    communication: 'Communication',
    content: 'Content & Media',
    media: 'Content & Media',
    creative: 'Creative',
    personal: 'Personal',
    organizational: 'Organizational',
    business: 'Business',
    system: 'System (Internal Use)',
  };

  const lines: string[] = ['Type of content:', ''];

  // Group by category
  const categorized = new Map<string, ContentType[]>();
  
  for (const type of CONTENT_TYPES) {
    const metadata = CONTENT_TYPE_METADATA[type];
    const categoryKey = metadata.category;
    
    if (!categorized.has(categoryKey)) {
      categorized.set(categoryKey, []);
    }
    categorized.get(categoryKey)!.push(type);
  }

  // Build description by category
  for (const [categoryKey, types] of categorized) {
    const categoryName = categoryNames[categoryKey] || categoryKey;
    lines.push(`${categoryName}:`);
    
    for (const type of types) {
      const metadata = CONTENT_TYPE_METADATA[type];
      lines.push(`  - '${type}': ${metadata.description}`);
    }
    
    lines.push('');
  }

  return lines.join('\n').trim();
}

/**
 * Default content type
 */
export const DEFAULT_CONTENT_TYPE: ContentType = 'note';
