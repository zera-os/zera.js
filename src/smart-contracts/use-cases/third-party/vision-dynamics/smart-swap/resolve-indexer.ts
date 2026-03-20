/**
 * Indexer API Resolution
 * 
 * Resolves the `indexer-api-ts` SDK using a local-first strategy:
 * 
 *   1. **Local**: Checks for a sibling `indexer-api-ts` directory next to the
 *      zera.js project root (i.e., `../../indexer-api-ts` relative to zera.js).
 *      This is the typical setup for contributors who have both repos cloned.
 * 
 *   2. **npm**: Falls back to `@visiondynamics/zera-indexer` from npm.
 *      This is the published package for production consumers.
 * 
 * Usage:
 *   import { resolveIndexerClient } from '../resolve-indexer.js';
 *   const { ZeraClient } = await resolveIndexerClient();
 */

import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Path to the local `indexer-api-ts` directory.
 * Assumes the standard layout where both repos are siblings:
 * 
 * ```
 * Documents/GitHub/
 * ├── zera.js/               ← this project
 * └── indexer-api-ts/        ← local indexer SDK
 * ```
 * 
 * From this file's location (smart-swap/resolve-indexer.ts):
 *   7 levels up = Documents/GitHub/  (parent of zera.js)
 */
const LOCAL_INDEXER_PATH = resolve(__dirname, '../../../../../../../indexer-api-ts');

/** npm package name for the published indexer SDK */
const NPM_PACKAGE = '@visiondynamics/zera-indexer';

/**
 * Resolve and import the indexer-api-ts SDK.
 * 
 * Tries local path first, falls back to npm package.
 * Logs which source was used for transparency.
 * 
 * @returns The imported indexer-api-ts module (contains ZeraClient, etc.)
 */
export async function resolveIndexerClient(): Promise<Record<string, unknown>> {
  // Try local first
  if (existsSync(LOCAL_INDEXER_PATH)) {
    try {
      // Use pathToFileURL for cross-platform ESM dynamic import safety
      const importPath = pathToFileURL(LOCAL_INDEXER_PATH).href;
      const mod = await import(importPath);
      console.log(`  📦 indexer-api-ts: resolved locally (${LOCAL_INDEXER_PATH})`);
      return mod;
    } catch (err) {
      console.warn(`  ⚠️  Local indexer-api-ts found but failed to import: ${(err as Error).message}`);
      console.warn('     → Have you run \'npm run build\' in indexer-api-ts?');
    }
  }

  // Fall back to npm
  try {
    const mod = await import(NPM_PACKAGE);
    console.log(`  📦 indexer-api-ts: resolved from npm (${NPM_PACKAGE})`);
    return mod;
  } catch {
    throw new Error(
      'Could not resolve indexer-api-ts.\n' +
      '  Tried:\n' +
      `    1. Local:  ${LOCAL_INDEXER_PATH}\n` +
      `    2. npm:    ${NPM_PACKAGE}\n\n` +
      '  Either:\n' +
      '    • Clone indexer-api-ts next to zera.js and run \'npm run build\'\n' +
      `    • Install from npm: npm install ${NPM_PACKAGE}`
    );
  }
}
