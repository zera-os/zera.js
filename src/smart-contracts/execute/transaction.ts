/**
 * Smart Contract Execute Transaction
 *
 * Creates, builds, and submits SmartContractExecuteTXN transactions.
 *
 * `buildSmartContractExecuteTXN()` constructs an unsigned transaction (no private keys needed).
 * `createSmartContractExecuteTXN()` is a convenience wrapper: build + sign with private key.
 */

import { protoInt64 } from '@bufbuild/protobuf';

import { SmartContractExecuteTXN, Parameters } from '../../../proto/generated/txn_pb.js';
import { validateKeyPair } from '../../contract/shared/utils.js';
import { createTransactionClient } from '../../grpc/transaction/transaction-client.js';
import { signWithKey } from '../../sign/finalize.js';
import { UniversalFeeCalculator, type FeeConfigHelper } from '../../shared/fee-calculators/universal-fee-calculator.js';
import { logger } from '../../shared/monitoring/index.js';
import { generateAddressFromPublicKey } from '../../shared/crypto/address-utils.js';
import { buildStandardBaseTXN, getAddressAndNonce } from '../../shared/tx/base.js';
import { MAINNET_GRPC_CONFIG } from '../../shared/utils/testing-defaults/index.js';
import type { GRPCConfig } from '../../types/index.js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Valid parameter types for smart contract execution.
 */
export type ParameterType =
  | 'bytes'
  | 'uint32'
  | 'uint64'
  | 'string';

/**
 * Helper constants for parameter types.
 */
export const ParamType = {
  BYTES: 'bytes' as const,
  UINT32: 'uint32' as const,
  UINT64: 'uint64' as const,
  STRING: 'string' as const
} as const;

/**
 * Parameter for smart contract function execution.
 */
export type ExecuteParameter = {
  type: ParameterType | string;
  value: string | Uint8Array | number | boolean;
};

/**
 * Options for creating a SmartContractExecute transaction.
 */
export interface CreateSmartContractExecuteOptions {
  memo?: string;
  grpcConfig?: GRPCConfig;
  gasFeeInUsd?: number;
  overestimatePercent?: number;
  nonce?: string | number | bigint;
  feeId?: string;
  feeAmountParts?: string;
}

/**
 * Options for building an unsigned SmartContractExecuteTXN.
 * Same as `CreateSmartContractExecuteOptions` but no private key is required.
 */
