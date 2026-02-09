/**
 * Transaction Module - Governance VoteTXN
 *
 * Creates and submits GovernanceVote transactions. Unlike `CoinTXN`, vote
 * transactions use the standard BaseTXN structure (includes `public_key` and
 * `nonce`) and follow the regular sign-then-hash flow. No token fees apply
 * here, only base fees.
 */

import { protoInt64 } from '@bufbuild/protobuf';

import { GovernanceVote } from '../../proto/generated/txn_pb.js';
import { createTransactionClient } from '../grpc/transaction/transaction-client.js';
import { UniversalFeeCalculator, type FeeConfigHelper } from '../shared/fee-calculators/universal-fee-calculator.js';
import { logger } from '../shared/monitoring/index.js';
import { buildStandardBaseTXN, getAddressAndNonce } from '../shared/tx/base.js';
import { signStandardTXN, addHash } from '../shared/tx/signing.js';
import { hexToBytes, bytesToHex } from '../shared/utils/byte-utils.js';
import { MAINNET_GRPC_CONFIG } from '../shared/utils/testing-defaults/index.js';
import type { GRPCConfig } from '../types/index.js';

// createBaseForVote replaced by shared builder

/**
 * Options for creating a GovernanceVote transaction
 */
export interface CreateVoteTXNOptions {
  /** Whether to support the proposal (for binary yes/no votes) */
  support?: boolean;
  /** The option index to support (for multi-option votes) */
  supportOption?: number;
  /** Optional memo for the transaction */
  memo?: string;
  /** gRPC configuration for network communication */
  grpcConfig?: GRPCConfig;
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

/**
 * Create a GovernanceVote transaction
 */
export async function createVoteTXN(
  contractId: string,
  proposalIdHex: string,
  publicKeyBase58Identifier: string,
  privateKeyBase58: string,
  options: CreateVoteTXNOptions = {}
): Promise<GovernanceVote> {
  if (!contractId) throw new Error('contractId is required');
  if (!proposalIdHex) throw new Error('proposalId (hex) is required');
  if (!publicKeyBase58Identifier) throw new Error('publicKey identifier is required');
  if (!privateKeyBase58) throw new Error('privateKey is required');

  const grpcConfig = options.grpcConfig || MAINNET_GRPC_CONFIG;
  const feeId = options.feeId;
  const feeAmountParts = options.feeAmountParts;

  // Enforce exactly one of support or supportOption
  const hasSupport = typeof options.support === 'boolean';
  const hasSupportOption = typeof options.supportOption === 'number';
  if (hasSupport === hasSupportOption) {
    throw new Error('Specify exactly one of: support (boolean) OR supportOption (number)');
  }

  // Decode proposal ID from hex to bytes
  let proposalBytes: Uint8Array;
  try {
    if (!/^([0-9a-fA-F]{2})+$/.test(proposalIdHex)) {
      throw new Error('Invalid hex');
    }
    proposalBytes = hexToBytes(proposalIdHex);
  } catch {
    throw new Error('Invalid proposalId: must be hex-encoded');
  }

  // Get nonce - either from manual specification or network
  let nonce: bigint;
  if (options.nonce !== undefined) {
    // Use manually specified nonce
    nonce = protoInt64.uParse(String(options.nonce));
    logger.warn('Manual nonce specified - skipping network nonce fetch. Nonce is not validated and incorrect value will cause transaction failure.', {
      operation: 'createVoteTXN',
      nonce: String(options.nonce)
    });
  } else {
    // Fetch nonce from network
    const result = await getAddressAndNonce(publicKeyBase58Identifier, grpcConfig);
    nonce = result.nonce;
  }

  // Build base
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

  // Construct vote txn
  const voteData: Partial<GovernanceVote> = {
    base,
    contractId,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    proposalId: proposalBytes as any
  };
  if (hasSupport && options.support !== undefined) {
    voteData.support = options.support;
  }
  if (hasSupportOption && options.supportOption !== undefined) {
    voteData.supportOption = options.supportOption;
  }

  const voteTxn = new GovernanceVote(voteData);

  const effectiveFeeId = feeId || '$ZRA+0000';

  // Calculate fees using UniversalFeeCalculator (handles both auto and manual fees)
  // When baseFee is provided, calculateNetworkFee will use it directly and log the warning
  const feeOptions: FeeConfigHelper<GovernanceVote> = {
    contractId,
    protoObject: voteTxn,
    tokenInfoMap: new Map(),
    baseFeeId: effectiveFeeId,
    ...(feeAmountParts !== undefined && { baseFee: feeAmountParts }),
    ...(options.overestimatePercent !== undefined && { overestimatePercent: options.overestimatePercent })
  };
  await UniversalFeeCalculator.calculateFee<GovernanceVote>(feeOptions);

  // Sign and add hash using shared helpers
  signStandardTXN(voteTxn, { privateKey: privateKeyBase58, publicKeyId: publicKeyBase58Identifier });
  addHash(voteTxn);

  return voteTxn;
}

/**
 * Submit a GovernanceVote to the network via gRPC.
 */
export async function sendVoteTXN(vote: GovernanceVote, grpcConfig: GRPCConfig = {}): Promise<string> {
  const client = createTransactionClient(grpcConfig);
  await client.submitGovernanceVote(vote);
  return vote.base?.hash ? bytesToHex(vote.base.hash) : 'Vote submitted (no hash available)';
}



