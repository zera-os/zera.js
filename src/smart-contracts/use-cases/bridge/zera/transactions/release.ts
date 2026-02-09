/**
 * ZERA Release Transactions
 * 
 * Inbound bridge operations: Release locked ZERA tokens, mint wrapped SOL tokens,
 * or create new wrapped tokens when receiving from Solana.
 * 
 * ## Functions
 * - `releaseZera` - Release locked ZERA tokens (from Solana lock)
 * - `mintSol` - Mint wrapped SOL tokens (for existing wrapped tokens)
 * - `createSol` - Create wrapped SOL token (first time bridge)
 */

import type { ZeraReleasePayload, ZeraMintPayload, ZeraContractPayload } from '../../../../../../proto/generated/guardian_pb.js';
import { SmartContractExecuteTXN } from '../../../../../../proto/generated/txn_pb.js';
import { MAINNET_GRPC_CONFIG } from '../../../../../shared/utils/testing-defaults/index.js';
import { sendSmartContractExecuteTXN } from '../../../../execute/index.js';
import type { ReleaseZeraOptions, MintSolOptions, CreateSolOptions } from '../types.js';
import { createBridgeTransaction } from '../utils.js';

// ============================================================================
// RELEASE ZERA (Solana → ZERA, for locked ZERA tokens)
// ============================================================================

/**
 * Release locked ZERA tokens
 * 
 * Called after a user locks tokens on Solana to release the corresponding
 * ZERA tokens that were previously locked.
 * 
 * @param toZeraAddress - ZERA address to receive the released tokens
 * @param publicKeyBase58Identifier - Public key of the transaction sender
 * @param privateKeyBase58 - Private key of the transaction sender
 * @param options - Configuration including the guardian payload
 * @returns The created transaction (not yet sent)
 * 
 * @example
 * ```typescript
 * import { guardian, zera } from '@zera-os/zera.js';
 * 
 * // Fetch payload from guardian
 * const payload = await guardian.fetchZeraPayload(solanaTxSignature, guardianConfig);
 * 
 * // Release tokens on ZERA
 * const hash = await zera.releaseZeraAndSend(
 *   zeraAddress,
 *   publicKey,
 *   privateKey,
 *   { payload }
 * );
 * ```
 */
export async function releaseZera(
  toZeraAddress: string,
  publicKeyBase58Identifier: string,
  privateKeyBase58: string,
  options: ReleaseZeraOptions
): Promise<SmartContractExecuteTXN> {
  if (!toZeraAddress) throw new Error('toZeraAddress is required');
  if (!options.payload) throw new Error('payload is required');
  
  const { payload } = options;
  
  if (payload.payload.case !== 'releasePayload') {
    throw new Error(`Expected releasePayload, got: ${payload.payload.case}`);
  }
  
  const releasePayload = payload.payload.value as ZeraReleasePayload;
  
  // Separate params matching Rust: release_zera(contract_id, amount, wallet_address, tx_signature, signed_hash, signatures, guardian_keys)
  const signatures = payload.signatures.join('|');
  const guardianKeys = payload.publicKeys.join('|');
  
  const parameterValue = [
    releasePayload.zeraContractId,       // contract_id
    releasePayload.amount,               // amount
    toZeraAddress,                       // wallet_address
    releasePayload.txSignature,          // tx_signature
    payload.signedHash,                  // signed_hash
    signatures,                          // signatures (pipe-separated)
    guardianKeys                         // guardian_keys (pipe-separated)
  ].join(',');
  
  const feeId = options.feeId || releasePayload.zeraContractId;
  
  return createBridgeTransaction(
    'release_zera',
    parameterValue,
    publicKeyBase58Identifier,
    privateKeyBase58,
    feeId,
    options
  );
}

/**
 * Release ZERA tokens and send in one call
 */
export async function releaseZeraAndSend(
  toZeraAddress: string,
  publicKeyBase58Identifier: string,
  privateKeyBase58: string,
  options: ReleaseZeraOptions
): Promise<string> {
  const txn = await releaseZera(
    toZeraAddress, publicKeyBase58Identifier, privateKeyBase58, options
  );
  const grpcConfig = options.grpcConfig || MAINNET_GRPC_CONFIG;
  return sendSmartContractExecuteTXN(txn, grpcConfig);
}

// ============================================================================
// MINT SOL (Solana → ZERA, for existing wrapped SOL)
// ============================================================================

/**
 * Mint wrapped SOL tokens on ZERA
 * 
 * Called after a user locks SOL/SPL tokens on Solana to mint the corresponding
 * wrapped tokens on ZERA. Use this for tokens that already have a wrapped version.
 * 
 * @param toZeraAddress - ZERA address to receive the minted tokens
 * @param publicKeyBase58Identifier - Public key of the transaction sender
 * @param privateKeyBase58 - Private key of the transaction sender
 * @param options - Configuration including the guardian payload
 * @returns The created transaction (not yet sent)
 */
