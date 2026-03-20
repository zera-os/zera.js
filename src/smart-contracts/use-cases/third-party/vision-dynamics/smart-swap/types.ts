/**
 * Smart Swap Types
 * 
 * Type definitions for indexer-powered swap operations via the
 * Vision Dynamics Indexer API's `/v1/dex/swap` endpoint.
 */

import type { GRPCConfig } from '../../../../../types/index.js';

// ============================================================================
// BASE OPTIONS
// ============================================================================

/**
 * Options for Smart Swap operations
 */
export interface SmartSwapOptions {
  /** gRPC configuration for transaction submission */
  grpcConfig?: GRPCConfig;
}

// ============================================================================
// QUOTE (MODE 1)
// ============================================================================

/**
 * Parameters for requesting a swap quote (Mode 1)
 * 
 * No keys required — just provide the token pair and amount.
 */
export interface QuoteParams {
  /** Input token contract ID (e.g., '$LEET+1337') */
  tokenIn: string;
  /** Output token contract ID (e.g., '$sol-SOL+000000') */
  tokenOut: string;
  /** Input amount in smallest denomination (raw units) */
  amountIn: number;
  /** Optional platform fee in basis points (e.g., 75 = 0.75%) */
  platformFeeBps?: number;
  /** Optional address to receive platform fees */
  platformFeeAddress?: string;
}

// ============================================================================
// SWAP (MODE 2 — DIRECT BUILD)
// ============================================================================

/**
 * Parameters for building a swap transaction in one shot (Mode 2)
 * 
 * Combines quoting and transaction building into a single API call.
 */
export interface SwapParams {
  /** Input token contract ID */
  tokenIn: string;
  /** Output token contract ID */
  tokenOut: string;
  /** Input amount in smallest denomination (raw units) */
  amountIn: number;
  /** Minimum acceptable output amount (slippage protection). Use '0' to disable. */
  minAmountOut: string;
  /** Token used to pay network transaction fees (e.g., '$ZRA+0000') */
  feeContractID: string;
  /** Optional platform fee in basis points */
  platformFeeBps?: number;
  /** Optional address to receive platform fees */
  platformFeeAddress?: string;
}

// ============================================================================
// SWAP FROM STAGES (MODE 3)
// ============================================================================

/**
 * Parameters for building a swap from previously-fetched stages (Mode 3)
 * 
 * Two-step flow: get a quote first, then pass the stages back
 * to build the transaction without re-computing the route.
 */
export interface SwapFromStagesParams {
  /** Input token contract ID */
  tokenIn: string;
  /** Output token contract ID */
  tokenOut: string;
  /** Input amount in smallest denomination (raw units) */
  amountIn: number;
  /** Minimum acceptable output amount (slippage protection) */
  minAmountOut: string;
  /** Token used to pay network transaction fees */
  feeContractID: string;
  /** Route stages from a previous getQuote() call */
  stages: unknown[];
}
