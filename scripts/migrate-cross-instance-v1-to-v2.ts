#!/usr/bin/env tsx
/**
 * Cross-Instance V1 -> V2 Collection Migration Script
 *
 * Migrates Weaviate collections from a SOURCE v1 cluster to a TARGET v2 cluster:
 *   Memory_{SanitizedUserId} -> Memory_users_{remappedUserId}  (on target)
 *   Memory_public            -> Memory_spaces_public            (on target)
 *
 * Also remaps Firebase user IDs (old project -> new project).
 *
 * Safety: Source cluster is READ-ONLY. Target cluster is a fresh instance.
 *
 * Usage:
 *   npx tsx scripts/migrate-cross-instance-v1-to-v2.ts --dry-run    # preview
 *   npx tsx scripts/migrate-cross-instance-v1-to-v2.ts              # execute
 *   npx tsx scripts/migrate-cross-instance-v1-to-v2.ts --verify-only # post-check
 *     --batch-size N    Documents per batch (default: 100)
 *
 * Env: .env.cross-migrate.local
 *   SOURCE_WEAVIATE_URL, SOURCE_WEAVIATE_API_KEY
 *   TARGET_WEAVIATE_URL, TARGET_WEAVIATE_API_KEY, TARGET_OPENAI_API_KEY
 */

import weaviate, { WeaviateClient } from 'weaviate-client';
import { v5 as uuidv5 } from 'uuid';
import * as fs from 'fs';
import * as yaml from 'yaml';
import * as dotenv from 'dotenv';
import * as path from 'path';

/** Deterministic UUID v5 from composite ID string (matches Weaviate's generateUuid5) */
function generateUuid5(input: string): string {
  return uuidv5(input, uuidv5.DNS);
}

// Load env from .env.cross-migrate.local
const envPath = path.join(process.cwd(), '.env.cross-migrate.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

// ============================================================================
// User ID Mapping
// ============================================================================

const USER_ID_MAP: Record<string, string> = {
  'MnOyIarhz5b8n06TsTovM582NSG2': 'geTmbcAMyhYUyeIfQj0ZRFmorhA2',
};

/** Remap a single user ID if it appears in the mapping table */
function remapUserId(uid: string | null | undefined): string | null | undefined {
  if (uid == null) return uid;
  return USER_ID_MAP[uid] ?? uid;
}

/** Remap an array of user IDs */
function remapUserIdArray(arr: string[] | null | undefined): string[] | null | undefined {
  if (!Array.isArray(arr)) return arr;
  return arr.map(id => USER_ID_MAP[id] ?? id);
}

/** Scalar user-ID fields to remap */
const SCALAR_UID_FIELDS = [
  'user_id',
  'author_id',
  'ghost_id',
  'deleted_by',
  'moderated_by',
  'owner_id',
  'last_revised_by',
];

/** Array user-ID fields to remap */
const ARRAY_UID_FIELDS = [
  'overwrite_allowed_ids',
];

/** Apply UID remapping to all user-ID fields on a property bag */
function remapUserIdFields(props: Record<string, any>): Record<string, any> {
  const result = { ...props };
  for (const field of SCALAR_UID_FIELDS) {
    if (result[field] != null) {
      result[field] = remapUserId(result[field]);
    }
  }
  for (const field of ARRAY_UID_FIELDS) {
    if (result[field] != null) {
      result[field] = remapUserIdArray(result[field]);
    }
  }
  return result;
}

// ============================================================================
// V1 -> V2 Property Renames
// ============================================================================

const PROPERTY_RENAMES: Record<string, string> = {
  type: 'content_type',
  trust: 'trust_score',
  location_gps_lat: 'location_lat',
  location_gps_lng: 'location_lon',
  relationships: 'relationship_ids',
  memory_ids: 'related_memory_ids',
};

function transformProperties(props: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(props)) {
    if (key === '_additional') continue;
    const v2Key = PROPERTY_RENAMES[key] || key;
    if (v2Key !== key && result[v2Key] !== undefined) continue;
    result[v2Key] = value;
  }
  return result;
}

