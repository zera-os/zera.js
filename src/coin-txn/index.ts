/**
 * CoinTXN Module - Main Entry Point
 * 
 * This module provides functionality for creating and sending CoinTXN transactions
 * on the ZERA Network with automatic fee calculation and various validation.
 */

// Re-export main functions
export { createCoinTXN, sendCoinTXN } from './transaction.js';

// Re-export types
export type { CoinTXNInput, CoinTXNOutput, GRPCConfig } from '../types/index.js';
