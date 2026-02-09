/**
 * Solana Bridge Transaction Builders
 * 
 * Modular transaction builders for all Solana bridge operations.
 * Re-exports all transaction builders from category-specific modules.
 */

// ============================================================================
// RELEASE TRANSACTIONS (ZERA → Solana)
// ============================================================================

export {
  buildReleaseSplTransaction,
  buildReleaseSolTransaction,
  type ReleaseSplResult,
  type ReleaseSolResult
} from './release.js';

// ============================================================================
// LOCK TRANSACTIONS (Solana → ZERA)
// ============================================================================

export {
  buildLockSplTransaction,
  buildLockSolTransaction,
  type LockSplResult,
  type LockSolResult
} from './lock.js';

// ============================================================================
// BURN TRANSACTIONS (Wrapped → ZERA)
// ============================================================================

export {
  buildBurnWrappedTransaction,
  type BurnWrappedResult
} from './burn.js';

// ============================================================================
// MINT TRANSACTIONS (ZERA tokens on Solana)
// ============================================================================

export {
  buildMintWrappedTransaction,
  buildMintWrappedExistingTransaction,
  type MintWrappedResult,
  type MintWrappedExistingResult
} from './mint.js';

// ============================================================================
// REGISTRATION TRANSACTIONS
// ============================================================================

export {
  buildRequestTokenRegistrationTransaction,
  buildRegisterTokenTransaction,
  type RequestTokenRegistrationResult,
  type RegisterTokenResult
} from './registration.js';

// ============================================================================
// SHARED TYPES (Re-export from types module)
// ============================================================================

export type {
  GuardianSignature,
  ReleaseSplOptions,
  ReleaseSolOptions,
  LockSplOptions,
  LockSolOptions,
  MintWrappedOptions,
  MintWrappedExistingOptions,
  BurnWrappedOptions,
  RegisterTokenOptions,
  RequestTokenRegistrationOptions
} from '../types.js';
