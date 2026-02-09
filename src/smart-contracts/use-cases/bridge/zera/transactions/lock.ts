/**
 * ZERA Lock Transactions
 * 
 * Outbound bridge operations: Lock ZERA tokens or burn wrapped SOL tokens
 * to receive tokens on Solana.
 * 
 * ## Functions
 * - `lockZera` - Lock ZERA tokens to bridge to Solana
 * - `burnSol` - Burn wrapped SOL tokens to release on Solana
 */

import { SmartContractExecuteTXN } from '../../../../../../proto/generated/txn_pb.js';
import { getTokenInfoForSingle } from '../../../../../api/handler/token-info/service.js';
import { MAINNET_GRPC_CONFIG } from '../../../../../shared/utils/testing-defaults/index.js';
import { toSmallestUnits } from '../../../../../shared/utils/unified-amount-conversion.js';
import type { AmountInput } from '../../../../../types/index.js';
import { sendSmartContractExecuteTXN } from '../../../../execute/index.js';
import type { BridgeZeraOptions, BurnSolOptions } from '../types.js';
import { createBridgeTransaction } from '../utils.js';

// ============================================================================
// LOCK ZERA (ZERA → Solana)
// ============================================================================

/**
 * Lock ZERA tokens to bridge to Solana
 * 
 * This creates a transaction to lock tokens on ZERA chain. Once confirmed,
 * Guardians will sign a VAA that can be used to release/mint on Solana.
 * 
 * @param contractId - Contract ID of the token to bridge (e.g., '$ZRA+0000')
 * @param amount - User-friendly amount to bridge (e.g., '5' for 5 tokens)
 * @param toSolanaAddress - Solana address to receive the bridged tokens
 * @param publicKeyBase58Identifier - Public key identifier of the sender
 * @param privateKeyBase58 - Private key of the sender
 * @param options - Optional configuration
 * @returns The created transaction (not yet sent)
 * 
 * @example
 * ```typescript
 * const txn = await lockZera(
 *   '$ZRA+0000',
 *   '10',
 *   'SolanaRecipientAddress...',
 *   publicKey,
 *   privateKey
 * );
 * const hash = await sendSmartContractExecuteTXN(txn, grpcConfig);
 * ```
 */
export async function lockZera(
  contractId: string,
  amount: AmountInput | string,
  toSolanaAddress: string,
  publicKeyBase58Identifier: string,
  privateKeyBase58: string,
  options: BridgeZeraOptions = {}
): Promise<SmartContractExecuteTXN> {
  if (!contractId) throw new Error('contractId is required');
  if (!amount) throw new Error('amount is required');
  if (!toSolanaAddress) throw new Error('toSolanaAddress is required');
  if (!publicKeyBase58Identifier) throw new Error('publicKeyBase58Identifier is required');
  if (!privateKeyBase58) throw new Error('privateKeyBase58 is required');

  const grpcConfig = options.grpcConfig || MAINNET_GRPC_CONFIG;
  const tokenInfo = await getTokenInfoForSingle(contractId, grpcConfig);
  const amountInParts = toSmallestUnits(amount, contractId, {
    denomination: tokenInfo.denomination
  });

  // Format: contractId,amountInParts,toSolanaAddress
  const parameterValue = `${contractId},${amountInParts},${toSolanaAddress}`;
  const feeId = options.feeId || contractId;

  return createBridgeTransaction(
    'lock_zera',
    parameterValue,
    publicKeyBase58Identifier,
    privateKeyBase58,
    feeId,
    options
  );
}

/**
 * Lock ZERA tokens and send in one call
 */
export async function lockZeraAndSend(
  contractId: string,
  amount: AmountInput | string,
  toSolanaAddress: string,
  publicKeyBase58Identifier: string,
  privateKeyBase58: string,
  options: BridgeZeraOptions = {}
): Promise<string> {
  const txn = await lockZera(
    contractId, amount, toSolanaAddress,
    publicKeyBase58Identifier, privateKeyBase58, options
  );
  const grpcConfig = options.grpcConfig || MAINNET_GRPC_CONFIG;
  return sendSmartContractExecuteTXN(txn, grpcConfig);
}

// Legacy aliases
export const bridgeZeraToSol = lockZera;
export const bridgeZeraToSolAndSend = lockZeraAndSend;

// ============================================================================
// BURN SOL (ZERA → Solana, for wrapped SOL tokens)
// ============================================================================

/**
 * Burn wrapped SOL tokens to bridge back to Solana
 * 
 * Burns wrapped Solana tokens on ZERA to release the original tokens on Solana.
 * 
 * @param contractId - ZERA contract ID of the wrapped token (e.g., '$SOL+0001')
 * @param amount - User-friendly amount to burn
 * @param toSolanaAddress - Solana address to receive the released tokens
 * @param publicKeyBase58Identifier - Public key of the transaction sender
 * @param privateKeyBase58 - Private key of the transaction sender
 * @param options - Optional configuration
 * @returns The created transaction (not yet sent)
 */
export async function burnSol(
  contractId: string,
  amount: AmountInput | string,
  toSolanaAddress: string,
  publicKeyBase58Identifier: string,
  privateKeyBase58: string,
  options: BurnSolOptions = {}
): Promise<SmartContractExecuteTXN> {
  if (!contractId) throw new Error('contractId is required');
  if (!amount) throw new Error('amount is required');
  if (!toSolanaAddress) throw new Error('toSolanaAddress is required');
  if (!publicKeyBase58Identifier) throw new Error('publicKeyBase58Identifier is required');
  if (!privateKeyBase58) throw new Error('privateKeyBase58 is required');

  const grpcConfig = options.grpcConfig || MAINNET_GRPC_CONFIG;
  
  let amountInParts: string;
  if (options.denomination !== undefined) {
    amountInParts = toSmallestUnits(amount, contractId, {
      denomination: options.denomination
    });
  } else {
    const tokenInfo = await getTokenInfoForSingle(contractId, grpcConfig);
    amountInParts = toSmallestUnits(amount, contractId, {
      denomination: tokenInfo.denomination
    });
  }

  // Format: contractId,amountInParts,toSolanaAddress
  const parameterValue = `${contractId},${amountInParts},${toSolanaAddress}`;
  const feeId = options.feeId || contractId;

  return createBridgeTransaction(
    'burn_sol',
    parameterValue,
    publicKeyBase58Identifier,
    privateKeyBase58,
    feeId,
    options
  );
}

/**
 * Burn wrapped SOL tokens and send in one call
 */
export async function burnSolAndSend(
  contractId: string,
  amount: AmountInput | string,
  toSolanaAddress: string,
  publicKeyBase58Identifier: string,
  privateKeyBase58: string,
  options: BurnSolOptions = {}
): Promise<string> {
  const txn = await burnSol(
    contractId, amount, toSolanaAddress,
    publicKeyBase58Identifier, privateKeyBase58, options
  );
  const grpcConfig = options.grpcConfig || MAINNET_GRPC_CONFIG;
  return sendSmartContractExecuteTXN(txn, grpcConfig);
}