// ============================================================================
// Types
// ============================================================================

interface MigrationConfig {
  source: { url: string; apiKey?: string };
  target: { url: string; apiKey?: string; openaiApiKey?: string };
  options: {
    batchSize: number;
    dryRun: boolean;
    verifyOnly: boolean;
    stateFile: string;
  };
}

interface CollectionClassification {
  name: string;
  type: 'user' | 'public' | 'space' | 'unknown';
  v2Name?: string;
  userId?: string;        // literal userId from source docs (before remap)
  remappedUserId?: string; // userId after remap
  spaceId?: string;
}

interface MigrationStep {
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped' | 'failed';
  error?: string;
}

interface MigrationState {
  migration: {
    id: string;
    started_at: string;
    updated_at: string;
    status: string;
  };
  collections: CollectionClassification[];
  steps: MigrationStep[];
  copy_progress: Record<string, { total: number; copied: number; status: string }>;
  verification: { passed: boolean; checks: Array<{ name: string; passed: boolean; details?: string }> };
  errors: Array<{ step: string; error: string; timestamp: string }>;
}

// ============================================================================
// State Manager
// ============================================================================

class StateManager {
  private stateFile: string;
  private state!: MigrationState;

  constructor(stateFile: string) {
    this.stateFile = stateFile;
  }

  async initialize(): Promise<void> {
    if (fs.existsSync(this.stateFile)) {
      this.load();
      console.log(`  Resuming from ${this.stateFile}\n`);
    } else {
      this.state = this.createInitialState();
      await this.save();
      console.log(`  Created state file: ${this.stateFile}\n`);
    }
  }

  private createInitialState(): MigrationState {
    const now = new Date().toISOString();
    return {
      migration: {
        id: `cross-instance-${now.replace(/[:.]/g, '-').slice(0, 19)}`,
        started_at: now,
        updated_at: now,
        status: 'not_started',
      },
      collections: [],
      steps: [],
      copy_progress: {},
      verification: { passed: false, checks: [] },
      errors: [],
    };
  }

  private load(): void {
    this.state = yaml.parse(fs.readFileSync(this.stateFile, 'utf8'));
  }

  async save(): Promise<void> {
    this.state.migration.updated_at = new Date().toISOString();
    fs.writeFileSync(this.stateFile, yaml.stringify(this.state), 'utf8');
  }

  getState(): MigrationState { return this.state; }
  setStatus(s: string): void { this.state.migration.status = s; }
  setCollections(c: CollectionClassification[]): void { this.state.collections = c; }

  addStep(name: string, status: MigrationStep['status'] = 'pending'): void {
    const existing = this.state.steps.find(s => s.name === name);
    if (existing) { existing.status = status; } else { this.state.steps.push({ name, status }); }
  }

  updateStep(name: string, status: MigrationStep['status'], error?: string): void {
    const step = this.state.steps.find(s => s.name === name);
    if (step) { step.status = status; if (error) step.error = error; }
  }

  updateCopyProgress(collection: string, total: number, copied: number, status: string): void {
    this.state.copy_progress[collection] = { total, copied, status };
  }

  addVerificationCheck(name: string, passed: boolean, details?: string): void {
    this.state.verification.checks.push({ name, passed, details });
  }

  setVerificationPassed(passed: boolean): void { this.state.verification.passed = passed; }

  addError(step: string, error: string): void {
    this.state.errors.push({ step, error, timestamp: new Date().toISOString() });
  }

  async cleanup(): Promise<void> {
    if (fs.existsSync(this.stateFile)) fs.unlinkSync(this.stateFile);
  }
}

// ============================================================================
// Migration Engine
// ============================================================================

class CrossInstanceMigration {
  private sourceClient!: WeaviateClient;
  private targetClient!: WeaviateClient;
  private config: MigrationConfig;
  private state: StateManager;

  constructor(config: MigrationConfig) {
    this.config = config;
    this.state = new StateManager(config.options.stateFile);
  }

  // --------------------------------------------------------------------------
  // Connection (dual-client)
  // --------------------------------------------------------------------------

