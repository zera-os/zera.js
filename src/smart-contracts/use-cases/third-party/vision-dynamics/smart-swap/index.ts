/**
 * ZERA Smart Swap — Public API
 * 
 * Indexer-powered swap SDK for the ZERA DEX. Delegates route computation
 * to the Vision Dynamics Indexer API and handles signing/submission via zera.js.
 * 
 * ## How It Works
 * 
 * Unlike the direct DEX SDK (which builds single-pool swaps locally), Smart Swap
 * uses the Vision Dynamics Indexer API's `/v1/dex/swap` endpoint for multi-hop route discovery,
 * split optimization, and transaction assembly. Your code handles signing and submission.
 * 
 * ## Three Modes
 * 
 * - **Mode 1 (Quote)**: `getQuote()` — Price preview, no keys needed
 * - **Mode 2 (Direct Build)**: `swap()` / `swapAndSend()` — Quote + build in one call
 * - **Mode 3 (From Stages)**: `swapFromStages()` / `swapFromStagesAndSend()` — Build from a previous quote's stages
 * 
 * ## Prerequisites
 * 
 * Requires `indexer-api-ts` for API communication. Use `resolveIndexerClient()`
 * for automatic local-first resolution (sibling directory → npm fallback):
 * 
 * ```typescript
 * import { resolveIndexerClient } from './resolve-indexer.js';
 * const { ZeraClient } = await resolveIndexerClient();
 * const dex = new ZeraClient({ baseUrl: 'https://your-indexer' }).v1.dex;
 * ```
 * 
 * ## Module Structure
 * 
 * ```
 * smart-swap/
 * ├── index.ts                # Public API (this file)
 * ├── types.ts                # Type definitions
 * ├── resolve-indexer.ts      # Local-first SDK resolution
 * ├── examples/
 * │   └── smart-swap-flows.ts # End-to-end example
 * └── README.md               # Documentation
 * ```
 */

// ============================================================================
// TYPES
// ============================================================================

export type {
  SmartSwapOptions,
  QuoteParams,
  SwapParams,
  SwapFromStagesParams
} from './types.js';

// ============================================================================
// INDEXER RESOLUTION
// ============================================================================

export { resolveIndexerClient } from './resolve-indexer.js';
