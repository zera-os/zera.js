/**
 * Smart Contract Execute Transaction
 *
 * This module provides functionality for executing smart contract functions (SmartContractExecuteTXN).
 */

import { protoInt64 } from '@bufbuild/protobuf';

import { SmartContractExecuteTXN, Parameters } from '../../../proto/generated/txn_pb.js';
import { validateKeyPair } from '../../contract/shared/utils.js';
import { createTransactionClient } from '../../grpc/transaction/transaction-client.js';
import { UniversalFeeCalculator, type FeeConfigHelper } from '../../shared/fee-calculators/universal-fee-calculator.js';
import { logger } from '../../shared/monitoring/index.js';
import { buildStandardBaseTXN, getAddressAndNonce } from '../../shared/tx/base.js';
import { signStandardTXN, addHash } from '../../shared/tx/signing.js';
import { MAINNET_GRPC_CONFIG } from '../../shared/utils/testing-defaults/index.js';
import type { GRPCConfig } from '../../types/index.js';

/**
 * Valid parameter types for smart contract execution.
 * Only these types are supported by the network.
 */
export type ParameterType =
  | 'bytes'
  | 'uint32'
  | 'uint64'
  | 'string';

/**
 * Helper constants for parameter types.
 * Use these for autocomplete and type safety.
 */
export const ParamType = {
  BYTES: 'bytes' as const,
  UINT32: 'uint32' as const,
  UINT64: 'uint64' as const,
  STRING: 'string' as const
} as const;

/**
 * Parameter for smart contract function execution
 */
export type ExecuteParameter = {
  /**
   * Type of the parameter. Valid types are: 'bytes', 'uint32', 'uint64', 'string'.
   * Use ParamType constants for autocomplete and type safety.
   */
  type: ParameterType | string;
  /**
   * Value of the parameter. Type conversion is handled automatically based on the type.
   */
  value: string | Uint8Array | number | boolean;
};

/**
 * Options for creating a SmartContractExecute transaction
 */
export interface CreateSmartContractExecuteOptions {
  /** Optional memo for the transaction */
  memo?: string;
  /** gRPC configuration for network communication */
  grpcConfig?: GRPCConfig;
  /** Gas fee in USD for computational cost (e.g., 0.05 for 5 cents) */
  gasFeeInUsd?: number;
  /**
   * Overestimate percentage to add to final fee (defaults to 5.0%).
   * Supports decimal values (e.g., 0.1 for 0.1%, 5.0 for 5.0%).
   * This is the MAXIMUM overestimate - the network will only take the correct amount.
   * Specify 0% if you do not want any overestimate buffer.
   */
  overestimatePercent?: number;
  /**
   * Optional nonce override. When provided, skips network nonce fetch.
   * WARNING: Manually specified nonces are not validated. Incorrect nonces will cause transaction failure.
   */
  nonce?: string | number | bigint;
  /**
   * Optional fee ID (defaults to '$ZRA+0000').
   */
  feeId?: string;
  /**
   * Optional fee amount in parts. When provided, skips fee calculation.
   * WARNING: Manually specified fees are not validated and used exactly as provided (no overestimation).
   */
  feeAmountParts?: string;
}

function toBytes(value: string | Uint8Array | number | boolean): Uint8Array<ArrayBuffer> {
  if (value instanceof Uint8Array) return value as unknown as Uint8Array<ArrayBuffer>;
  if (typeof value === 'string') return new Uint8Array(new TextEncoder().encode(value)) as unknown as Uint8Array<ArrayBuffer>;
  if (typeof value === 'number') return new Uint8Array(new TextEncoder().encode(value.toString())) as unknown as Uint8Array<ArrayBuffer>;
  if (typeof value === 'boolean') return new Uint8Array(new TextEncoder().encode(value ? '1' : '0')) as unknown as Uint8Array<ArrayBuffer>;
  return new Uint8Array() as unknown as Uint8Array<ArrayBuffer>;
}