export interface BuildSmartContractExecuteOptions {
  /** Optional memo */
  memo?: string;
  /** gRPC configuration */
  grpcConfig?: GRPCConfig;
  /** Gas fee in USD */
  gasFeeInUsd?: number;
  /** Overestimate percentage for fee (defaults to 5.0%) */
  overestimatePercent?: number;
  /** Optional nonce override */
  nonce?: string | number | bigint;
  /** Fee ID (defaults to '$ZRA+0000') */
  feeId?: string;
  /** Manual fee amount in parts */
  feeAmountParts?: string;
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

function toBytes(value: string | Uint8Array | number | boolean): Uint8Array<ArrayBuffer> {
  if (value instanceof Uint8Array) return value as unknown as Uint8Array<ArrayBuffer>;
  if (typeof value === 'string') return new Uint8Array(new TextEncoder().encode(value)) as unknown as Uint8Array<ArrayBuffer>;
  if (typeof value === 'number') return new Uint8Array(new TextEncoder().encode(value.toString())) as unknown as Uint8Array<ArrayBuffer>;
  if (typeof value === 'boolean') return new Uint8Array(new TextEncoder().encode(value ? '1' : '0')) as unknown as Uint8Array<ArrayBuffer>;
  return new Uint8Array() as unknown as Uint8Array<ArrayBuffer>;
}

function toParameterBytes(value: string | Uint8Array | number | boolean): Uint8Array<ArrayBuffer> {
  return toBytes(value);
}

// ============================================================================
// PUBLIC API — BUILD UNSIGNED
// ============================================================================

/**
 * Build an unsigned SmartContractExecuteTXN transaction.
 *
 * Performs all validation, nonce fetching, and fee calculation but **stops before signing**.
 *
 * @param smartContractName - Name of the smart contract
 * @param instance - Instance number
 * @param functionName - Function to call
 * @param parameters - Function parameters
 * @param publicKeyBase58Identifier - Public key identifier (no private key needed)
 * @param options - Execution options (fees, nonce, etc.)
 * @returns An unsigned `SmartContractExecuteTXN` protobuf
 *
 * @example
 * ```typescript
 * const unsigned = await buildSmartContractExecuteTXN(
 *   'my_contract', 0, 'transfer',
 *   [{ type: 'string', value: 'hello' }],
 *   'ed25519:9Xk3...'
 * );
 * const signed = await signAndFinalize(unsigned, signer);
 * ```
 */
export async function buildSmartContractExecuteTXN(
  smartContractName: string,
  instance: number,
  functionName: string,
  parameters: ExecuteParameter[],
  publicKeyBase58Identifier: string,
  options: BuildSmartContractExecuteOptions = {}
): Promise<SmartContractExecuteTXN> {
  if (!smartContractName) throw new Error('smartContractName is required');
  if (!functionName) throw new Error('functionName is required');
  if (!publicKeyBase58Identifier) throw new Error('publicKeyBase58Identifier is required');
  generateAddressFromPublicKey(publicKeyBase58Identifier);

  const grpcConfig = options.grpcConfig || MAINNET_GRPC_CONFIG;
  const feeId = options.feeId;
  const feeAmountParts = options.feeAmountParts;

  let nonce: bigint;
  if (options.nonce !== undefined) {
    nonce = protoInt64.uParse(String(options.nonce));
    logger.warn('Manual nonce specified - skipping network nonce fetch.', { operation: 'buildSmartContractExecuteTXN', nonce: String(options.nonce) });
  } else {
    const result = await getAddressAndNonce(publicKeyBase58Identifier, grpcConfig);
    nonce = result.nonce;
  }

  const baseParams: { publicKeyId: string; nonce: bigint; memo?: string; feeId?: string; feeAmountParts?: string } = { publicKeyId: publicKeyBase58Identifier, nonce };
  if (options.memo) baseParams.memo = options.memo;
  if (feeId !== undefined) baseParams.feeId = feeId;
  if (feeAmountParts !== undefined) baseParams.feeAmountParts = feeAmountParts;
  const base = buildStandardBaseTXN(baseParams);

  const protoParameters = parameters.map((p: ExecuteParameter) => {
    const value = toParameterBytes(p.value);
    return new Parameters({ value, type: p.type });
  });

  const executeData: Partial<SmartContractExecuteTXN> = {
    base, smartContractName, function: functionName,
    instance: instance || 0, parameters: protoParameters
  };
  const executeTxn = new SmartContractExecuteTXN(executeData);
  const effectiveFeeId = feeId || '$ZRA+0000';

  const feeOptions: FeeConfigHelper<SmartContractExecuteTXN> = {
    protoObject: executeTxn, tokenInfoMap: new Map(), baseFeeId: effectiveFeeId, grpcConfig,
    ...(feeAmountParts !== undefined && { baseFee: feeAmountParts }),
    ...(options.gasFeeInUsd !== undefined && { gasFeeInUsd: options.gasFeeInUsd }),
    ...(options.overestimatePercent !== undefined && { overestimatePercent: options.overestimatePercent })
  };
  await UniversalFeeCalculator.calculateFee<SmartContractExecuteTXN>(feeOptions);

  return executeTxn;
}

// ============================================================================
// PUBLIC API — CONVENIENCE (build + sign)
// ============================================================================

/**
 * Create a SmartContractExecute transaction.
 *
 * Convenience wrapper: builds with `buildSmartContractExecuteTXN()` then signs with the provided private key.
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
  if (!privateKeyBase58) throw new Error('privateKeyBase58 is required');

  validateKeyPair({
    publicKeyBase58Identifier,
    privateKeyBase58
  });

  const executeTxn = await buildSmartContractExecuteTXN(
    smartContractName, instance, functionName, parameters,
    publicKeyBase58Identifier, options
  );

  signWithKey(executeTxn, privateKeyBase58, publicKeyBase58Identifier);

  return executeTxn;
}

// ============================================================================
// PUBLIC API — SEND
// ============================================================================

export async function sendSmartContractExecuteTXN(txn: SmartContractExecuteTXN, grpcConfig: GRPCConfig = {}): Promise<string> {
  const client = createTransactionClient(grpcConfig);
  await client.submitSmartContractExecute(txn);
  return txn.base?.hash
    ? Array.from(txn.base.hash).map(b => b.toString(16).padStart(2, '0')).join('')
    : 'SmartContractExecute submitted (no hash available)';
}
