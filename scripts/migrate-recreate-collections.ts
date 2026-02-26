#!/usr/bin/env tsx
/**
 * Recreate Collections Migration Script
 * 
 * Recreates Weaviate collections with updated schema configuration (indexNullState: true).
 * This is required after v3.0.1 to enable filtering on null values for the soft delete system.
 * 
 * CRITICAL: This script will DELETE and RECREATE collections. All data will be preserved
 * by exporting before deletion and re-importing after recreation.
 * 
 * Usage:
 *   # Using environment variables
 *   npx tsx scripts/migrate-recreate-collections.ts
 * 
 *   # Dry run (test without making changes)
 *   npx tsx scripts/migrate-recreate-collections.ts --dry-run
 * 
 *   # Specific collections only
 *   npx tsx scripts/migrate-recreate-collections.ts --collections "Memory_user123,Memory_public"
 */

import weaviate, { WeaviateClient } from 'weaviate-client';
import * as fs from 'fs';
import * as yaml from 'yaml';
import * as dotenv from 'dotenv';
import * as path from 'path';

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
    collections?: string[];
    stateFile: string;
  };
}

interface CollectionBackup {
  name: string;
  schema: any;
  documents: any[];
  totalCount: number;
}

interface MigrationState {
  migration: {
    id: string;
    started_at: string;
    updated_at: string;
    status: 'not_started' | 'in_progress' | 'completed' | 'failed';
  };
  collections: {
    name: string;
    status: 'not_started' | 'backed_up' | 'deleted' | 'recreated' | 'restored' | 'completed' | 'failed';
    total_documents: number;
    backed_up_documents: number;
    restored_documents: number;
    backup_file?: string;
  }[];
  progress: {
    total_collections: number;
    completed_collections: number;
    percentage: number;
  };
  errors: Array<{
    collection: string;
    step: string;
    error: string;
    timestamp: string;
  }>;
}

// ============================================================================
// State Manager
// ============================================================================

class MigrationStateManager {
  private stateFile: string;
  private state!: MigrationState;

  constructor(stateFile: string) {
    this.stateFile = stateFile;
  }

  async initialize(collections: string[]): Promise<void> {
    if (fs.existsSync(this.stateFile)) {
      await this.load();
      console.log(`✓ Resuming migration from ${this.stateFile}\n`);
    } else {
      this.state = this.createInitialState(collections);
      await this.save();
      console.log(`✓ Created migration state file: ${this.stateFile}\n`);
    }
  }

  private createInitialState(collections: string[]): MigrationState {
    const now = new Date().toISOString();
    return {
      migration: {
        id: `recreate-collections-${now.replace(/[:.]/g, '-').slice(0, 19)}`,
        started_at: now,
        updated_at: now,
        status: 'not_started',
      },
      collections: collections.map(name => ({
        name,
        status: 'not_started',
        total_documents: 0,
        backed_up_documents: 0,
        restored_documents: 0,
      })),
      progress: {
        total_collections: collections.length,
        completed_collections: 0,
        percentage: 0,
      },
      errors: [],
    };
  }

  async load(): Promise<void> {
    const content = fs.readFileSync(this.stateFile, 'utf8');
    this.state = yaml.parse(content);
  }

  async save(): Promise<void> {
    this.state.migration.updated_at = new Date().toISOString();
    const content = yaml.stringify(this.state);
    fs.writeFileSync(this.stateFile, content, 'utf8');
  }

  updateCollectionStatus(
    collectionName: string,
    status: MigrationState['collections'][0]['status'],
    updates?: Partial<MigrationState['collections'][0]>
  ): void {
    const collection = this.state.collections.find(c => c.name === collectionName);
    if (collection) {
      collection.status = status;
      if (updates) {
        Object.assign(collection, updates);
      }
    }
  }

  async completeCollection(collectionName: string): Promise<void> {
    this.updateCollectionStatus(collectionName, 'completed');
    this.state.progress.completed_collections++;
    this.state.progress.percentage = 
      (this.state.progress.completed_collections / this.state.progress.total_collections) * 100;
    await this.save();
  }

  async addError(collection: string, step: string, error: string): Promise<void> {
    this.state.errors.push({
      collection,
      step,
      error,
      timestamp: new Date().toISOString(),
    });
    await this.save();
  }

  async complete(): Promise<void> {
    this.state.migration.status = 'completed';
    await this.save();
  }

  async fail(error: string): Promise<void> {
    this.state.migration.status = 'failed';
    await this.addError('migration', 'global', error);
  }

  getState(): MigrationState {
    return this.state;
  }

  async cleanup(): Promise<void> {
    if (fs.existsSync(this.stateFile)) {
      fs.unlinkSync(this.stateFile);
      console.log(`✓ Cleaned up state file: ${this.stateFile}`);
    }
  }
}

// ============================================================================
// Migration Class
// ============================================================================

class CollectionRecreationMigration {
  private client!: WeaviateClient;
  private config: MigrationConfig;
  private stateManager: MigrationStateManager;
  private backupDir: string = './migration-backups';

