import * as esbuild from 'esbuild';
import { execSync } from 'child_process';

// Build server (standalone)
await esbuild.build({
  entryPoints: ['src/server.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: 'dist/server.js',
  sourcemap: true,
  external: [
    'weaviate-client',
    '@prmichaelsen/firebase-admin-sdk-v8',
    '@modelcontextprotocol/sdk'
  ],
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);"
  },
  alias: {
    '@': './src'
  }
});

// Build server factory (bundled for library usage)
await esbuild.build({
  entryPoints: ['src/server-factory.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: 'dist/server-factory.js',
  sourcemap: true,
  external: [
    'weaviate-client',
    '@prmichaelsen/firebase-admin-sdk-v8',
    '@modelcontextprotocol/sdk'
  ],
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);"
  },
  alias: {
    '@': './src'
  }
});

console.log('✓ JavaScript bundles built');

// Generate TypeScript declarations
console.log('Generating TypeScript declarations...');
try {
  execSync('tsc --emitDeclarationOnly --outDir dist', { stdio: 'inherit' });
  console.log('✓ TypeScript declarations generated');
} catch (error) {
  console.error('✗ Failed to generate TypeScript declarations');
  process.exit(1);
}

console.log('✓ Build complete');
