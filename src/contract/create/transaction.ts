/**
 * Contract Creation Transaction
 *
 * This module provides functionality for creating new contracts (InstrumentContract) on the ZERA Network.
 */

import { protoInt64 } from '@bufbuild/protobuf';

import {
  InstrumentContract
} from '../../../proto/generated/txn_pb.js';
import { createTransactionClient } from '../../grpc/transaction/transaction-client.js';
import { UniversalFeeCalculator, type FeeConfigHelper } from '../../shared/fee-calculators/universal-fee-calculator.js';
import { logger } from '../../shared/monitoring/index.js';
import { buildStandardBaseTXN, getAddressAndNonce } from '../../shared/tx/base.js';
import { signStandardTXN, addHash } from '../../shared/tx/signing.js';
import { MAINNET_GRPC_CONFIG } from '../../shared/utils/testing-defaults/index.js';
import type { GRPCConfig } from '../../types/index.js';
import type { CreateContractOptions } from '../shared/types.js';
import { validateCreateContractOptions, validateKeyPair, validatePremintWallets } from '../shared/utils.js';

/**
 * Creates a new contract (InstrumentContract) transaction.
 * 
 * This function handles the complete contract creation process including:
 * - Input validation
 * - Nonce retrieval from the network
 * - Automatic fee calculation (if not provided)
 * - Transaction signing
 * - Hash generation
 * 
 * @param options - Contract creation options including contract details, keys, and configuration
 * @returns Promise that resolves to a complete InstrumentContract ready for submission
 * 
 * @example
 * ```typescript
 * const contract = await createContract({
 *   contractVersion: BigInt(0),
 *   symbol: 'MYTOKEN',
 *   name: 'My Token',
 *   type: 0, // TOKEN
 *   contractId: '$MYT+0000',
 *   publicKeyBase58Identifier: 'your-public-key',
 *   privateKeyBase58: 'your-private-key'
 * });
 * ```
 * 
 * @throws {Error} When required parameters are missing or invalid
 * @throws {NetworkError} When network communication fails
 * @throws {CryptoError} When cryptographic operations fail
 * 
 * @since 1.0.0
 */
export async function createContract(
  options: CreateContractOptions
): Promise<InstrumentContract> {
  // Validate required parameters
  validateCreateContractOptions({
    contractId: options.contractId,
    symbol: options.symbol,
    name: options.name,
    contractVersion: options.contractVersion,
    type: options.type
  });

  validateKeyPair({
    publicKeyBase58Identifier: options.publicKeyBase58Identifier,
    privateKeyBase58: options.privateKeyBase58
  });

  // Validate that premint wallets are only used with TOKEN type
  if (options.premintWallets) {
    validatePremintWallets({
      contractType: options.type,
      premintWallets: options.premintWallets
    });
  }

  const grpcConfig = options.grpcConfig || MAINNET_GRPC_CONFIG;

  // Get nonce - either from manual specification or network
  let nonce: bigint;
  if (options.nonce !== undefined) {
    // Use manually specified nonce
    nonce = protoInt64.uParse(String(options.nonce));
    logger.warn('Manual nonce specified - skipping network nonce fetch. Nonce is not validated and incorrect value will cause transaction failure.', {
      operation: 'createContract',
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

  // Build contract transaction
  const contractData: Partial<InstrumentContract> = {
    base,
    contractVersion: options.contractVersion,
    symbol: options.symbol,
    name: options.name,
    type: options.type,
    contractId: options.contractId,
    updateContractFees: options.updateContractFees ?? false,
    updateExpenseRatio: options.updateExpenseRatio ?? false,
    kycStatus: options.kycStatus ?? false,
    immutableKycStatus: options.immutableKycStatus ?? false
  };

  // Add optional fields
  if (options.governance) contractData.governance = options.governance;
  if (options.restrictedKeys && options.restrictedKeys.length > 0) {
    contractData.restrictedKeys = options.restrictedKeys;
  }
  if (options.maxSupply) contractData.maxSupply = options.maxSupply;
  if (options.contractFees) contractData.contractFees = options.contractFees;
  if (options.premintWallets && options.premintWallets.length > 0) {
    contractData.premintWallets = options.premintWallets;
  }
  contractData.coinDenomination = options.coinDenomination; // Always required
  if (options.customParameters && options.customParameters.length > 0) {
    contractData.customParameters = options.customParameters;
  }
  if (options.expenseRatio && options.expenseRatio.length > 0) {
    contractData.expenseRatio = options.expenseRatio;
  }
  if (options.quashThreshold !== undefined) {
    contractData.quashThreshold = options.quashThreshold;
  }
  if (options.tokenCompliance && options.tokenCompliance.length > 0) {
    contractData.tokenCompliance = options.tokenCompliance;
  }
  if (options.maxSupplyRelease && options.maxSupplyRelease.length > 0) {
    contractData.maxSupplyRelease = options.maxSupplyRelease;
  }

  const contractTxn = new InstrumentContract(contractData);

  const effectiveFeeId = options.feeId || '$ZRA+0000';

  // Calculate fees using UniversalFeeCalculator (handles both auto and manual fees)
  // When baseFee is provided, calculateNetworkFee will use it directly and log the warning
  const feeOptions: FeeConfigHelper<InstrumentContract> = {
    protoObject: contractTxn,
    tokenInfoMap: new Map(),
    baseFeeId: effectiveFeeId,
    ...(options.feeAmountParts !== undefined && { baseFee: options.feeAmountParts })
  };
  await UniversalFeeCalculator.calculateFee<InstrumentContract>(feeOptions);

  // Sign + hash
  signStandardTXN(contractTxn, {
    privateKey: options.privateKeyBase58,
    publicKeyId: options.publicKeyBase58Identifier
  });
  addHash(contractTxn);

  return contractTxn;
}

/**
 * Sends a contract creation transaction to the network.
 * 
 * @param contract - The contract transaction to submit
 * @param grpcConfig - Optional gRPC configuration for network communication
 * @returns Promise that resolves to the transaction hash
 * 
 * @example
 * ```typescript
 * const contract = await createContract({ ... });
 * const hash = await sendCreateContract(contract);
 * console.log('Contract created with hash:', hash);
 * ```
 */
export async function sendCreateContract(
  contract: InstrumentContract,
  grpcConfig: GRPCConfig = {}
): Promise<string> {
  const client = createTransactionClient(grpcConfig);
  await client.submitContract(contract);
  return contract.base?.hash 
    ? Array.from(contract.base.hash).map(b => b.toString(16).padStart(2, '0')).join('') 
    : 'Contract submitted (no hash available)';
}

