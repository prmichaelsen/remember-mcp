#!/usr/bin/env tsx
/**
 * Backup Collections to Weaviate
 * 
 * Creates backup copies of collections directly in Weaviate with "Backup_" prefix.
 * This provides higher confidence that backups are safely stored before any destructive operations.
 * 
 * Usage:
 *   # Backup all Memory_ collections
 *   npx tsx scripts/backup-collections.ts
 * 
 *   # Backup specific collections
 *   npx tsx scripts/backup-collections.ts --collections "Memory_user123,Memory_public"
 * 
 *   # Dry run
 *   npx tsx scripts/backup-collections.ts --dry-run
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

interface BackupConfig {
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

interface BackupState {
  backup: {
    id: string;
    started_at: string;
    updated_at: string;
    status: 'not_started' | 'in_progress' | 'completed' | 'failed';
  };
  collections: {
    name: string;
    backup_name: string;
    status: 'not_started' | 'schema_created' | 'copying' | 'completed' | 'failed';
    total_documents: number;
    copied_documents: number;
  }[];
  progress: {
    total_collections: number;
    completed_collections: number;
    percentage: number;
  };
  errors: Array<{
    collection: string;
    error: string;
    timestamp: string;
  }>;
}

// ============================================================================
// State Manager
// ============================================================================

class BackupStateManager {
  private stateFile: string;
  private state!: BackupState;

  constructor(stateFile: string) {
    this.stateFile = stateFile;
  }

  async initialize(collections: string[]): Promise<void> {
    if (fs.existsSync(this.stateFile)) {
      await this.load();
      console.log(`✓ Resuming backup from ${this.stateFile}\n`);
    } else {
      this.state = this.createInitialState(collections);
      await this.save();
      console.log(`✓ Created backup state file: ${this.stateFile}\n`);
    }
  }

  private createInitialState(collections: string[]): BackupState {
    const now = new Date().toISOString();
    return {
      backup: {
        id: `backup-${now.replace(/[:.]/g, '-').slice(0, 19)}`,
        started_at: now,
        updated_at: now,
        status: 'not_started',
      },
      collections: collections.map(name => ({
        name,
        backup_name: `Backup_${name}`,
        status: 'not_started',
        total_documents: 0,
        copied_documents: 0,
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
    this.state.backup.updated_at = new Date().toISOString();
    const content = yaml.stringify(this.state);
    fs.writeFileSync(this.stateFile, content, 'utf8');
  }

  updateCollectionStatus(
    collectionName: string,
    status: BackupState['collections'][0]['status'],
    updates?: Partial<BackupState['collections'][0]>
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

  async addError(collection: string, error: string): Promise<void> {
    this.state.errors.push({
      collection,
      error,
      timestamp: new Date().toISOString(),
    });
    await this.save();
  }

  async complete(): Promise<void> {
    this.state.backup.status = 'completed';
    await this.save();
  }

  async fail(error: string): Promise<void> {
    this.state.backup.status = 'failed';
    await this.addError('global', error);
  }

  getState(): BackupState {
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
// Backup Class
// ============================================================================

class WeaviateBackup {
  private client!: WeaviateClient;
  private config: BackupConfig;
  private stateManager: BackupStateManager;

  constructor(config: BackupConfig) {
    this.config = config;
    this.stateManager = new BackupStateManager(config.options.stateFile);
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
      .filter(name => name.startsWith('Memory_') && !name.startsWith('Backup_'));

    // Filter by specified collections if provided
    if (this.config.options.collections && this.config.options.collections.length > 0) {
      collectionNames = collectionNames.filter(name =>
        this.config.options.collections!.includes(name)
      );
    }

    console.log(`  Found ${collectionNames.length} collections: ${collectionNames.join(', ')}\n`);
    return collectionNames;
  }

  async backupCollection(collectionName: string): Promise<boolean> {
    console.log(`\n📦 Backing up: ${collectionName}`);
    console.log('━'.repeat(60));
    
    const backupName = `Backup_${collectionName}`;
    
    try {
      // Check if backup already exists
      const backupExists = await this.client.collections.exists(backupName);
      if (backupExists) {
        console.log(`  ⚠️  Backup collection ${backupName} already exists`);
        console.log(`  ℹ️  Delete it first if you want to recreate the backup`);
        await this.stateManager.completeCollection(collectionName);
        return true;
      }
      
      // Get source collection
      const sourceCollection = this.client.collections.get(collectionName);
      
      console.log(`  ✓ Analyzing collection`);
      
      // Get total count
      const aggregate = await sourceCollection.aggregate.overAll();
      const totalCount = aggregate.totalCount || 0;
      console.log(`  ✓ Found ${totalCount} documents`);
      
      this.stateManager.updateCollectionStatus(collectionName, 'not_started', {
        total_documents: totalCount,
      });
      await this.stateManager.save();
      
      // Create backup collection with same schema
      if (!this.config.options.dryRun) {
        console.log(`  🔨 Creating backup collection: ${backupName}`);
        
        // Import schema creation functions from src (tsx will compile on the fly)
        const { createMemoryCollection } = await import('../src/weaviate/schema.js');
        const { PUBLIC_COLLECTION_NAME } = await import('../src/weaviate/space-schema.js');

        // Create backup by temporarily creating with backup name
        // We'll use the same schema creation logic
        if (collectionName === PUBLIC_COLLECTION_NAME || collectionName === 'Memory_public') {
          // For public collection, create manually with backup name
          const sourceCollectionRef = this.client.collections.get(collectionName);
          const publicSchema = await sourceCollectionRef.config.get();
          
          await this.client.collections.create({
            name: backupName,
            vectorizers: weaviate.configure.vectorizer.text2VecOpenAI({
              model: 'text-embedding-3-small',
              sourceProperties: ['content', 'title', 'summary', 'observation'],
            }),
            properties: publicSchema.properties as any,
          });
        } else {
          // For user collections, create with backup name
          // Extract user ID and create using our schema function
          const userId = collectionName.replace('Memory_', '');
          
          // Temporarily override the collection name by creating directly
          const userCollection = this.client.collections.get(collectionName);
          const userSchema = await userCollection.config.get();
          
          await this.client.collections.create({
            name: backupName,
            vectorizers: weaviate.configure.vectorizer.text2VecOpenAI({
              model: 'text-embedding-3-small',
              sourceProperties: ['content', 'title', 'summary', 'observation'],
            }),
            properties: userSchema.properties as any,
          });
        }
        
        console.log(`  ✓ Backup collection created`);
        this.stateManager.updateCollectionStatus(collectionName, 'schema_created');
        await this.stateManager.save();
      } else {
        console.log(`  [DRY RUN] Would create backup collection: ${backupName}`);
      }
      
      // Copy documents in batches
      console.log(`  📋 Copying documents...`);
      this.stateManager.updateCollectionStatus(collectionName, 'copying');
      await this.stateManager.save();
      
      let offset = 0;
      let copiedCount = 0;
      
      while (offset < totalCount) {
        const result = await sourceCollection.query.fetchObjects({
          limit: this.config.options.batchSize,
          offset,
          includeVector: true,
        });
        
        if (result.objects.length === 0) {
          break;
        }
        
        if (!this.config.options.dryRun) {
          const backupCollection = this.client.collections.get(backupName);
          
          const objects = result.objects.map(doc => ({
            properties: doc.properties,
            vectors: doc.vectors, // v3 API uses 'vectors' not 'vector'
            uuid: doc.uuid, // Preserve original IDs
          }));
          
          await backupCollection.data.insertMany(objects);
        }
        
        copiedCount += result.objects.length;
        offset += result.objects.length;
        
        const percentage = (copiedCount / totalCount) * 100;
        const progressBar = this.createProgressBar(percentage);
        process.stdout.write(`\r    ${progressBar} ${percentage.toFixed(1)}% (${copiedCount}/${totalCount})`);
        
        this.stateManager.updateCollectionStatus(collectionName, 'copying', {
          copied_documents: copiedCount,
        });
        await this.stateManager.save();
      }
      
      console.log('\n  ✓ Copy complete');
      
      // Verify
      if (!this.config.options.dryRun) {
        const backupCollection = this.client.collections.get(backupName);
        const backupAggregate = await backupCollection.aggregate.overAll();
        const backupCount = backupAggregate.totalCount || 0;
        
        if (backupCount !== totalCount) {
          throw new Error(
            `Document count mismatch: source ${totalCount}, backup ${backupCount}`
          );
        }
        
        console.log(`  ✓ Verified: ${backupCount} documents in backup`);
      }
      
      await this.stateManager.completeCollection(collectionName);
      console.log(`  ✅ Backup complete: ${backupName}\n`);
      
      return true;
    } catch (error: any) {
      console.error(`  ❌ Backup failed: ${error.message}\n`);
      await this.stateManager.addError(collectionName, error.message);
      this.stateManager.updateCollectionStatus(collectionName, 'failed');
      await this.stateManager.save();
      return false;
    }
  }

  private createProgressBar(percentage: number, width: number = 20): string {
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
  }

  async backupAll(): Promise<void> {
    console.log('🚀 Weaviate Collection Backup');
    console.log('━'.repeat(60));
    console.log('\n📊 Configuration:');
    console.log(`  Weaviate URL: ${this.config.weaviate.url}`);
    console.log(`  Batch Size: ${this.config.options.batchSize}`);
    console.log(`  Dry Run: ${this.config.options.dryRun}\n`);
    
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
        const success = await this.backupCollection(collectionName);
        if (success) {
          successCount++;
        } else {
          failCount++;
        }
      }
      
      // Summary
      console.log('━'.repeat(60));
      console.log('✅ Backup Summary:');
      console.log('━'.repeat(60));
      console.log(`  Total Collections: ${collections.length}`);
      console.log(`  Successful: ${successCount}`);
      console.log(`  Failed: ${failCount}`);
      console.log(`  Dry Run: ${this.config.options.dryRun}\n`);
      
      if (failCount === 0) {
        await this.stateManager.complete();
        
        if (!this.config.options.dryRun) {
          await this.stateManager.cleanup();
          console.log('✨ Backup completed successfully!\n');
          console.log('📋 Backup collections created:');
          collections.forEach(name => {
            console.log(`  - Backup_${name}`);
          });
          console.log('\n⚠️  Remember to delete backup collections after migration succeeds:\n');
          collections.forEach(name => {
            console.log(`  npx tsx scripts/delete-collection.ts --collection "Backup_${name}"`);
          });
          console.log('');
        } else {
          console.log('✨ Dry run completed successfully!\n');
        }
      } else {
        console.log(`⚠️  Backup completed with ${failCount} failures`);
        console.log(`   Check ${this.config.options.stateFile} for details\n`);
      }
      
    } catch (error: any) {
      console.error(`\n❌ Backup failed: ${error.message}`);
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

function loadConfig(): BackupConfig {
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

  const config: BackupConfig = {
    weaviate: {
      url: cliArgs['weaviate-url'] || process.env.WEAVIATE_REST_URL || '',
      apiKey: cliArgs['weaviate-key'] || process.env.WEAVIATE_API_KEY,
      openaiApiKey: cliArgs['openai-key'] || process.env.OPENAI_EMBEDDINGS_API_KEY,
    },
    options: {
      batchSize: parseInt(cliArgs['batch-size'] || process.env.BATCH_SIZE || '100'),
      dryRun: cliArgs['dry-run'] === 'true',
      collections: cliArgs['collections']?.split(',').map(c => c.trim()),
      stateFile: cliArgs['state-file'] || '.collection-backup-state.yaml',
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
    const backup = new WeaviateBackup(config);
    
    await backup.backupAll();
    
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

export { WeaviateBackup, type BackupConfig };
