/**
 * Token Information Utilities
 * 
 * Provides clean, minimal access to comprehensive token information
 * including denomination, rates, authorization status, and contract fees.
 */

import type { TokenFeeInfoResponse } from '../../../proto/generated/api_pb.js';
import { getTokenFeeInfo as fetchTokenFeeInfo } from '../../api/handler/token-info/service.js';
import type { GRPCConfig } from '../../types/index.js';
import { logger } from '../monitoring/index.js';


/**
 * Re-export TokenFeeInfoResponse for direct usage
 */
export type { TokenFeeInfoResponse } from '../../../proto/generated/api_pb.js';

/**
 * Single token info result (for convenience functions)
 */
export type TokenInfo = TokenFeeInfoResponse['tokens'][0];

/**
 * Get comprehensive token information response
 * 
 * This function provides clean, minimal access to the full token fee information response.
 * Use this when you need the full response structure with all tokens.
 * 
 * @param contractIds - Array of contract IDs to get information for
 * @param options - Optional gRPC configuration
 * @returns Promise<TokenFeeInfoResponse> - Full token fee information response
 * 
 * @example
 * ```typescript
 * import { getTokenFeeInfo } from '@zera/sdk';
 * 
 * const response = await getTokenFeeInfo(['$ZRA+0000', '$BTC+1234']);
 * });
 * ```
 * 
 * @throws {NetworkError} When unable to fetch token information
 */
export async function getTokenFeeInfo(contractIds: string[], options: GRPCConfig = {}): Promise<TokenFeeInfoResponse> {
  if (!contractIds || contractIds.length === 0) {
    throw new Error('Contract IDs array is required and cannot be empty');
  }

  try {
    return await fetchTokenFeeInfo({
      contractIds,
      includeRates: true,
      includeContractFees: true
    }, options);
  } catch (error) {
    throw new Error(`Failed to get token fee information for contracts ${contractIds.join(', ')}: ${(error as Error).message}`);
  }
}

/**
 * Get token information for a single contract ID (simple version)
 * 
 * Convenience function that returns a single token from the response.
 * For multiple tokens, use the multi-parameter version.
 * 
 * @param contractId - Contract ID to get information for
 * @param options - Optional gRPC configuration
 * @returns Promise<TokenInfo> - Single token information
 * 
 * @example
 * ```typescript
 * import { getTokenInfoForSingle } from '@zera/sdk';
 * 
 * const tokenInfo = await getTokenInfoForSingle('$ZRA+0000');
 * ```
 */
export async function getTokenInfoForSingle(contractId: string, options: GRPCConfig = {}): Promise<TokenInfo> {
  if (!contractId) {
    throw new Error('Contract ID is required');
  }

  try {
    const response = await getTokenFeeInfo([contractId], options);
    const tokenInfo = response.tokens.find(t => t.contractId === contractId);
    
    if (!tokenInfo) {
      throw new Error(`Token information not found for contract ID: ${contractId}`);
    }

    return tokenInfo;
  } catch (error) {
    throw new Error(`Failed to get token information for ${contractId}: ${(error as Error).message}`);
  }
}

/**
 * Check if a token is supported/authorized
 * 
 * @param contractId - The contract ID to check
 * @param options - Optional gRPC configuration
 * @returns Promise<boolean> - Whether the token is supported
 */
export async function isTokenSupported(contractId: string, options: GRPCConfig = {}): Promise<boolean> {
  try {
    const tokenInfo = await getTokenInfoForSingle(contractId, options);
    return tokenInfo.authorized;
  } catch {
    return false;
  }
}

/**
 * Get only the denomination for a contract ID
 * 
 * @param contractId - The contract ID to get denomination for
 * @param options - Optional gRPC configuration
 * @returns Promise<string> - The denomination string
 */
export async function getTokenDenomination(contractId: string, options: GRPCConfig = {}): Promise<string> {
  try {
    const tokenInfo = await getTokenInfoForSingle(contractId, options);
    return tokenInfo.denomination;
  } catch (error) {
    throw new Error(`Failed to get denomination for ${contractId}: ${(error as Error).message}`);
  }
}

/**
 * Get only the exchange rate for a contract ID
 * 
 * @param contractId - The contract ID to get rate for
 * @param options - Optional gRPC configuration
 * @returns Promise<string> - The exchange rate (raw string from API)
 */
export async function getTokenRate(contractId: string, options: GRPCConfig = {}): Promise<string> {
  try {
    const tokenInfo = await getTokenInfoForSingle(contractId, options);
    return tokenInfo.rate;
  } catch (error) {
    throw new Error(`Failed to get exchange rate for ${contractId}: ${(error as Error).message}`);
  }
}

/**
 * Smart token info fetcher for contract IDs needed for a transaction
 * 
 * Only fetches the contract IDs that are actually needed based on the fee configuration.
 * Avoids unnecessary network calls by being smart about what information is required.
 * 
 * @param contractId - Main transaction contract ID (always required)
 * @param additionalContractIds - Additional contract IDs that may be needed (fee contracts, etc)
 * @param options - Optional gRPC configuration
 * @returns Promise with token info map for easy lookups
 */
export async function getTokenInfo(
  contractId: string,
  additionalContractIds: string[] = [],
  options: GRPCConfig = {}
): Promise<Map<string, TokenInfo>> {
  const contractIdsToFetch = new Set<string>();
  contractIdsToFetch.add(contractId); // Main contract is always needed
  
  // Add any additional contract IDs
  additionalContractIds.forEach(id => {
    if (id) {
      contractIdsToFetch.add(id);
    }
  });
  
  // Fetch all required token info in a single call
  const tokensResponse = await getTokenFeeInfo([...contractIdsToFetch], options);
  const tokenInfoMap = new Map<string, TokenInfo>();
  tokensResponse.tokens.forEach(token => {
    tokenInfoMap.set(token.contractId, token);
  });
  
  // Check for missing tokens and show consolidated warning
  const missingTokens: string[] = [];
  [...contractIdsToFetch].forEach(id => {
    if (!tokenInfoMap.has(id)) {
      missingTokens.push(id);
    }
  });
  
  if (missingTokens.length > 0) {
    logger.warn('Token info retrieval failed', {
      contractId,
      missingTokens,
      operation: 'getTokenInfo'
    });
  }
  
  return tokenInfoMap;
}