  constructor(config: MigrationConfig) {
    this.config = config;
    this.stateManager = new MigrationStateManager(config.options.stateFile);
  }

  async connect(): Promise<void> {
    console.log('🔌 Connecting to Weaviate...');

    const clientConfig: any = {
      authCredentials: this.config.weaviate.apiKey
        ? new weaviate.ApiKey(this.config.weaviate.apiKey)
        : undefined,
    };

    if (this.config.weaviate.openaiApiKey) {
      clientConfig.headers = {
        'X-Openai-Api-Key': this.config.weaviate.openaiApiKey,
      };
    }

    this.client = await weaviate.connectToWeaviateCloud(
      this.config.weaviate.url,
      clientConfig
    );

    console.log('✓ Connected\n');
  }

  async disconnect(): Promise<void> {
    await this.client?.close();
  }

  async discoverCollections(): Promise<string[]> {
    console.log('🔍 Discovering collections...');
    
    const allCollections = await this.client.collections.listAll();
    let collectionNames = allCollections
      .map(c => c.name)
      .filter(name => name.startsWith('Memory_'));

    // Filter by specified collections if provided
    if (this.config.options.collections && this.config.options.collections.length > 0) {
      collectionNames = collectionNames.filter(name =>
        this.config.options.collections!.includes(name)
      );
    }

    console.log(`  Found ${collectionNames.length} collections: ${collectionNames.join(', ')}\n`);
    return collectionNames;
  }

  async backupCollection(collectionName: string): Promise<CollectionBackup> {
    console.log(`  📥 Backing up ${collectionName}...`);
    
    const collection = this.client.collections.get(collectionName);
    
    // Get schema
    const schema = await collection.config.get();
    
    // Get all documents
    const documents: any[] = [];
    let offset = 0;
    let hasMore = true;
    
    const aggregate = await collection.aggregate.overAll();
    const totalCount = aggregate.totalCount || 0;
    
    console.log(`    Total documents: ${totalCount}`);
    
    while (hasMore) {
      const result = await collection.query.fetchObjects({
        limit: this.config.options.batchSize,
        offset,
        includeVector: true,
      });
      
      if (result.objects.length === 0) {
        hasMore = false;
        break;
      }
      
      documents.push(...result.objects);
      offset += result.objects.length;
      
      const percentage = (documents.length / totalCount) * 100;
      process.stdout.write(`\r    Progress: ${percentage.toFixed(1)}% (${documents.length}/${totalCount})`);
    }
    
    console.log('\n    ✓ Backup complete');
    
    return {
      name: collectionName,
      schema,
      documents,
      totalCount,
    };
  }

