#!/usr/bin/env tsx
/**
 * Delete Collection Script
 * 
 * Safely deletes a Weaviate collection with confirmation.
 * 
 * Usage:
 *   # Delete a specific collection
 *   npx tsx scripts/delete-collection.ts --collection "Memory_user123"
 * 
 *   # Delete with confirmation skip (dangerous!)
 *   npx tsx scripts/delete-collection.ts --collection "Memory_user123" --force
 */

import weaviate, { WeaviateClient } from 'weaviate-client';
import * as dotenv from 'dotenv';
import * as readline from 'readline';

// Load environment
dotenv.config();

async function promptConfirmation(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message} (yes/no): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes');
    });
  });
}

async function main() {
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

  const collectionName = cliArgs['collection'];
  const force = cliArgs['force'] === 'true';
  const weaviateUrl = cliArgs['weaviate-url'] || process.env.WEAVIATE_REST_URL || '';
  const weaviateApiKey = cliArgs['weaviate-key'] || process.env.WEAVIATE_API_KEY;
  const openaiApiKey = cliArgs['openai-key'] || process.env.OPENAI_EMBEDDINGS_API_KEY;

  if (!collectionName) {
    console.error('❌ Error: --collection argument is required');
    console.log('\nUsage:');
    console.log('  npx tsx scripts/delete-collection.ts --collection "Memory_user123"');
    process.exit(1);
  }

  if (!weaviateUrl) {
    console.error('❌ Error: WEAVIATE_REST_URL environment variable is required');
    process.exit(1);
  }

  try {
    console.log('🔌 Connecting to Weaviate...');
    
    const clientConfig: any = {
      authCredentials: weaviateApiKey ? new weaviate.ApiKey(weaviateApiKey) : undefined,
    };

    if (openaiApiKey) {
      clientConfig.headers = {
        'X-Openai-Api-Key': openaiApiKey,
      };
    }

    const client = await weaviate.connectToWeaviateCloud(weaviateUrl, clientConfig);
    console.log('✓ Connected\n');

    // Check if collection exists
    const exists = await client.collections.exists(collectionName);
    if (!exists) {
      console.log(`ℹ️  Collection ${collectionName} does not exist`);
      await client.close();
      process.exit(0);
    }

    // Get document count
    const collection = client.collections.get(collectionName);
    const aggregate = await collection.aggregate.overAll();
    const documentCount = aggregate.totalCount || 0;

    console.log(`📦 Collection: ${collectionName}`);
    console.log(`📊 Documents: ${documentCount}`);
    console.log('');

    // Confirm deletion
    if (!force) {
      const confirmed = await promptConfirmation(
        `⚠️  Are you sure you want to delete "${collectionName}" with ${documentCount} documents?`
      );

      if (!confirmed) {
        console.log('❌ Deletion cancelled');
        await client.close();
        process.exit(0);
      }
    }

    // Delete collection
    console.log(`\n🗑️  Deleting ${collectionName}...`);
    await client.collections.delete(collectionName);
    console.log('✓ Collection deleted\n');

    await client.close();
    
    console.log('✨ Done!\n');
    process.exit(0);
  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