// Helper to create typed parameters
function createParameters(value: string | number | boolean | Uint8Array, type: string): Parameters {
  return new Parameters({
    value: toBytes(value),
    type
  });
}

/**
 * Create a SmartContractExecute transaction
 */
export async function createSmartContractExecuteTXN(
  smartContractName: string,
  instance: number,
  functionName: string,
  parameters: ExecuteParameter[],
  publicKeyBase58Identifier: string,
  privateKeyBase58: string,
  options: CreateSmartContractExecuteOptions = {}
): Promise<SmartContractExecuteTXN> {
  if (!smartContractName) throw new Error('smartContractName is required');
  if (!functionName) throw new Error('functionName is required');
  if (!publicKeyBase58Identifier) throw new Error('publicKeyBase58Identifier is required');
  if (!privateKeyBase58) throw new Error('privateKeyBase58 is required');

  validateKeyPair({
    publicKeyBase58Identifier,
    privateKeyBase58
  });

  const grpcConfig = options.grpcConfig || MAINNET_GRPC_CONFIG;
  const feeId = options.feeId;
  const feeAmountParts = options.feeAmountParts;

  // Get nonce - either from manual specification or network
  let nonce: bigint;
  if (options.nonce !== undefined) {
    // Use manually specified nonce
    nonce = protoInt64.uParse(String(options.nonce));
    logger.warn('Manual nonce specified - skipping network nonce fetch. Nonce is not validated and incorrect value will cause transaction failure.', {
      operation: 'createSmartContractExecuteTXN',
      nonce: String(options.nonce)
    });
  } else {
    // Fetch nonce from network
    const result = await getAddressAndNonce(publicKeyBase58Identifier, grpcConfig);
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
    publicKeyId: publicKeyBase58Identifier,
    nonce
  };
  if (options.memo) baseParams.memo = options.memo;
  if (feeId !== undefined) baseParams.feeId = feeId;
  if (feeAmountParts !== undefined) baseParams.feeAmountParts = feeAmountParts;

  const base = buildStandardBaseTXN(baseParams);

  // Convert parameters to protobuf format
  const protoParameters = parameters.map((p: ExecuteParameter) => createParameters(p.value, p.type));

  // Build execute transaction
  const executeData: Partial<SmartContractExecuteTXN> = {
    base,
    smartContractName,
    function: functionName,
    instance: instance || 0,
    parameters: protoParameters
  };

  const executeTxn = new SmartContractExecuteTXN(executeData);

  const effectiveFeeId = feeId || '$ZRA+0000';

  // Calculate fees using UniversalFeeCalculator (handles both auto and manual fees)
  // When baseFee is provided, calculateNetworkFee will use it directly and log the warning
  const feeOptions: FeeConfigHelper<SmartContractExecuteTXN> = {
    protoObject: executeTxn,
    tokenInfoMap: new Map(),
    baseFeeId: effectiveFeeId,
    grpcConfig,
    ...(feeAmountParts !== undefined && { baseFee: feeAmountParts }),
    ...(options.gasFeeInUsd !== undefined && { gasFeeInUsd: options.gasFeeInUsd }),
    ...(options.overestimatePercent !== undefined && { overestimatePercent: options.overestimatePercent })
  };
  await UniversalFeeCalculator.calculateFee<SmartContractExecuteTXN>(feeOptions);

  // Sign + hash
  signStandardTXN(executeTxn, {
    privateKey: privateKeyBase58,
    publicKeyId: publicKeyBase58Identifier
  });
  addHash(executeTxn);

  return executeTxn;
}

export async function sendSmartContractExecuteTXN(txn: SmartContractExecuteTXN, grpcConfig: GRPCConfig = {}): Promise<string> {
  const client = createTransactionClient(grpcConfig);
  await client.submitSmartContractExecute(txn);
  return txn.base?.hash 
    ? Array.from(txn.base.hash).map(b => b.toString(16).padStart(2, '0')).join('') 
    : 'SmartContractExecute submitted (no hash available)';
}