  async saveBackup(backup: CollectionBackup): Promise<string> {
    // Create backup directory if it doesn't exist
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupFile = path.join(this.backupDir, `${backup.name}-${timestamp}.json`);
    
    fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2), 'utf8');
    console.log(`    ✓ Saved backup: ${backupFile}`);
    
    return backupFile;
  }

  async deleteCollection(collectionName: string): Promise<void> {
    console.log(`  🗑️  Deleting ${collectionName}...`);
    
    if (!this.config.options.dryRun) {
      await this.client.collections.delete(collectionName);
      console.log(`    ✓ Deleted`);
    } else {
      console.log(`    [DRY RUN] Would delete`);
    }
  }

  async recreateCollection(collectionName: string): Promise<void> {
    console.log(`  🔨 Recreating ${collectionName} with updated schema...`);
    
    if (!this.config.options.dryRun) {
      // Import schema creation functions
      const { createMemoryCollection } = await import('../dist/weaviate/schema.js');
      const { ensurePublicCollection } = await import('../dist/weaviate/space-schema.js');
      
      if (collectionName === 'Memory_public') {
        await ensurePublicCollection(this.client);
      } else {
        // Extract user ID from collection name (Memory_{user_id})
        const userId = collectionName.replace('Memory_', '');
        await createMemoryCollection(userId);
      }
      
      console.log(`    ✓ Recreated with indexNullState: true`);
    } else {
      console.log(`    [DRY RUN] Would recreate with indexNullState: true`);
    }
  }

  async restoreDocuments(collectionName: string, documents: any[]): Promise<void> {
    console.log(`  📤 Restoring ${documents.length} documents...`);
    
    if (!this.config.options.dryRun) {
      const collection = this.client.collections.get(collectionName);
      
      let restored = 0;
      for (let i = 0; i < documents.length; i += this.config.options.batchSize) {
        const batch = documents.slice(i, i + this.config.options.batchSize);
        
        const objects = batch.map(doc => ({
          properties: doc.properties,
          vector: doc.vector,
          uuid: doc.uuid, // Preserve original IDs
        }));
        
        await collection.data.insertMany(objects);
        restored += batch.length;
        
        const percentage = (restored / documents.length) * 100;
        process.stdout.write(`\r    Progress: ${percentage.toFixed(1)}% (${restored}/${documents.length})`);
      }
      
      console.log('\n    ✓ Restore complete');
    } else {
      console.log(`    [DRY RUN] Would restore ${documents.length} documents`);
    }
  }

  async migrateCollection(collectionName: string): Promise<boolean> {
    console.log(`\n📦 Migrating: ${collectionName}`);
    console.log('━'.repeat(60));
    
    try {
      // Step 1: Backup
      this.stateManager.updateCollectionStatus(collectionName, 'not_started');
      const backup = await this.backupCollection(collectionName);
      
      if (!this.config.options.dryRun) {
        const backupFile = await this.saveBackup(backup);
        this.stateManager.updateCollectionStatus(collectionName, 'backed_up', {
          total_documents: backup.totalCount,
          backed_up_documents: backup.documents.length,
          backup_file: backupFile,
        });
        await this.stateManager.save();
      }
      
      // Step 2: Delete
      await this.deleteCollection(collectionName);
      this.stateManager.updateCollectionStatus(collectionName, 'deleted');
      await this.stateManager.save();
      
      // Step 3: Recreate
      await this.recreateCollection(collectionName);
      this.stateManager.updateCollectionStatus(collectionName, 'recreated');
      await this.stateManager.save();
      
      // Step 4: Restore
      await this.restoreDocuments(collectionName, backup.documents);
      this.stateManager.updateCollectionStatus(collectionName, 'restored', {
        restored_documents: backup.documents.length,
      });
      await this.stateManager.save();
      
      // Step 5: Verify
      if (!this.config.options.dryRun) {
        const collection = this.client.collections.get(collectionName);
        const aggregate = await collection.aggregate.overAll();
        const restoredCount = aggregate.totalCount || 0;
        
        if (restoredCount !== backup.totalCount) {
          throw new Error(
            `Document count mismatch: backed up ${backup.totalCount}, restored ${restoredCount}`
          );
        }
        
        console.log(`  ✓ Verified: ${restoredCount} documents restored`);
      }
      
      await this.stateManager.completeCollection(collectionName);
      console.log(`  ✅ Migration complete\n`);
      
      return true;
    } catch (error: any) {
      console.error(`  ❌ Migration failed: ${error.message}\n`);
      await this.stateManager.addError(collectionName, 'migration', error.message);
      this.stateManager.updateCollectionStatus(collectionName, 'failed');
      await this.stateManager.save();
      return false;
    }
  }

  async migrateAll(): Promise<void> {
    console.log('🚀 Collection Recreation Migration');
    console.log('━'.repeat(60));
    console.log('\n📊 Configuration:');
    console.log(`  Weaviate URL: ${this.config.weaviate.url}`);
    console.log(`  Batch Size: ${this.config.options.batchSize}`);
    console.log(`  Dry Run: ${this.config.options.dryRun}`);
    console.log(`  Backup Directory: ${this.backupDir}\n`);
    
    if (this.config.options.dryRun) {
      console.log('⚠️  DRY RUN MODE - No changes will be made\n');
    }

    try {
      await this.connect();
      
      const collections = await this.discoverCollections();
      await this.stateManager.initialize(collections);
      
      let successCount = 0;
      let failCount = 0;
      
      for (const collectionName of collections) {
        const success = await this.migrateCollection(collectionName);
        if (success) {
          successCount++;
        } else {
          failCount++;
        }
      }
      
      // Summary
      console.log('━'.repeat(60));
      console.log('✅ Migration Summary:');
      console.log('━'.repeat(60));
      console.log(`  Total Collections: ${collections.length}`);
      console.log(`  Successful: ${successCount}`);
      console.log(`  Failed: ${failCount}`);
      console.log(`  Dry Run: ${this.config.options.dryRun}\n`);
      
      if (failCount === 0) {
        await this.stateManager.complete();
        
        if (!this.config.options.dryRun) {
          await this.stateManager.cleanup();
          console.log('✨ Migration completed successfully!\n');
        } else {
          console.log('✨ Dry run completed successfully!\n');
        }
      } else {
        console.log(`⚠️  Migration completed with ${failCount} failures`);
        console.log(`   Check ${this.config.options.stateFile} for details\n`);
      }
      
    } catch (error: any) {
      console.error(`\n❌ Migration failed: ${error.message}`);
      await this.stateManager.fail(error.message);
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
  // Parse CLI arguments
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
      batchSize: parseInt(cliArgs['batch-size'] || process.env.BATCH_SIZE || '100'),
      dryRun: cliArgs['dry-run'] === 'true',
      collections: cliArgs['collections']?.split(',').map(c => c.trim()),
      stateFile: cliArgs['state-file'] || '.collection-recreation-state.yaml',
    },
  };

  // Validate
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
    const migration = new CollectionRecreationMigration(config);
    
    await migration.migrateAll();
    
    process.exit(0);
  } catch (error: any) {
    console.error(`\n❌ Fatal error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { CollectionRecreationMigration, type MigrationConfig };