  async connect(): Promise<void> {
    console.log('Connecting to Weaviate clusters...');

    this.sourceClient = await weaviate.connectToWeaviateCloud(this.config.source.url, {
      authCredentials: this.config.source.apiKey
        ? new weaviate.ApiKey(this.config.source.apiKey)
        : undefined,
    });
    console.log('  Source: connected');

    const targetHeaders: Record<string, string> = {};
    if (this.config.target.openaiApiKey) {
      targetHeaders['X-Openai-Api-Key'] = this.config.target.openaiApiKey;
    }

    this.targetClient = await weaviate.connectToWeaviateCloud(this.config.target.url, {
      authCredentials: this.config.target.apiKey
        ? new weaviate.ApiKey(this.config.target.apiKey)
        : undefined,
      headers: Object.keys(targetHeaders).length > 0 ? targetHeaders : undefined,
    });
    console.log('  Target: connected\n');
  }

  async disconnect(): Promise<void> {
    await this.sourceClient?.close();
    await this.targetClient?.close();
  }

  // --------------------------------------------------------------------------
  // Step 1: Discover (reads SOURCE only)
  // --------------------------------------------------------------------------

  async discover(): Promise<CollectionClassification[]> {
    console.log('Step 1: Discovering source collections...');
    this.state.addStep('discover', 'in_progress');
    this.state.setStatus('discovering');
    await this.state.save();

    const allCollections = await this.sourceClient.collections.listAll();
    const memoryCollections = allCollections
      .map(c => c.name)
      .filter(name => name.startsWith('Memory_') && !name.startsWith('Backup_'));

    console.log(`  Found ${memoryCollections.length} Memory_ collection(s) on source`);

    const classified: CollectionClassification[] = [];

    for (const name of memoryCollections) {
      // Skip collections that are already v2 naming
      if (name.startsWith('Memory_users_') || name === 'Memory_spaces_public' || name.startsWith('Memory_groups_')) {
        console.log(`  [skip] ${name} (already v2 format)`);
        continue;
      }

      if (name === 'Memory_public') {
        classified.push({ name, type: 'public', v2Name: 'Memory_spaces_public' });
        console.log(`  [public] ${name} -> Memory_spaces_public`);
        continue;
      }

      // Skip known test/default collections
      if (name === 'Memory_Default_user') {
        console.log(`  [skip] ${name} (test data)`);
        continue;
      }

      const classification = await this.classifyCollection(name);

      // Skip test/default collections
      if (classification.type === 'unknown') {
        console.log(`  [skip] ${name} (unknown type — likely test data)`);
        continue;
      }

      // Apply UID remapping to determine target collection name
      if (classification.type === 'user' && classification.userId) {
        const remapped = remapUserId(classification.userId) as string;
        classification.remappedUserId = remapped;
        classification.v2Name = `Memory_users_${remapped}`;
      }

      classified.push(classification);
      console.log(`  [${classification.type}] ${name} -> ${classification.v2Name || '(merged)'}`);
    }

    this.state.setCollections(classified);
    this.state.updateStep('discover', 'completed');
    await this.state.save();

    console.log(`\n  Classified: ${classified.filter(c => c.type === 'user').length} user, ` +
      `${classified.filter(c => c.type === 'public').length} public, ` +
      `${classified.filter(c => c.type === 'space').length} space\n`);

    return classified;
  }

  private async classifyCollection(name: string): Promise<CollectionClassification> {
    const collection = this.sourceClient.collections.get(name);
    try {
      const result = await collection.query.fetchObjects({ limit: 1 });
      if (result.objects.length === 0) return { name, type: 'unknown' };

      const props = result.objects[0].properties as Record<string, any>;

      if (props.author_id || props.spaces) {
        const suffix = name.replace('Memory_', '');
        return { name, type: 'space', v2Name: 'Memory_spaces_public', spaceId: suffix };
      }

      const literalUserId = props.user_id as string;
      if (literalUserId) {
        return { name, type: 'user', userId: literalUserId, v2Name: `Memory_users_${literalUserId}` };
      }

      return { name, type: 'unknown' };
    } catch (error) {
      console.log(`    Warning: Could not classify ${name}: ${(error as Error).message}`);
      return { name, type: 'unknown' };
    }
  }

