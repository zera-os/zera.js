/**
 * Contract Update Transaction
 *
 * This module provides functionality for updating existing contracts (ContractUpdateTXN) on the ZERA Network.
 */

import { protoInt64 } from '@bufbuild/protobuf';

import {
  ContractUpdateTXN
} from '../../../proto/generated/txn_pb.js';
import { createTransactionClient } from '../../grpc/transaction/transaction-client.js';
import { UniversalFeeCalculator, type FeeConfigHelper } from '../../shared/fee-calculators/universal-fee-calculator.js';
import { logger } from '../../shared/monitoring/index.js';
import { buildStandardBaseTXN, getAddressAndNonce } from '../../shared/tx/base.js';
import { signStandardTXN, addHash } from '../../shared/tx/signing.js';
import { MAINNET_GRPC_CONFIG } from '../../shared/utils/testing-defaults/index.js';
import type { GRPCConfig } from '../../types/index.js';
import type { UpdateContractOptions } from '../shared/types.js';
import { validateUpdateContractOptions, validateKeyPair } from '../shared/utils.js';

/**
 * Creates a contract update (ContractUpdateTXN) transaction.
 * 
 * This function handles the complete contract update process including:
 * - Input validation
 * - Nonce retrieval from the network
 * - Automatic fee calculation (if not provided)
 * - Transaction signing
 * - Hash generation
 * 
 * @param options - Contract update options including contract details, keys, and configuration
 * @returns Promise that resolves to a complete ContractUpdateTXN ready for submission
 * 
 * @example
 * ```typescript
 * const update = await updateContract({
 *   contractId: '$MYT+0000',
 *   contractVersion: BigInt(1),
 *   publicKeyBase58Identifier: 'your-public-key',
 *   privateKeyBase58: 'your-private-key',
 *   name: 'Updated Token Name'
 * });
 * ```
 * 
 * @throws {Error} When required parameters are missing or invalid
 * @throws {NetworkError} When network communication fails
 * @throws {CryptoError} When cryptographic operations fail
 * 
 * @since 1.0.0
 */
export async function updateContract(
  options: UpdateContractOptions
): Promise<ContractUpdateTXN> {
  // Validate required parameters
  validateUpdateContractOptions({
    contractId: options.contractId,
    contractVersion: options.contractVersion
  });

  validateKeyPair({
    publicKeyBase58Identifier: options.publicKeyBase58Identifier,
    privateKeyBase58: options.privateKeyBase58
  });

  const grpcConfig = options.grpcConfig || MAINNET_GRPC_CONFIG;

  // Get nonce - either from manual specification or network
  let nonce: bigint;
  if (options.nonce !== undefined) {
    // Use manually specified nonce
    nonce = protoInt64.uParse(String(options.nonce));
    logger.warn('Manual nonce specified - skipping network nonce fetch. Nonce is not validated and incorrect value will cause transaction failure.', {
      operation: 'updateContract',
      nonce: String(options.nonce)
    });
  } else {
    // Fetch nonce from network
    const result = await getAddressAndNonce(options.publicKeyBase58Identifier, grpcConfig);
    nonce = result.nonce;
  }

  // Build base transaction
  const baseParams: {
    publicKeyId: string;
    nonce: bigint;
    memo?: string;
    feeId?: string;
    feeAmountParts?: string;
  } = {
    publicKeyId: options.publicKeyBase58Identifier,
    nonce
  };
  if (options.memo) baseParams.memo = options.memo;
  if (options.feeId !== undefined) baseParams.feeId = options.feeId;
  if (options.feeAmountParts !== undefined) baseParams.feeAmountParts = options.feeAmountParts;

  const base = buildStandardBaseTXN(baseParams);

  // Build contract update transaction
  const updateData: Partial<ContractUpdateTXN> = {
    base,
    contractId: options.contractId,
    contractVersion: options.contractVersion
  };

  // Add optional fields
  if (options.name) updateData.name = options.name;
  if (options.governance) updateData.governance = options.governance;
  if (options.restrictedKeys && options.restrictedKeys.length > 0) {
    updateData.restrictedKeys = options.restrictedKeys;
  }
  if (options.contractFees) updateData.contractFees = options.contractFees;
  if (options.customParameters && options.customParameters.length > 0) {
    updateData.customParameters = options.customParameters;
  }
  if (options.expenseRatio && options.expenseRatio.length > 0) {
    updateData.expenseRatio = options.expenseRatio;
  }
  if (options.tokenCompliance && options.tokenCompliance.length > 0) {
    updateData.tokenCompliance = options.tokenCompliance;
  }
  if (options.kycStatus !== undefined) updateData.kycStatus = options.kycStatus;
  if (options.immutableKycStatus !== undefined) {
    updateData.immutableKycStatus = options.immutableKycStatus;
  }
  if (options.quashThreshold !== undefined) {
    updateData.quashThreshold = options.quashThreshold;
  }

  const updateTxn = new ContractUpdateTXN(updateData);

  const effectiveFeeId = options.feeId || '$ZRA+0000';

  // Calculate fees using UniversalFeeCalculator (handles both auto and manual fees)
  // When baseFee is provided, calculateNetworkFee will use it directly and log the warning
  const feeOptions: FeeConfigHelper<ContractUpdateTXN> = {
    protoObject: updateTxn,
    tokenInfoMap: new Map(),
    baseFeeId: effectiveFeeId,
    ...(options.feeAmountParts !== undefined && { baseFee: options.feeAmountParts })
  };
  await UniversalFeeCalculator.calculateFee<ContractUpdateTXN>(feeOptions);

  // Sign + hash
  signStandardTXN(updateTxn, {
    privateKey: options.privateKeyBase58,
    publicKeyId: options.publicKeyBase58Identifier
  });
  addHash(updateTxn);

  return updateTxn;
}

/**
 * Sends a contract update transaction to the network.
 * 
 * @param update - The contract update transaction to submit
 * @param grpcConfig - Optional gRPC configuration for network communication
 * @returns Promise that resolves to the transaction hash
 * 
 * @example
 * ```typescript
 * const update = await updateContract({ ... });
 * const hash = await sendUpdateContract(update);
 * console.log('Contract updated with hash:', hash);
 * ```
 */
export async function sendUpdateContract(
  update: ContractUpdateTXN,
  grpcConfig: GRPCConfig = {}
): Promise<string> {
  const client = createTransactionClient(grpcConfig);
  await client.submitContractUpdate(update);
  return update.base?.hash 
    ? Array.from(update.base.hash).map(b => b.toString(16).padStart(2, '0')).join('') 
    : 'Contract update submitted (no hash available)';
}

