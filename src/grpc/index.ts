import type { GRPCConfig } from '../types/index.js';

import { createValidatorAPIClient, type ValidatorAPIClient } from './api/validator-api-client.js';
import { createTransactionClient, type TransactionClient } from './transaction/transaction-client.js';

/**
 * gRPC Infrastructure Module
 * 
 * This module provides gRPC client infrastructure for the ZERA Network.
 * It includes generic clients, specific service clients, and utility functions.
 * All gRPC connections now default to mainnet.zerascan.io on port 443 (HTTPS)
 * with an automatic fallback to port 8080 (HTTP) if the primary connection fails.
 */

// Re-export main functions
export { createValidatorAPIClient } from './api/validator-api-client.js';
export { createTransactionClient } from './transaction/transaction-client.js';

/**
 * Create a gRPC client for validator API
 * @deprecated Use createValidatorAPIClient directly with GRPCConfig.
 * @param host - Optional host to connect to (defaults to mainnet.zerascan.io)
 * @param options - Optional GRPCConfig for more detailed configuration
 */
export function createValidatorClient(host: string = 'mainnet.zerascan.io', options: GRPCConfig = {}): ValidatorAPIClient {
  return createValidatorAPIClient({ host, ...options });
}

/**
 * Create a gRPC client for transaction services
 * @deprecated Use createTransactionClient directly with GRPCConfig.
 * @param host - Optional host to connect to (defaults to mainnet.zerascan.io)
 * @param options - Optional GRPCConfig for more detailed configuration
 */
export function createTxnClient(host: string = 'mainnet.zerascan.io', options: GRPCConfig = {}): TransactionClient {
  return createTransactionClient({ host, ...options });
}

export default {
  createValidatorAPIClient,
  createTransactionClient,
  createValidatorClient,
  createTxnClient
};