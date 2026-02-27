#!/usr/bin/env tsx
/**
 * V1 → V2 Collection Migration Script
 *
 * Migrates Weaviate collections from v1 naming to v2 naming:
 *   Memory_{SanitizedUserId} → Memory_users_{literalUserId}
 *   Memory_public            → Memory_spaces_public
 *   Memory_{spaceId}         → Memory_spaces_public (merged)
 *
 * Safety: V1 collections are NEVER modified or deleted.
 *
 * Usage:
 *   npx tsx scripts/migrate-v1-to-v2.ts [options]
 *     --dry-run         Preview changes without writing
 *     --skip-backup     Skip backup step (if already backed up)
 *     --verify-only     Only run verification checks
 *     --batch-size N    Documents per batch (default: 100)
 */

import weaviate, { WeaviateClient } from 'weaviate-client';
import * as fs from 'fs';
import * as yaml from 'yaml';
import * as dotenv from 'dotenv';

// Load environment
dotenv.config();

// ============================================================================
// Types
// ============================================================================

interface MigrationConfig {
  weaviate: {
    url: string;
    apiKey?: string;
    openaiApiKey?: string;
  };
  options: {
    batchSize: number;
    dryRun: boolean;
    skipBackup: boolean;
    verifyOnly: boolean;
    stateFile: string;
  };
}

interface CollectionClassification {
  name: string;
  type: 'user' | 'public' | 'space' | 'backup' | 'unknown';
  v2Name?: string;
  userId?: string; // literal userId from documents
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
    status: 'not_started' | 'discovering' | 'backing_up' | 'creating' | 'copying' | 'verifying' | 'completed' | 'failed';
  };
  collections: CollectionClassification[];
  steps: MigrationStep[];
  copy_progress: {
    [collectionName: string]: {
      total: number;
      copied: number;
      status: 'pending' | 'in_progress' | 'completed' | 'failed';
    };
  };
  verification: {
    passed: boolean;
    checks: Array<{
      name: string;
      passed: boolean;
      details?: string;
    }>;
  };
  errors: Array<{
    step: string;
    error: string;
    timestamp: string;
  }>;
}

/**
 * V1 → V2 property name mapping for data transformation during copy.
 * Keys are v1 names, values are v2 names.
 */
const PROPERTY_RENAMES: Record<string, string> = {
  type: 'content_type',
  trust: 'trust_score',
  location_gps_lat: 'location_lat',
  location_gps_lng: 'location_lon',
  relationships: 'relationship_ids',
  memory_ids: 'related_memory_ids',
};

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
      console.log(`  Resuming migration from ${this.stateFile}\n`);
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
        id: `v1-to-v2-${now.replace(/[:.]/g, '-').slice(0, 19)}`,
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
    const content = fs.readFileSync(this.stateFile, 'utf8');
    this.state = yaml.parse(content);
  }

  async save(): Promise<void> {
    this.state.migration.updated_at = new Date().toISOString();
    fs.writeFileSync(this.stateFile, yaml.stringify(this.state), 'utf8');
  }

  getState(): MigrationState {
    return this.state;
  }

  setStatus(status: MigrationState['migration']['status']): void {
    this.state.migration.status = status;
  }

  setCollections(collections: CollectionClassification[]): void {
    this.state.collections = collections;
  }

  addStep(name: string, status: MigrationStep['status'] = 'pending'): void {
    const existing = this.state.steps.find(s => s.name === name);
    if (existing) {
      existing.status = status;
    } else {
      this.state.steps.push({ name, status });
    }
  }

  updateStep(name: string, status: MigrationStep['status'], error?: string): void {
    const step = this.state.steps.find(s => s.name === name);
    if (step) {
      step.status = status;
      if (error) step.error = error;
    }
  }

  updateCopyProgress(collection: string, total: number, copied: number, status: 'pending' | 'in_progress' | 'completed' | 'failed'): void {
    this.state.copy_progress[collection] = { total, copied, status };
  }

  addVerificationCheck(name: string, passed: boolean, details?: string): void {
    this.state.verification.checks.push({ name, passed, details });
  }

  setVerificationPassed(passed: boolean): void {
    this.state.verification.passed = passed;
  }

  addError(step: string, error: string): void {
    this.state.errors.push({ step, error, timestamp: new Date().toISOString() });
  }

  async cleanup(): Promise<void> {
    if (fs.existsSync(this.stateFile)) {
      fs.unlinkSync(this.stateFile);
    }
  }
}

