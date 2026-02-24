/**
 * Cross-Chain Bridge - Public API
 * 
 * Complete bidirectional ZERA ↔ Solana bridge SDK.
 * 
 * ## Modules
 * 
 * ### ZERA (./zera)
 * ZERA-side bridge operations via the `bridge_proxy` smart contract.
 * 
 * **Outbound (ZERA → Solana):**
 * - `lockZera` / `lockZeraAndSend` - Lock ZERA tokens to bridge out
 * - `burnSol` / `burnSolAndSend` - Burn wrapped SOL tokens
 * 
 * **Inbound (Solana → ZERA):**
 * - `releaseZera` / `releaseZeraAndSend` - Release locked ZERA tokens
 * - `mintSol` / `mintSolAndSend` - Mint wrapped SOL tokens
 * - `createSol` / `createSolAndSend` - Create wrapped SOL token (first time)
 * 
 * ### Solana (./solana)
 * Solana-side bridge operations via on-chain programs.
 * - `buildReleaseSplTransaction` (handles both SPL and SOL)
 * - `buildLockSplTransaction` / `buildLockSolTransaction`
 * - `buildMintWrappedTransaction` / `buildMintWrappedExistingTransaction`
 * - `buildBurnWrappedTransaction`
 * - `buildRegisterTokenTransaction`
 * 
 * ### Guardian (./guardian)
 * VAA (Verified Action Approval) helpers for cross-chain attestation.
 * - `submitVAAToSolana` - Fetch VAA + build + submit to Solana (one-liner)
 * - `submitVAAToZera` - Fetch VAA + build + submit to ZERA (one-liner)
 * - `fetchSolanaVAA` / `fetchZeraVAA` - Manual VAA fetching
 * 
 * ## Quick Start
 * 
 * ### ZERA → Solana (Automated)
 * ```typescript
 * import { lockZeraAndSend, guardian } from '@zera-os/zera.js';
 * 
 * // Step 1: Lock tokens on ZERA
 * const txnHash = await lockZeraAndSend('$ZRA+0000', '10', 'solana-address', pubKey, privKey);
 * 
 * // Step 2: Submit VAA to Solana (one-liner)
 * const result = await guardian.submitVAAToSolana({ txnHash, guardianConfig, connection, payer });
 * ```
 * 
 * ### Solana → ZERA (Automated)
 * ```typescript
 * import { solana, guardian } from '@zera-os/zera.js';
 * 
 * // Step 1: Lock tokens on Solana
 * const { transaction } = await solana.buildLockSplTransaction({ amount, mint, zeraAddress }, payer, connection);
 * const txSignature = await sendAndConfirmTransaction(connection, transaction, [payer]);
 * 
 * // Step 2: Submit VAA to ZERA (one-liner)
 * const result = await guardian.submitVAAToZera({ txSignature, guardianConfig, zeraConfig, publicKeyBase58, privateKeyBase58 });
 * ```
 */

// ZERA Chain - All bridge operations
export {
  // Outbound: Lock ZERA to bridge to Solana
  lockZera,
  lockZeraAndSend,
  
  // Outbound: Burn wrapped SOL to bridge back to Solana
  burnSol,
  burnSolAndSend,
  
  // Inbound: Release locked ZERA (from Solana lock)
  releaseZera,
  releaseZeraAndSend,
  
  // Inbound: Mint wrapped SOL (from Solana lock)
  mintSol,
  mintSolAndSend,
  
  // Inbound: Create wrapped SOL (first time mint)
  createSol,
  createSolAndSend,
  
  // Legacy aliases
  bridgeZeraToSol,
  bridgeZeraToSolAndSend,
  
  // Types
  type BridgeZeraOptions,
  type ReleaseZeraOptions,
  type MintSolOptions,
  type CreateSolOptions,
  type BurnSolOptions
} from './zera/index.js';

// Re-export Solana and Guardian modules as namespaces for cleaner imports
export * as solana from './solana/index.js';
export * as guardian from './guardian/index.js';

// Also export ZERA as namespace for consistency
export * as zera from './zera/index.js';