  // --------------------------------------------------------------------------
  // Step 2: Create v2 collections (writes TARGET only)
  // --------------------------------------------------------------------------

  async createV2Collections(collections: CollectionClassification[]): Promise<void> {
    console.log('Step 2: Creating v2 collections on target...');
    this.state.addStep('create_v2', 'in_progress');
    this.state.setStatus('creating');
    await this.state.save();

    const v2Names = new Set<string>();
    for (const col of collections) {
      if (col.v2Name) v2Names.add(col.v2Name);
    }

    for (const v2Name of v2Names) {
      const exists = await this.targetClient.collections.exists(v2Name);
      if (exists) {
        console.log(`  [exists] ${v2Name}`);
        continue;
      }

      if (this.config.options.dryRun) {
        console.log(`  [dry-run] Would create ${v2Name}`);
        continue;
      }

      await this.createV2Collection(v2Name);
      console.log(`  [created] ${v2Name}`);
    }

    this.state.updateStep('create_v2', 'completed');
    await this.state.save();
    console.log('');
  }

  private async createV2Collection(v2Name: string): Promise<void> {
    const { createUserCollectionSchema, createSpaceCollectionSchema } =
      await import('../src/schema/v2-collections.js');

    if (v2Name === 'Memory_spaces_public') {
      await this.targetClient.collections.create(createSpaceCollectionSchema());
    } else if (v2Name.startsWith('Memory_users_')) {
      const userId = v2Name.replace('Memory_users_', '');
      await this.targetClient.collections.create(createUserCollectionSchema(userId));
    }
  }

  // --------------------------------------------------------------------------
  // Step 3: Copy user memories (source -> target with transform + remap)
  // --------------------------------------------------------------------------

  async copyUserMemories(collections: CollectionClassification[]): Promise<void> {
    const userCollections = collections.filter(c => c.type === 'user');
    if (userCollections.length === 0) {
      console.log('Step 3: Copy user memories (none found)\n');
      return;
    }

    console.log(`Step 3: Copying ${userCollections.length} user collection(s)...`);
    this.state.addStep('copy_users', 'in_progress');
    this.state.setStatus('copying');
    await this.state.save();

    for (const col of userCollections) {
      if (!col.v2Name) {
        console.log(`  [skip] ${col.name} (no v2Name resolved)`);
        continue;
      }

      const srcCol = this.sourceClient.collections.get(col.name);
      const aggregate = await srcCol.aggregate.overAll();
      const totalCount = aggregate.totalCount || 0;

      if (this.config.options.dryRun) {
        console.log(`  [dry-run] ${col.name} -> ${col.v2Name} (${totalCount} docs)`);
        continue;
      }

      await this.copyUserCollection(col, totalCount);
    }

    this.state.updateStep('copy_users', 'completed');
    await this.state.save();
    console.log('');
  }

  private async copyUserCollection(col: CollectionClassification, totalCount: number): Promise<void> {
    const srcCollection = this.sourceClient.collections.get(col.name);
    const dstCollection = this.targetClient.collections.get(col.v2Name!);

    console.log(`  Copying ${col.name} -> ${col.v2Name} (${totalCount} docs)`);

    this.state.updateCopyProgress(col.name, totalCount, 0, 'in_progress');
    await this.state.save();

    let offset = 0;
    let copied = 0;

    while (offset < totalCount) {
      const result = await srcCollection.query.fetchObjects({
        limit: this.config.options.batchSize,
        offset,
        includeVector: true,
      });

      if (result.objects.length === 0) break;

      const objects = result.objects.map(doc => {
        let props = transformProperties(doc.properties as Record<string, any>);
        props = remapUserIdFields(props);

        // v2 tracking arrays
        if (!props.space_ids) props.space_ids = [];
        if (!props.group_ids) props.group_ids = [];

        return {
          properties: props,
          vectors: doc.vectors,
          uuid: doc.uuid,
        };
      });

      try {
        await dstCollection.data.insertMany(objects);
      } catch {
        // Some may already exist if re-running — insert individually
        for (const obj of objects) {
          try {
            await dstCollection.data.insert({
              properties: obj.properties,
              vectors: obj.vectors as any,
              id: obj.uuid,
            });
          } catch {
            // skip duplicates
          }
        }
      }

      copied += result.objects.length;
      offset += result.objects.length;

      this.state.updateCopyProgress(col.name, totalCount, copied, 'in_progress');
      await this.state.save();

      const pct = ((copied / totalCount) * 100).toFixed(1);
      process.stdout.write(`\r    ${pct}% (${copied}/${totalCount})`);
    }

    this.state.updateCopyProgress(col.name, totalCount, copied, 'completed');
    await this.state.save();
    console.log(`\n    Done: ${copied} docs copied`);
  }

