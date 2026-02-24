import { createValidatorAPIClient } from './api/validator-api-client.js';
import { createTransactionClient } from './transaction/transaction-client.js';

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

export default {
  createValidatorAPIClient,
  createTransactionClient
};