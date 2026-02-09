/**
 * Solana Bridge Module
 * 
 * Complete Solana-side bridge functionality for ZERA ↔ Solana cross-chain transfers.
 * Uses @solana/web3.js for native Solana transaction construction.
 * 
 * ## Quick Start
 * 
 * ```typescript
 * import { Connection, Keypair } from '@solana/web3.js';
 * import { solana } from '@zera-os/zera.js';
 * 
 * // Lock SPL tokens to bridge to ZERA
 * const connection = new Connection('https://api.mainnet-beta.solana.com');
 * const wallet = Keypair.fromSecretKey(yourSecretKey);
 * 
 * const { transaction } = await solana.buildLockSplTransaction(
 *   {
 *     amount: 1000000n, // 1 USDC
 *     mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC mint
 *     zeraAddress: 'your-zera-address',
 *   },
 *   wallet.publicKey,
 *   connection
 * );
 * 
 * // Sign and send
 * transaction.sign(wallet);
 * const signature = await connection.sendRawTransaction(transaction.serialize());
 * ```
 * 
 * ## Available Functions
 * 
 * ### User Operations (Bridging)
 * - `buildLockSplTransaction` - Lock SPL tokens to bridge to ZERA
 * - `buildLockSolTransaction` - Lock native SOL to bridge to ZERA  
 * - `buildBurnWrappedTransaction` - Burn wrapped ZERA tokens to bridge back
 * 
 * ### Guardian Operations (Releasing)
 * - `buildReleaseSplTransaction` - Release SPL tokens (after ZERA → Solana transfer)
 * - `buildReleaseSolTransaction` - Release native SOL (after ZERA → Solana transfer)
 * 
 * ### Utilities
 * - PDA derivation functions for all bridge accounts
 * - Byte encoding utilities for transaction data
 * - Anchor discriminator generation
 */

// ============================================================================
// TYPES
// ============================================================================

export type {
  SolanaBridgeOptions,
  GuardianSignature,
  ReleaseSplOptions,
  ReleaseSolOptions,
  LockSplOptions,
  LockSolOptions,
  MintWrappedOptions,
  MintWrappedExistingOptions,
  BurnWrappedOptions,
  RequestTokenRegistrationOptions,
  RegisterTokenOptions,
  PauseIncomingOptions,
  PauseCompleteOptions,
  UnpauseOptions,
  UpgradeCoreOptions,
  UpgradeTokenBridgeOptions,
  SetGuardiansOptions,
  SolanaBridgeResult
} from './types.js';

// ============================================================================
// PROGRAM IDs & CONSTANTS
// ============================================================================

export {
  CORE_PROGRAM_ID,
  TOKEN_BRIDGE_PROGRAM_ID,
  METADATA_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  ATA_PROGRAM_ID,
  SystemProgram,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  BPF_LOADER_UPGRADEABLE_ID
} from './utils.js';

// ============================================================================
// PDA DERIVATION
// ============================================================================

export {
  deriveRouterSignerPDA,
  deriveRouterConfigPDA,
  deriveVerifiedTransferPDA,
  deriveReleasedTransferPDA,
  deriveVaultPDA,
  deriveRateLimitStatePDA,
  deriveTokenRegistrationPDA,
  deriveWrappedMintPDA,
  deriveWrappedMintAuthorityPDA,
  deriveLockedTransferPDA,
  deriveMetadataPDA,
  getATA
} from './utils.js';

// ============================================================================
// TRANSACTION BUILDERS
// ============================================================================

export {
  // Release operations (Guardian-executed, ZERA → Solana)
  buildReleaseSplTransaction,
  buildReleaseSolTransaction,
  
  // Lock operations (User-initiated, Solana → ZERA)
  buildLockSplTransaction,
  buildLockSolTransaction,
  
  // Wrapped token operations
  buildBurnWrappedTransaction,
  buildMintWrappedTransaction,
  buildMintWrappedExistingTransaction,
  
  // Token registration operations
  buildRequestTokenRegistrationTransaction,
  buildRegisterTokenTransaction,
  
  // Result types
  type ReleaseSplResult,
  type ReleaseSolResult,
  type LockSplResult,
  type LockSolResult,
  type BurnWrappedResult,
  type MintWrappedResult,
  type MintWrappedExistingResult,
  type RequestTokenRegistrationResult,
  type RegisterTokenResult
} from './transactions/index.js';

// ============================================================================
// UTILITIES
// ============================================================================

export {
  // Discriminator generation
  generateDiscriminator,
  
  // Borsh encoding
  encodeBorshString,
  encodeBorshOption,
  
  // Hashing
  hashContractId,
  
  // Byte utilities (re-exported from shared)
  hexToBytes,
  bytesToHex,
  concatBytes,
  encodeU64LE,
  encodeU64BE,
  encodeU32LE,
  encodeU32BE,
  encodeU16LE,
  encodeU16BE,
  decodeU64LE,
  decodeU64BE,
  decodeU32LE,
  bytesEqual,
  fixedBytes
} from './utils.js';

// ============================================================================
// SOLANA PRIMITIVES (Re-exports for convenience)
// ============================================================================

export { PublicKey, Connection, Transaction, Keypair, sendAndConfirmTransaction } from '@solana/web3.js';