  // --------------------------------------------------------------------------
  // Step 4: Copy published memories (source -> target with composite IDs + remap)
  // --------------------------------------------------------------------------

  async copyPublishedMemories(collections: CollectionClassification[]): Promise<void> {
    const publicCollections = collections.filter(c => c.type === 'public' || c.type === 'space');
    if (publicCollections.length === 0) {
      console.log('Step 4: Copy published memories (none found)\n');
      return;
    }

    console.log(`Step 4: Merging ${publicCollections.length} public/space collection(s) -> Memory_spaces_public...`);
    this.state.addStep('copy_published', 'in_progress');
    await this.state.save();

    for (const col of publicCollections) {
      const srcCol = this.sourceClient.collections.get(col.name);
      const aggregate = await srcCol.aggregate.overAll();
      const totalCount = aggregate.totalCount || 0;

      if (this.config.options.dryRun) {
        console.log(`  [dry-run] ${col.name} -> Memory_spaces_public (${totalCount} docs)`);
        continue;
      }

      await this.copyPublicCollection(col, totalCount);
    }

    this.state.updateStep('copy_published', 'completed');
    await this.state.save();
    console.log('');
  }

  private async copyPublicCollection(col: CollectionClassification, totalCount: number): Promise<void> {
    const srcCollection = this.sourceClient.collections.get(col.name);
    const dstCollection = this.targetClient.collections.get('Memory_spaces_public');

    console.log(`  Copying ${col.name} -> Memory_spaces_public (${totalCount} docs)`);

    this.state.updateCopyProgress(col.name, totalCount, 0, 'in_progress');
    await this.state.save();

    let offset = 0;
    let copied = 0;

    while (offset < totalCount) {
      const result = await srcCollection.query.fetchObjects({
        limit: this.config.options.batchSize,
        offset,
        includeVector: true,
      });

      if (result.objects.length === 0) break;

      const objects = result.objects.map(doc => {
        let props = transformProperties(doc.properties as Record<string, any>);
        props = remapUserIdFields(props);

        // Build composite ID using REMAPPED author, then hash to UUID v5
        const authorId = (props.author_id || props.user_id || '') as string;
        const originalId = doc.uuid;
        const compositeIdStr = authorId ? `${authorId}.${originalId}` : originalId;
        const compositeId = authorId
          ? generateUuid5(compositeIdStr)
          : originalId;

        // space_ids
        if (!props.space_ids || (props.space_ids as string[]).length === 0) {
          if (props.spaces && Array.isArray(props.spaces) && props.spaces.length > 0) {
            props.space_ids = props.spaces;
          } else if (col.spaceId) {
            props.space_ids = [col.spaceId];
          } else {
            props.space_ids = [];
          }
        }
        if (!props.group_ids) props.group_ids = [];

        // Revision defaults
        if (props.revision_count === undefined) props.revision_count = 0;
        if (props.revised_at === undefined) props.revised_at = null;

        return {
          properties: props,
          vectors: doc.vectors,
          uuid: compositeId,
        };
      });

      try {
        await dstCollection.data.insertMany(objects);
      } catch {
        // Some may already exist if re-running — insert individually
        for (const obj of objects) {
          try {
            await dstCollection.data.insert({
              properties: obj.properties,
              vectors: obj.vectors as any,
              id: obj.uuid,
            });
          } catch {
            // skip duplicates
          }
        }
      }

      copied += result.objects.length;
      offset += result.objects.length;

      this.state.updateCopyProgress(col.name, totalCount, copied, 'in_progress');
      await this.state.save();

      const pct = ((copied / totalCount) * 100).toFixed(1);
      process.stdout.write(`\r    ${pct}% (${copied}/${totalCount})`);
    }

    this.state.updateCopyProgress(col.name, totalCount, copied, 'completed');
    await this.state.save();
    console.log(`\n    Done: ${copied} docs merged`);
  }

