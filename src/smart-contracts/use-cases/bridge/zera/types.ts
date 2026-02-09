/**
 * ZERA Bridge Transaction Types
 * 
 * Type definitions for all ZERA-side bridge operations.
 */

import type { ZeraPayload } from '../../../../../proto/generated/guardian_pb.js';
import type { SmartContractExecuteTXN } from '../../../../../proto/generated/txn_pb.js';
import type { GRPCConfig } from '../../../../types/index.js';
import type { CreateSmartContractExecuteOptions } from '../../../execute/index.js';

// ============================================================================
// BASE OPTIONS
// ============================================================================

/**
 * Base options for all ZERA bridge transactions
 */
export interface BridgeZeraOptions extends Omit<CreateSmartContractExecuteOptions, 'feeId' | 'feeAmountParts'> {
  /** gRPC configuration for network communication */
  grpcConfig?: GRPCConfig;
  /** Optional fee ID (defaults to the token being bridged) */
  feeId?: string;
  /** Optional fee amount in USD (skips auto-calculation if provided) */
  feeAmountUsd?: string;
}

// ============================================================================
// LOCK OPTIONS (ZERA → Solana)
// ============================================================================

/**
 * Options for lockZera (lock ZERA tokens to bridge to Solana)
 * @deprecated Use BridgeZeraOptions instead
 */
export type BridgeZeraToSolOptions = BridgeZeraOptions;

/**
 * Options for burning wrapped SOL tokens on ZERA
 */
export interface BurnSolOptions extends BridgeZeraOptions {
  /** Token denomination for amount conversion (e.g., 'SOL', 'USDC') */
  denomination?: string;
}

// ============================================================================
// RELEASE OPTIONS (Solana → ZERA)
// ============================================================================

/**
 * Options for releasing ZERA tokens (from Solana lock)
 */
export interface ReleaseZeraOptions extends BridgeZeraOptions {
  /** Guardian-signed payload from the Guardian service */
  payload: ZeraPayload;
}

/**
 * Options for minting wrapped SOL on ZERA
 */
export interface MintSolOptions extends BridgeZeraOptions {
  /** Guardian-signed payload from the Guardian service */
  payload: ZeraPayload;
}

/**
 * Options for creating wrapped SOL token on ZERA (first time)
 */
export interface CreateSolOptions extends BridgeZeraOptions {
  /** Guardian-signed payload from the Guardian service */
  payload: ZeraPayload;
}

// ============================================================================
// RESULT TYPES
// ============================================================================

/**
 * Result from lock operations
 */
export interface LockZeraResult {
  /** The created transaction */
  transaction: SmartContractExecuteTXN;
}

/**
 * Result from release operations
 */
export interface ReleaseZeraResult {
  /** The created transaction */
  transaction: SmartContractExecuteTXN;
}

/**
 * Result from mint operations
 */
export interface MintSolResult {
  /** The created transaction */
  transaction: SmartContractExecuteTXN;
}

/**
 * Result from create operations
 */
export interface CreateSolResult {
  /** The created transaction */
  transaction: SmartContractExecuteTXN;
}

/**
 * Result from burn operations
 */
export interface BurnSolResult {
  /** The created transaction */
  transaction: SmartContractExecuteTXN;
}
