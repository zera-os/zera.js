/**
 * Solana Bridge Transaction Builders
 * 
 * Modular transaction builders for all Solana bridge operations.
 * Re-exports all transaction builders from category-specific modules.
 */

// ============================================================================
// TOKEN-TYPE ROUTED TRANSACTIONS
// ============================================================================

export {
  buildLockSolanaTransaction,
  buildReleaseSolanaTransaction,
  type LockSolanaTransactionResult,
  type ReleaseSolanaTransactionResult
} from './token-type.js';

// ============================================================================
// RELEASE TRANSACTIONS (ZERA → Solana)
// ============================================================================

export {
  buildReleaseSplTransaction,
  buildReleaseSolTransaction,
  buildReleaseToken2022Transaction,
  buildRelease2022Transaction,
  type ReleaseSplResult,
  type ReleaseSolResult,
  type ReleaseToken2022Result,
  type Release2022Result
} from './release.js';

// ============================================================================
// LOCK TRANSACTIONS (Solana → ZERA)
// ============================================================================

export {
  buildLockSplTransaction,
  buildLockSolTransaction,
  buildLockToken2022Transaction,
  buildLock2022Transaction,
  type LockSplResult,
  type LockSolResult,
  type LockToken2022Result,
  type Lock2022Result
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
  ReleaseToken2022Options,
  Release2022Options,
  ReleaseSplOptions,
  ReleaseSolOptions,
  LockSolanaOptions,
  ReleaseSolanaOptions,
  LockToken2022Options,
  Lock2022Options,
  LockSplOptions,
  LockSolOptions,
  MintWrappedOptions,
  MintWrappedExistingOptions,
  BurnWrappedOptions,
  RegisterTokenOptions,
  RequestTokenRegistrationOptions
} from '../types.js';