  // --------------------------------------------------------------------------
  // Step 5: Verify (reads both clusters)
  // --------------------------------------------------------------------------

  async verify(collections: CollectionClassification[]): Promise<boolean> {
    console.log('Step 5: Verifying migration...');

    if (this.config.options.dryRun) {
      console.log('  [dry-run] Skipping verification\n');
      this.state.addStep('verify', 'skipped');
      await this.state.save();
      return true;
    }

    this.state.addStep('verify', 'in_progress');
    this.state.setStatus('verifying');
    await this.state.save();

    let allPassed = true;

    // Check 1: Document count — user collections
    for (const col of collections.filter(c => c.type === 'user' && c.v2Name)) {
      const srcCol = this.sourceClient.collections.get(col.name);
      const srcAgg = await srcCol.aggregate.overAll();
      const srcCount = srcAgg.totalCount || 0;

      const dstCol = this.targetClient.collections.get(col.v2Name!);
      const dstAgg = await dstCol.aggregate.overAll();
      const dstCount = dstAgg.totalCount || 0;

      const passed = dstCount >= srcCount;
      this.state.addVerificationCheck(`count:${col.name}`, passed, `source=${srcCount}, target=${dstCount}`);

      if (!passed) {
        console.log(`  [FAIL] ${col.name}: source=${srcCount}, target=${dstCount}`);
        allPassed = false;
      } else {
        console.log(`  [OK] ${col.name}: ${dstCount} docs (source: ${srcCount})`);
      }
    }

    // Check 2: Document count — public/space
    const publicCols = collections.filter(c => c.type === 'public' || c.type === 'space');
    if (publicCols.length > 0) {
      const spacesExists = await this.targetClient.collections.exists('Memory_spaces_public');
      if (!spacesExists) {
        console.log('  [FAIL] Memory_spaces_public does not exist on target');
        this.state.addVerificationCheck('exists:Memory_spaces_public', false, 'missing');
        allPassed = false;
      } else {
        let srcTotal = 0;
        for (const col of publicCols) {
          const srcCol = this.sourceClient.collections.get(col.name);
          const agg = await srcCol.aggregate.overAll();
          srcTotal += agg.totalCount || 0;
        }
        const dstCol = this.targetClient.collections.get('Memory_spaces_public');
        const dstAgg = await dstCol.aggregate.overAll();
        const dstCount = dstAgg.totalCount || 0;

        const passed = dstCount >= srcTotal;
        this.state.addVerificationCheck('count:Memory_spaces_public', passed, `source_total=${srcTotal}, target=${dstCount}`);

        if (!passed) {
          console.log(`  [FAIL] Memory_spaces_public: source_total=${srcTotal}, target=${dstCount}`);
          allPassed = false;
        } else {
          console.log(`  [OK] Memory_spaces_public: ${dstCount} docs (source total: ${srcTotal})`);
        }
      }
    }

    // Check 3: UID remap spot-check on target user collection
    for (const col of collections.filter(c => c.type === 'user' && c.v2Name && c.remappedUserId)) {
      const dstCol = this.targetClient.collections.get(col.v2Name!);
      const sample = await dstCol.query.fetchObjects({ limit: 5 });

      let correctUid = 0;
      for (const doc of sample.objects) {
        const props = doc.properties as Record<string, any>;
        if (props.user_id === col.remappedUserId) correctUid++;
      }

      const passed = correctUid === sample.objects.length || sample.objects.length === 0;
      this.state.addVerificationCheck(
        `uid_remap:${col.v2Name}`,
        passed,
        `${correctUid}/${sample.objects.length} have remapped user_id=${col.remappedUserId}`,
      );

      if (!passed) {
        console.log(`  [WARN] ${col.v2Name}: ${correctUid}/${sample.objects.length} have remapped UID`);
      } else {
        console.log(`  [OK] ${col.v2Name}: user_id correctly remapped to ${col.remappedUserId}`);
      }
    }

    // Check 4: Composite ID round-trip on Memory_spaces_public
    // IDs should be deterministic UUID v5 hashes of "{authorId}.{memoryId}"
    const spacesExists = await this.targetClient.collections.exists('Memory_spaces_public');
    if (spacesExists) {
      const spacesCol = this.targetClient.collections.get('Memory_spaces_public');
      const sample = await spacesCol.query.fetchObjects({ limit: 10 });

      let validUuids = 0;
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      for (const doc of sample.objects) {
        if (uuidPattern.test(doc.uuid)) validUuids++;
      }

      const passed = validUuids === sample.objects.length || sample.objects.length === 0;
      this.state.addVerificationCheck(
        'composite_ids',
        passed,
        `${validUuids}/${sample.objects.length} are valid UUID v5 (sample)`,
      );

      if (!passed) {
        console.log(`  [WARN] Composite IDs: ${validUuids}/${sample.objects.length} are valid UUID v5`);
      } else {
        console.log(`  [OK] Composite IDs: ${validUuids} valid UUID v5 in sample`);
      }
    }

    // Check 5: Tracking arrays on target user collections
    for (const col of collections.filter(c => c.type === 'user' && c.v2Name)) {
      const dstCol = this.targetClient.collections.get(col.v2Name!);
      const sample = await dstCol.query.fetchObjects({ limit: 5 });

      let hasTracking = 0;
      for (const doc of sample.objects) {
        const p = doc.properties as Record<string, any>;
        if (Array.isArray(p.space_ids) && Array.isArray(p.group_ids)) hasTracking++;
      }

      const passed = hasTracking === sample.objects.length || sample.objects.length === 0;
      this.state.addVerificationCheck(
        `tracking_arrays:${col.v2Name}`,
        passed,
        `${hasTracking}/${sample.objects.length} have tracking arrays`,
      );

      if (!passed) {
        console.log(`  [WARN] ${col.v2Name}: ${hasTracking}/${sample.objects.length} have tracking arrays`);
      } else {
        console.log(`  [OK] ${col.v2Name}: tracking arrays present`);
      }
    }

    // Check 6: Vector spot-check
    for (const col of collections.filter(c => c.type === 'user' && c.v2Name)) {
      const dstCol = this.targetClient.collections.get(col.v2Name!);
      const sample = await dstCol.query.fetchObjects({ limit: 1, includeVector: true });

      if (sample.objects.length > 0) {
        const vectors = sample.objects[0].vectors;
        const hasVector = vectors && Object.keys(vectors).length > 0;
        this.state.addVerificationCheck(
          `vectors:${col.v2Name}`,
          !!hasVector,
          hasVector ? 'vectors present' : 'NO vectors found',
        );

        if (!hasVector) {
          console.log(`  [WARN] ${col.v2Name}: vectors missing on sample doc`);
        } else {
          console.log(`  [OK] ${col.v2Name}: vectors present`);
        }
      }
    }

    this.state.setVerificationPassed(allPassed);
    this.state.updateStep('verify', allPassed ? 'completed' : 'failed');
    await this.state.save();
    console.log(`\n  Verification: ${allPassed ? 'PASSED' : 'FAILED'}\n`);

    return allPassed;
  }