// ============================================================================
// Migration Engine
// ============================================================================

class V1ToV2Migration {
  private client!: WeaviateClient;
  private config: MigrationConfig;
  private state: StateManager;

  constructor(config: MigrationConfig) {
    this.config = config;
    this.state = new StateManager(config.options.stateFile);
  }

  // --------------------------------------------------------------------------
  // Connection
  // --------------------------------------------------------------------------

  async connect(): Promise<void> {
    console.log('Connecting to Weaviate...');

    const clientConfig: any = {
      authCredentials: this.config.weaviate.apiKey
        ? new weaviate.ApiKey(this.config.weaviate.apiKey)
        : undefined,
    };
    if (this.config.weaviate.openaiApiKey) {
      clientConfig.headers = { 'X-Openai-Api-Key': this.config.weaviate.openaiApiKey };
    }

    this.client = await weaviate.connectToWeaviateCloud(
      this.config.weaviate.url,
      clientConfig,
    );

    console.log('  Connected\n');
  }

  async disconnect(): Promise<void> {
    await this.client?.close();
  }

  // --------------------------------------------------------------------------
  // Step 1: Discover
  // --------------------------------------------------------------------------

  async discover(): Promise<CollectionClassification[]> {
    console.log('Step 1: Discovering collections...');
    this.state.addStep('discover', 'in_progress');
    this.state.setStatus('discovering');
    await this.state.save();

    const allCollections = await this.client.collections.listAll();
    const memoryCollections = allCollections
      .map(c => c.name)
      .filter(name => name.startsWith('Memory_') && !name.startsWith('Backup_'));

    console.log(`  Found ${memoryCollections.length} Memory_ collections`);

    const classified: CollectionClassification[] = [];

    for (const name of memoryCollections) {
      // Skip v2 collections that already exist
      if (name.startsWith('Memory_users_') || name === 'Memory_spaces_public' || name.startsWith('Memory_groups_')) {
        console.log(`  [skip] ${name} (already v2 format)`);
        continue;
      }

      if (name === 'Memory_public') {
        classified.push({ name, type: 'public', v2Name: 'Memory_spaces_public' });
        console.log(`  [public] ${name} -> Memory_spaces_public`);
        continue;
      }

      // Try to determine if this is a user collection or a space collection
      // by reading a document and checking for user_id
      const classification = await this.classifyCollection(name);
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
    const collection = this.client.collections.get(name);

    try {
      // Fetch a sample document to inspect
      const result = await collection.query.fetchObjects({ limit: 1 });

      if (result.objects.length === 0) {
        return { name, type: 'unknown' };
      }

      const doc = result.objects[0];
      const props = doc.properties as Record<string, any>;

      // Space collections have 'spaces' or 'author_id' fields
      // User collections have 'user_id' without 'author_id'
      if (props.author_id || props.spaces) {
        // This is a space collection (per-space v1 collection)
        const suffix = name.replace('Memory_', '');
        return {
          name,
          type: 'space',
          v2Name: 'Memory_spaces_public', // All spaces merge into single collection
          spaceId: suffix,
        };
      }

      // User collection — extract literal userId from user_id property
      const literalUserId = props.user_id as string;
      if (literalUserId) {
        return {
          name,
          type: 'user',
          v2Name: `Memory_users_${literalUserId}`,
          userId: literalUserId,
        };
      }

      return { name, type: 'unknown' };
    } catch (error) {
      console.log(`    Warning: Could not classify ${name}: ${(error as Error).message}`);
      return { name, type: 'unknown' };
    }
  }

  // --------------------------------------------------------------------------
  // Step 2: Backup
  // --------------------------------------------------------------------------

  async backup(collections: CollectionClassification[]): Promise<void> {
    if (this.config.options.skipBackup) {
      console.log('Step 2: Backup (SKIPPED — --skip-backup)\n');
      this.state.addStep('backup', 'skipped');
      await this.state.save();
      return;
    }

    console.log('Step 2: Backing up v1 collections...');
    this.state.addStep('backup', 'in_progress');
    this.state.setStatus('backing_up');
    await this.state.save();

    for (const col of collections) {
      const backupName = `Backup_${col.name}`;

      const backupExists = await this.client.collections.exists(backupName);
      if (backupExists) {
        console.log(`  [exists] ${backupName}`);
        continue;
      }

      if (this.config.options.dryRun) {
        console.log(`  [dry-run] Would create ${backupName}`);
        continue;
      }

      await this.copyCollection(col.name, backupName, false);
      console.log(`  [backed up] ${col.name} -> ${backupName}`);
    }

    this.state.updateStep('backup', 'completed');
    await this.state.save();
    console.log('');
  }

  // --------------------------------------------------------------------------
  // Step 3: Create v2 collections
  // --------------------------------------------------------------------------

  async createV2Collections(collections: CollectionClassification[]): Promise<void> {
    console.log('Step 3: Creating v2 collections...');
    this.state.addStep('create_v2', 'in_progress');
    this.state.setStatus('creating');
    await this.state.save();

    // Determine unique v2 collection names
    const v2Names = new Set<string>();
    for (const col of collections) {
      if (col.v2Name) v2Names.add(col.v2Name);
    }

    for (const v2Name of v2Names) {
      const exists = await this.client.collections.exists(v2Name);
      if (exists) {
        console.log(`  [exists] ${v2Name}`);
        continue;
      }

      if (this.config.options.dryRun) {
        console.log(`  [dry-run] Would create ${v2Name}`);
        continue;
      }

      // Create with v2 schema
      await this.createV2Collection(v2Name, collections);
      console.log(`  [created] ${v2Name}`);
    }

    this.state.updateStep('create_v2', 'completed');
    await this.state.save();
    console.log('');
  }

  private async createV2Collection(v2Name: string, _collections: CollectionClassification[]): Promise<void> {
    // Import v2 schema functions
    const { createUserCollectionSchema, createSpaceCollectionSchema } =
      await import('../src/schema/v2-collections.js');

    if (v2Name === 'Memory_spaces_public') {
      const schema = createSpaceCollectionSchema();
      await this.client.collections.create(schema);
    } else if (v2Name.startsWith('Memory_users_')) {
      const userId = v2Name.replace('Memory_users_', '');
      const schema = createUserCollectionSchema(userId);
      await this.client.collections.create(schema);
    }
  }

  // --------------------------------------------------------------------------
  // Step 4: Copy user memories
  // --------------------------------------------------------------------------

  async copyUserMemories(collections: CollectionClassification[]): Promise<void> {
    const userCollections = collections.filter(c => c.type === 'user');
    if (userCollections.length === 0) {
      console.log('Step 4: Copy user memories (no user collections found)\n');
      return;
    }

    console.log(`Step 4: Copying ${userCollections.length} user collection(s)...`);
    this.state.addStep('copy_users', 'in_progress');
    this.state.setStatus('copying');
    await this.state.save();

    for (const col of userCollections) {
      if (!col.v2Name || !col.userId) {
        console.log(`  [skip] ${col.name} (no userId resolved)`);
        continue;
      }

      if (this.config.options.dryRun) {
        const srcCol = this.client.collections.get(col.name);
        const aggregate = await srcCol.aggregate.overAll();
        console.log(`  [dry-run] ${col.name} -> ${col.v2Name} (${aggregate.totalCount || 0} docs)`);
        continue;
      }

      await this.copyUserCollection(col);
    }

    this.state.updateStep('copy_users', 'completed');
    await this.state.save();
    console.log('');
  }

  private async copyUserCollection(col: CollectionClassification): Promise<void> {
    const srcCollection = this.client.collections.get(col.name);
    const dstCollection = this.client.collections.get(col.v2Name!);

    const aggregate = await srcCollection.aggregate.overAll();
    const totalCount = aggregate.totalCount || 0;
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
        const props = this.transformProperties(doc.properties as Record<string, any>);

        // Add v2 tracking arrays if not present
        if (!props.space_ids) props.space_ids = [];
        if (!props.group_ids) props.group_ids = [];

        return {
          properties: props,
          vectors: doc.vectors,
          uuid: doc.uuid,
        };
      });

