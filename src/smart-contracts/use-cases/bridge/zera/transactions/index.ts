/**
 * ZERA Bridge Transaction Builders
 * 
 * Modular transaction builders for all ZERA bridge operations.
 * Re-exports all transaction builders from category-specific modules.
 */

// ============================================================================
// LOCK TRANSACTIONS (ZERA → Solana)
// ============================================================================

export {
  lockZera,
  lockZeraAndSend,
  burnSol,
  burnSolAndSend,
  
  // Legacy aliases
  bridgeZeraToSol,
  bridgeZeraToSolAndSend
} from './lock.js';

// ============================================================================
// RELEASE TRANSACTIONS (Solana → ZERA)
// ============================================================================

export {
  releaseZera,
  releaseZeraAndSend,
  mintSol,
  mintSolAndSend,
  createSol,
  createSolAndSend
} from './release.js';

// ============================================================================
// SHARED TYPES (Re-export from types module)
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
} from '../types.js';
