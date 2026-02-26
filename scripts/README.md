# Scripts Directory

Migration and utility scripts for remember-mcp maintenance.

## Setup

Install script dependencies:

```bash
cd scripts
npm install
```

## Available Scripts

### Collection Recreation Migration

Recreates Weaviate collections with updated schema configuration (v3.0.1 fix).

**Required after**: Upgrading from v3.0.0 to v3.0.1

**Documentation**: [README-collection-recreation.md](README-collection-recreation.md)

**Usage**:
```bash
cd scripts
npm run migrate:recreate:dry-run  # Test first
npm run migrate:recreate           # Run migration
```

## Dependencies

Scripts have their own `package.json` to avoid polluting the main project dependencies:

- `weaviate-client` - Weaviate SDK
- `yaml` - YAML parsing for state files
- `dotenv` - Environment configuration
- `tsx` - TypeScript execution

## Environment Configuration

Create `.env` file in scripts directory:

```bash
WEAVIATE_REST_URL=https://your-instance.weaviate.cloud
WEAVIATE_API_KEY=your-api-key
OPENAI_EMBEDDINGS_API_KEY=sk-...
BATCH_SIZE=100
```

Or use environment variables from parent directory.
