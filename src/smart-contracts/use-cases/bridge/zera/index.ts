/**
 * Bridge - ZERA Chain Operations (Public API)
 * 
 * Complete ZERA-side bridge functionality via the `bridge_proxy` smart contract.
 * 
 * ## Outbound (ZERA → Solana)
 * - `lockZera` / `lockZeraAndSend` - Lock ZERA tokens to bridge out
 * - `burnSol` / `burnSolAndSend` - Burn wrapped SOL tokens
 * 
 * ## Inbound (Solana → ZERA)
 * - `releaseZera` / `releaseZeraAndSend` - Release locked ZERA tokens
 * - `mintSol` / `mintSolAndSend` - Mint wrapped SOL tokens
 * - `createSol` / `createSolAndSend` - Create wrapped SOL token (first time)
 * 
 * ## Legacy Aliases
 * - `bridgeZeraToSol` = `lockZera`
 * - `bridgeZeraToSolAndSend` = `lockZeraAndSend`
 * 
 * ## Module Structure
 * 
 * ```
 * zera/
 * ├── transactions/       # Transaction builders
 * │   ├── lock.ts         # lockZera, burnSol
 * │   ├── release.ts      # releaseZera, mintSol, createSol
 * │   └── index.ts        # Re-exports all transactions
 * ├── types.ts            # Type definitions
 * ├── utils.ts            # Helper functions
 * └── index.ts            # Public API (this file)
 * ```
 */

// ============================================================================
// TRANSACTION BUILDERS
// ============================================================================

export {
  // Lock ZERA (ZERA → Solana)
  lockZera,
  lockZeraAndSend,
  
  // Burn wrapped SOL (ZERA → Solana)
  burnSol,
  burnSolAndSend,
  
  // Release ZERA (Solana → ZERA)
  releaseZera,
  releaseZeraAndSend,
  
  // Mint wrapped SOL (Solana → ZERA)
  mintSol,
  mintSolAndSend,
  
  // Create wrapped SOL (Solana → ZERA, first time)
  createSol,
  createSolAndSend,
  
  // Legacy aliases
  bridgeZeraToSol,
  bridgeZeraToSolAndSend
} from './transactions/index.js';

// ============================================================================
// TYPES
// ============================================================================

export type {
  BridgeZeraOptions,
  BridgeZeraToSolOptions,
  BurnSolOptions,
  ReleaseZeraOptions,
  MintSolOptions,
  CreateSolOptions,
  LockZeraResult,
  ReleaseZeraResult,
  MintSolResult,
  CreateSolResult,
  BurnSolResult
} from './types.js';

// ============================================================================
// UTILITIES
// ============================================================================

export {
  BRIDGE_CONTRACT_NAME,
  BRIDGE_INSTANCE,
  formatGuardianSignatures,
  createBridgeTransaction
} from './utils.js';
