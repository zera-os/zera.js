/**
 * ZERA Bridge Utilities
 * 
 * Helper functions for ZERA-side bridge operations.
 */

import type { ZeraPayload } from '../../../../../proto/generated/guardian_pb.js';
import { SmartContractExecuteTXN } from '../../../../../proto/generated/txn_pb.js';
import { MAINNET_GRPC_CONFIG } from '../../../../shared/utils/testing-defaults/index.js';
import { createSmartContractExecuteTXN, ParamType, type ExecuteParameter } from '../../../execute/index.js';

import type { BridgeZeraOptions } from './types.js';

// ============================================================================
// CONSTANTS
// ============================================================================

export const BRIDGE_CONTRACT_NAME = 'zera_bridge_proxy';
export const BRIDGE_INSTANCE = 1;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format guardian signatures for smart contract parameter
 * 
 * Converts the payload's signatures and public keys into the format
 * expected by the bridge_proxy smart contract.
 * 
 * @param payload - Guardian-signed payload
 * @returns Formatted signature string
 */
export function formatGuardianSignatures(payload: ZeraPayload): string {
  // Format: signedHash|sig1,pk1|sig2,pk2|...
  const sigPairs = payload.signatures.map((sig, i) => 
    `${sig},${payload.publicKeys[i] || ''}`
  ).join('|');
  
  return `${payload.signedHash}|${sigPairs}`;
}

/**
 * Create a bridge transaction with the given function and parameters
 * 
 * This is the core utility for building bridge_proxy transactions.
 * 
 * @param functionName - The bridge_proxy function to call
 * @param parameterValue - The formatted parameter string
 * @param publicKeyBase58Identifier - Public key of the sender
 * @param privateKeyBase58 - Private key of the sender
 * @param feeId - Fee token to use
 * @param options - Additional options
 * @returns The created transaction
 */
export async function createBridgeTransaction(
  functionName: string,
  parameterValue: string,
  publicKeyBase58Identifier: string,
  privateKeyBase58: string,
  feeId: string,
  options: BridgeZeraOptions
): Promise<SmartContractExecuteTXN> {
  const grpcConfig = options.grpcConfig || MAINNET_GRPC_CONFIG;
  
  const parameters: ExecuteParameter[] = [
    { type: ParamType.STRING, value: functionName },
    { type: ParamType.STRING, value: parameterValue }
  ];

  return createSmartContractExecuteTXN(
    BRIDGE_CONTRACT_NAME,
    BRIDGE_INSTANCE,
    'execute',
    parameters,
    publicKeyBase58Identifier,
    privateKeyBase58,
    {
      ...options,
      feeId,
      ...(options.feeAmountUsd !== undefined && { feeAmountParts: options.feeAmountUsd }),
      grpcConfig
    }
  );
}