  // --------------------------------------------------------------------------
  // Main
  // --------------------------------------------------------------------------

  async run(): Promise<void> {
    console.log('='.repeat(60));
    console.log('  Cross-Instance V1 -> V2 Weaviate Migration');
    console.log('='.repeat(60));
    console.log(`  Source URL:   ${this.config.source.url}`);
    console.log(`  Target URL:   ${this.config.target.url}`);
    console.log(`  Batch Size:   ${this.config.options.batchSize}`);
    console.log(`  Dry Run:      ${this.config.options.dryRun}`);
    console.log(`  Verify Only:  ${this.config.options.verifyOnly}`);
    console.log(`  UID Mapping:  ${Object.entries(USER_ID_MAP).map(([k, v]) => `${k.slice(0, 8)}... -> ${v.slice(0, 8)}...`).join(', ')}`);
    console.log('='.repeat(60));
    console.log('');

    await this.state.initialize();

    try {
      await this.connect();

      // Step 1: Discover
      const collections = await this.discover();

      if (collections.length === 0) {
        console.log('No v1 collections found to migrate. Done.\n');
        return;
      }

      // Verify-only mode
      if (this.config.options.verifyOnly) {
        await this.verify(collections);
        return;
      }

      // Step 2: Create v2 collections on target
      await this.createV2Collections(collections);

      // Step 3: Copy user memories
      await this.copyUserMemories(collections);

      // Step 4: Copy published memories
      await this.copyPublishedMemories(collections);

      // Step 5: Verify
      const passed = await this.verify(collections);

      // Summary
      console.log('='.repeat(60));
      if (this.config.options.dryRun) {
        console.log('  DRY RUN COMPLETE — no changes were made');
      } else if (passed) {
        this.state.setStatus('completed');
        await this.state.save();
        await this.state.cleanup();
        console.log('  MIGRATION COMPLETE');
        console.log('');
        console.log('  Next steps:');
        console.log('  1. Manually spot-check target cluster');
        console.log('  2. Update application config to point to new cluster');
        console.log('  3. Deploy and verify production functionality');
      } else {
        this.state.setStatus('failed');
        await this.state.save();
        console.log('  MIGRATION COMPLETED WITH WARNINGS');
        console.log('  Review verification results above');
      }
      console.log('='.repeat(60));
      console.log('');

    } catch (error) {
      this.state.setStatus('failed');
      this.state.addError('global', (error as Error).message);
      await this.state.save();
      throw error;
    } finally {
      await this.disconnect();
    }
  }
}