      await dstCollection.data.insertMany(objects);

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
  // Step 5: Copy/merge published memories
  // --------------------------------------------------------------------------

  async copyPublishedMemories(collections: CollectionClassification[]): Promise<void> {
    const publicCollections = collections.filter(c => c.type === 'public' || c.type === 'space');
    if (publicCollections.length === 0) {
      console.log('Step 5: Copy published memories (no public/space collections found)\n');
      return;
    }

    console.log(`Step 5: Merging ${publicCollections.length} public/space collection(s) -> Memory_spaces_public...`);
    this.state.addStep('copy_published', 'in_progress');
    await this.state.save();

    for (const col of publicCollections) {
      if (this.config.options.dryRun) {
        const srcCol = this.client.collections.get(col.name);
        const aggregate = await srcCol.aggregate.overAll();
        console.log(`  [dry-run] ${col.name} -> Memory_spaces_public (${aggregate.totalCount || 0} docs)`);
        continue;
      }

      await this.copyPublicCollection(col);
    }

    this.state.updateStep('copy_published', 'completed');
    await this.state.save();
    console.log('');
  }

  private async copyPublicCollection(col: CollectionClassification): Promise<void> {
    const srcCollection = this.client.collections.get(col.name);
    const dstCollection = this.client.collections.get('Memory_spaces_public');

    const aggregate = await srcCollection.aggregate.overAll();
    const totalCount = aggregate.totalCount || 0;
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
        const props = this.transformProperties(doc.properties as Record<string, any>);
        const authorId = (props.author_id || props.user_id || '') as string;
        const originalId = doc.uuid;

        // Generate composite ID: {authorId}.{originalUUID}
        const compositeId = authorId ? `${authorId}.${originalId}` : originalId;

        // Set space_ids from existing spaces field or from collection's spaceId
        if (!props.space_ids || (props.space_ids as string[]).length === 0) {
          if (props.spaces && Array.isArray(props.spaces) && props.spaces.length > 0) {
            props.space_ids = props.spaces;
          } else if (col.spaceId) {
            props.space_ids = [col.spaceId];
          } else {
            props.space_ids = [];
          }
        }

        // Ensure group_ids
        if (!props.group_ids) props.group_ids = [];

        // Add revision fields
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
      } catch (insertError) {
        // Some may already exist (if re-running), insert individually
        for (const obj of objects) {
          try {
            await dstCollection.data.insert({
              properties: obj.properties,
              vectors: obj.vectors as any,
              id: obj.uuid,
            });
          } catch {
            // Already exists or other error — skip
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
  // Step 6: Backfill tracking arrays
  // --------------------------------------------------------------------------

  async backfillTrackingArrays(collections: CollectionClassification[]): Promise<void> {
    console.log('Step 6: Backfilling tracking arrays on source user memories...');
    this.state.addStep('backfill_tracking', 'in_progress');
    await this.state.save();

    const userCollections = collections.filter(c => c.type === 'user' && c.v2Name);

    if (this.config.options.dryRun) {
      console.log(`  [dry-run] Would backfill tracking arrays for ${userCollections.length} user collection(s)`);
      this.state.updateStep('backfill_tracking', 'completed');
      await this.state.save();
      console.log('');
      return;
    }

    // For each published memory in Memory_spaces_public, find the source memory
    // and update its space_ids
    const spacesCollectionExists = await this.client.collections.exists('Memory_spaces_public');
    if (!spacesCollectionExists) {
      console.log('  No Memory_spaces_public collection to backfill from');
      this.state.updateStep('backfill_tracking', 'completed');
      await this.state.save();
      console.log('');
      return;
    }

    const spacesCollection = this.client.collections.get('Memory_spaces_public');
    const aggregate = await spacesCollection.aggregate.overAll();
    const totalCount = aggregate.totalCount || 0;

    let offset = 0;
    let updated = 0;

    while (offset < totalCount) {
      const result = await spacesCollection.query.fetchObjects({
        limit: this.config.options.batchSize,
        offset,
      });

      if (result.objects.length === 0) break;

      for (const doc of result.objects) {
        const props = doc.properties as Record<string, any>;
        const compositeId = doc.uuid;

        // Parse composite ID: {userId}.{memoryId}
        const dotIndex = compositeId.indexOf('.');
        if (dotIndex === -1) continue;

        const userId = compositeId.substring(0, dotIndex);
        const memoryId = compositeId.substring(dotIndex + 1);
        const spaceIds = (props.space_ids as string[]) || [];

        if (spaceIds.length === 0) continue;

        // Find the user's v2 collection
        const userV2Name = `Memory_users_${userId}`;
        const userColExists = await this.client.collections.exists(userV2Name);
        if (!userColExists) continue;

        try {
          const userCollection = this.client.collections.get(userV2Name);
          await userCollection.data.update({
            id: memoryId,
            properties: {
              space_ids: spaceIds,
            },
          });
          updated++;
        } catch {
          // Memory might not exist in user collection — skip
        }
      }

      offset += result.objects.length;
    }

    console.log(`  Updated ${updated} source memories with tracking arrays`);
    this.state.updateStep('backfill_tracking', 'completed');
    await this.state.save();
    console.log('');
  }

  // --------------------------------------------------------------------------
  // Step 7: Verify
  // --------------------------------------------------------------------------

  async verify(collections: CollectionClassification[]): Promise<boolean> {
    console.log('Step 7: Verifying migration...');

    if (this.config.options.dryRun) {
      console.log('  [dry-run] Skipping verification — v2 collections were not created');
      this.state.addStep('verify', 'skipped');
      await this.state.save();
      return true;
    }

    this.state.addStep('verify', 'in_progress');
    this.state.setStatus('verifying');
    await this.state.save();

    let allPassed = true;

    // Check 1: Document count validation
    for (const col of collections) {
      if (!col.v2Name) continue;

      const srcCol = this.client.collections.get(col.name);
      const srcAggregate = await srcCol.aggregate.overAll();
      const srcCount = srcAggregate.totalCount || 0;

      if (col.type === 'user') {
        const dstCol = this.client.collections.get(col.v2Name);
        const dstAggregate = await dstCol.aggregate.overAll();
        const dstCount = dstAggregate.totalCount || 0;

        const passed = dstCount >= srcCount;
        this.state.addVerificationCheck(
          `count:${col.name}`,
          passed,
          `source=${srcCount}, dest=${dstCount}`,
        );

        if (!passed) {
          console.log(`  [FAIL] ${col.name}: source=${srcCount}, dest=${dstCount}`);
          allPassed = false;
        } else {
          console.log(`  [OK] ${col.name}: ${dstCount} docs (source: ${srcCount})`);
        }
      } else {
        // Public/space collections merged — check that Memory_spaces_public exists
        const dstExists = await this.client.collections.exists('Memory_spaces_public');
        const passed = dstExists;
        this.state.addVerificationCheck(
          `exists:Memory_spaces_public`,
          passed,
          `exists=${dstExists}`,
        );

        if (!passed) {
          console.log(`  [FAIL] Memory_spaces_public does not exist`);
          allPassed = false;
        } else {
          const dstCol = this.client.collections.get('Memory_spaces_public');
          const dstAggregate = await dstCol.aggregate.overAll();
          console.log(`  [OK] Memory_spaces_public: ${dstAggregate.totalCount || 0} docs`);
        }
      }
    }

    // Check 2: Composite ID format validation (sample)
    const spacesExists = await this.client.collections.exists('Memory_spaces_public');
    if (spacesExists) {
      const spacesCol = this.client.collections.get('Memory_spaces_public');
      const sample = await spacesCol.query.fetchObjects({ limit: 10 });

      let compositeValid = 0;
      let compositeInvalid = 0;

      for (const doc of sample.objects) {
        if (doc.uuid.includes('.')) {
          compositeValid++;
        } else {
          compositeInvalid++;
        }
      }

      const passed = compositeInvalid === 0 || sample.objects.length === 0;
      this.state.addVerificationCheck(
        'composite_ids',
        passed,
        `valid=${compositeValid}, invalid=${compositeInvalid} (sample of ${sample.objects.length})`,
      );

      if (!passed) {
        console.log(`  [WARN] Composite IDs: ${compositeInvalid} of ${sample.objects.length} lack dot format`);
      } else {
        console.log(`  [OK] Composite IDs: ${compositeValid} valid in sample`);
      }
    }

    // Check 3: Tracking array consistency (sample)
    for (const col of collections.filter(c => c.type === 'user' && c.v2Name)) {
      const userCol = this.client.collections.get(col.v2Name!);
      const sample = await userCol.query.fetchObjects({ limit: 5 });

      let hasTrackingArrays = 0;
      for (const doc of sample.objects) {
        const props = doc.properties as Record<string, any>;
        if (Array.isArray(props.space_ids) && Array.isArray(props.group_ids)) {
          hasTrackingArrays++;
        }
      }

      const passed = hasTrackingArrays === sample.objects.length || sample.objects.length === 0;
      this.state.addVerificationCheck(
        `tracking_arrays:${col.v2Name}`,
        passed,
        `${hasTrackingArrays}/${sample.objects.length} have tracking arrays`,
      );

      if (!passed) {
        console.log(`  [WARN] ${col.v2Name}: ${hasTrackingArrays}/${sample.objects.length} have tracking arrays`);
      } else {
        console.log(`  [OK] ${col.v2Name}: tracking arrays present`);
      }
    }

    this.state.setVerificationPassed(allPassed);
    this.state.updateStep('verify', allPassed ? 'completed' : 'failed');
    await this.state.save();
    console.log(`\n  Verification: ${allPassed ? 'PASSED' : 'FAILED'}\n`);

    return allPassed;
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  /**
   * Transform v1 property names to v2 property names.
   */
  private transformProperties(props: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(props)) {
      if (key === '_additional') continue; // Skip Weaviate internals

      const v2Key = PROPERTY_RENAMES[key] || key;
      // Only write renamed key if the v2 key doesn't already have a value
      if (v2Key !== key && result[v2Key] !== undefined) {
        // v2 key already set, skip v1 value
        continue;
      }
      result[v2Key] = value;
    }

    return result;
  }

  /**
   * Copy all documents from one collection to another (for backup).
   */
  private async copyCollection(srcName: string, dstName: string, transform: boolean): Promise<void> {
    const srcCollection = this.client.collections.get(srcName);

    // Get source schema and create destination with same schema
    const srcSchema = await srcCollection.config.get();
    await this.client.collections.create({
      name: dstName,
      vectorizers: weaviate.configure.vectorizer.text2VecOpenAI({
        model: 'text-embedding-3-small',
        sourceProperties: ['content', 'title', 'summary', 'observation'],
      }),
      invertedIndex: weaviate.configure.invertedIndex({
        indexNullState: true,
      }),
      properties: srcSchema.properties as any,
    });

    const dstCollection = this.client.collections.get(dstName);

    // Copy documents in batches
    const aggregate = await srcCollection.aggregate.overAll();
    const totalCount = aggregate.totalCount || 0;
    let offset = 0;

    while (offset < totalCount) {
      const result = await srcCollection.query.fetchObjects({
        limit: this.config.options.batchSize,
        offset,
        includeVector: true,
      });

      if (result.objects.length === 0) break;

      const objects = result.objects.map(doc => ({
        properties: transform
          ? this.transformProperties(doc.properties as Record<string, any>)
          : doc.properties,
        vectors: doc.vectors,
        uuid: doc.uuid,
      }));

      await dstCollection.data.insertMany(objects);
      offset += result.objects.length;
    }
  }

  // --------------------------------------------------------------------------
  // Main
  // --------------------------------------------------------------------------

  async run(): Promise<void> {
    console.log('='.repeat(60));
    console.log('  V1 -> V2 Weaviate Migration');
    console.log('='.repeat(60));
    console.log(`  Weaviate URL: ${this.config.weaviate.url}`);
    console.log(`  Batch Size:   ${this.config.options.batchSize}`);
    console.log(`  Dry Run:      ${this.config.options.dryRun}`);
    console.log(`  Skip Backup:  ${this.config.options.skipBackup}`);
    console.log(`  Verify Only:  ${this.config.options.verifyOnly}`);
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

      // Step 2: Backup
      await this.backup(collections);

      // Step 3: Create v2 collections
      await this.createV2Collections(collections);

      // Step 4: Copy user memories
      await this.copyUserMemories(collections);

      // Step 5: Copy/merge published memories
      await this.copyPublishedMemories(collections);

      // Step 6: Backfill tracking arrays
      await this.backfillTrackingArrays(collections);

      // Step 7: Verify
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
        console.log('  1. Apply code switch (Deliverable 3)');
        console.log('  2. Run full test suite');
        console.log('  3. Deploy');
        console.log('  4. Verify production functionality');
        console.log('  5. Delete v1 and backup collections');
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
    weaviate: {
      url: cliArgs['weaviate-url'] || process.env.WEAVIATE_REST_URL || '',
      apiKey: cliArgs['weaviate-key'] || process.env.WEAVIATE_API_KEY,
      openaiApiKey: cliArgs['openai-key'] || process.env.OPENAI_EMBEDDINGS_API_KEY,
    },
    options: {
      batchSize: parseInt(cliArgs['batch-size'] || '100'),
      dryRun: cliArgs['dry-run'] === 'true',
      skipBackup: cliArgs['skip-backup'] === 'true',
      verifyOnly: cliArgs['verify-only'] === 'true',
      stateFile: cliArgs['state-file'] || '.v1-to-v2-migration-state.yaml',
    },
  };

  if (!config.weaviate.url) {
    throw new Error('Weaviate URL is required (--weaviate-url or WEAVIATE_REST_URL)');
  }

  return config;
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  try {
    const config = loadConfig();
    const migration = new V1ToV2Migration(config);
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

export { V1ToV2Migration, type MigrationConfig };