export async function mintSol(
  toZeraAddress: string,
  publicKeyBase58Identifier: string,
  privateKeyBase58: string,
  options: MintSolOptions
): Promise<SmartContractExecuteTXN> {
  if (!toZeraAddress) throw new Error('toZeraAddress is required');
  if (!options.payload) throw new Error('payload is required');
  
  const { payload } = options;
  
  if (payload.payload.case !== 'mintPayload') {
    throw new Error(`Expected mintPayload, got: ${payload.payload.case}`);
  }
  
  const mintPayload = payload.payload.value as ZeraMintPayload;
  
  // Format: mint_id,amount,wallet_address,token_price,tx_signature,signed_hash,signatures,guardian_keys
  // Rust fn signature: mint_sol(mint_id, amount, wallet_address, token_price, tx_signature, signed_hash, signatures, guardian_keys)
  const signatures = payload.signatures.join('|');
  const guardianKeys = payload.publicKeys.join('|');
  
  const parameterValue = [
    mintPayload.solanaMintAddress,           // mint_id
    mintPayload.amount,                       // amount
    toZeraAddress,                            // wallet_address
    mintPayload.usdPrice,                     // token_price
    mintPayload.txSignature,                  // tx_signature
    payload.signedHash,                       // signed_hash
    signatures,                               // signatures (pipe-separated)
    guardianKeys                              // guardian_keys (pipe-separated)
  ].join(',');
  
  // Use a default fee token (e.g., ZERA) for wrapped token minting
  const feeId = options.feeId || '$ZRA+0000';
  
  return createBridgeTransaction(
    'mint_sol',
    parameterValue,
    publicKeyBase58Identifier,
    privateKeyBase58,
    feeId,
    options
  );
}

/**
 * Mint wrapped SOL tokens and send in one call
 */
export async function mintSolAndSend(
  toZeraAddress: string,
  publicKeyBase58Identifier: string,
  privateKeyBase58: string,
  options: MintSolOptions
): Promise<string> {
  const txn = await mintSol(
    toZeraAddress, publicKeyBase58Identifier, privateKeyBase58, options
  );
  const grpcConfig = options.grpcConfig || MAINNET_GRPC_CONFIG;
  return sendSmartContractExecuteTXN(txn, grpcConfig);
}

// ============================================================================
// CREATE SOL (Solana → ZERA, first-time wrapped token creation)
// ============================================================================

/**
 * Create wrapped SOL token on ZERA (first time)
 * 
 * Called when a Solana token is being bridged to ZERA for the first time.
 * This creates the wrapped token contract and mints the initial supply.
 * 
 * @param toZeraAddress - ZERA address to receive the minted tokens
 * @param publicKeyBase58Identifier - Public key of the transaction sender
 * @param privateKeyBase58 - Private key of the transaction sender
 * @param options - Configuration including the guardian payload
 * @returns The created transaction (not yet sent)
 */
export async function createSol(
  toZeraAddress: string,
  publicKeyBase58Identifier: string,
  privateKeyBase58: string,
  options: CreateSolOptions
): Promise<SmartContractExecuteTXN> {
  if (!toZeraAddress) throw new Error('toZeraAddress is required');
  if (!options.payload) throw new Error('payload is required');
  
  const { payload } = options;
  
  if (payload.payload.case !== 'contractPayload') {
    throw new Error(`Expected contractPayload, got: ${payload.payload.case}`);
  }
  
  const contractPayload = payload.payload.value as ZeraContractPayload;
  
  // Separate params matching other release functions
  const signatures = payload.signatures.join('|');
  const guardianKeys = payload.publicKeys.join('|');
  
  // Format: symbol,name,denomination,zeraWalletAddress,amount,solanaMintAddress,uri,solanaAuthorizedAddress,txSignature,signedHash,signatures,guardianKeys,usdPrice
  const parameterValue = [
    contractPayload.symbol,
    contractPayload.name,
    contractPayload.denomination,
    toZeraAddress,
    contractPayload.amount,
    contractPayload.solanaMintAddress,
    contractPayload.uri,
    contractPayload.solanaAuthorizedAddress,
    contractPayload.txSignature,
    payload.signedHash,                      // signed_hash
    signatures,                              // signatures (pipe-separated)
    guardianKeys,                            // guardian_keys (pipe-separated)
    contractPayload.usdPrice                 // token_price (last param)
  ].join(',');
  
  const feeId = options.feeId || '$ZRA+0000';
  
  return createBridgeTransaction(
    'create_sol',
    parameterValue,
    publicKeyBase58Identifier,
    privateKeyBase58,
    feeId,
    options
  );
}

/**
 * Create wrapped SOL token and send in one call
 */
export async function createSolAndSend(
  toZeraAddress: string,
  publicKeyBase58Identifier: string,
  privateKeyBase58: string,
  options: CreateSolOptions
): Promise<string> {
  const txn = await createSol(
    toZeraAddress, publicKeyBase58Identifier, privateKeyBase58, options
  );
  const grpcConfig = options.grpcConfig || MAINNET_GRPC_CONFIG;
  return sendSmartContractExecuteTXN(txn, grpcConfig);
}