// ============================================================================
// Configuration
// ============================================================================

function loadConfig(): MigrationConfig {
  const args = process.argv.slice(2);
  const cliArgs: Record<string, string> = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const value = args[i + 1];
      if (value && !value.startsWith('--')) {
        cliArgs[key] = value;
        i++;
      } else {
        cliArgs[key] = 'true';
      }
    }
  }

  const config: MigrationConfig = {
    source: {
      url: cliArgs['source-url'] || process.env.SOURCE_WEAVIATE_URL || '',
      apiKey: cliArgs['source-key'] || process.env.SOURCE_WEAVIATE_API_KEY,
    },
    target: {
      url: cliArgs['target-url'] || process.env.TARGET_WEAVIATE_URL || '',
      apiKey: cliArgs['target-key'] || process.env.TARGET_WEAVIATE_API_KEY,
      openaiApiKey: cliArgs['openai-key'] || process.env.TARGET_OPENAI_API_KEY,
    },
    options: {
      batchSize: parseInt(cliArgs['batch-size'] || '100'),
      dryRun: cliArgs['dry-run'] === 'true',
      verifyOnly: cliArgs['verify-only'] === 'true',
      stateFile: cliArgs['state-file'] || '.cross-instance-migration-state.yaml',
    },
  };

  if (!config.source.url) {
    throw new Error('Source URL required (--source-url or SOURCE_WEAVIATE_URL)');
  }
  if (!config.target.url) {
    throw new Error('Target URL required (--target-url or TARGET_WEAVIATE_URL)');
  }

  return config;
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  try {
    const config = loadConfig();
    const migration = new CrossInstanceMigration(config);
    await migration.run();
    process.exit(0);
  } catch (error: any) {
    console.error(`\nFatal error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { CrossInstanceMigration, type MigrationConfig };
