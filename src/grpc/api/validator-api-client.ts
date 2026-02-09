import type { PromiseClient } from '@connectrpc/connect';

import { APIService } from '../../../proto/generated/api_connect.js';
import type { TokenFeeInfoResponse, NonceResponse, BalanceResponse, BaseFeeResponse } from '../../../proto/generated/api_pb.js';
import { NonceRequest, TokenFeeInfoRequest, BalanceRequest, BaseFeeRequest } from '../../../proto/generated/api_pb.js';
import type { PublicKey } from '../../../proto/generated/txn_pb.js';
import { TRANSACTION_TYPE } from '../../../proto/generated/txn_pb.js';
import { sanitizeAndDecodeAddress } from '../../shared/crypto/address-utils.js';
import type { GRPCConfig } from '../../types/index.js';
import { createClient } from '../client-factory.js';

/**
 * Validator API client interface
 */
export interface ValidatorAPIClient {
  /**
   * Get nonce for an address
   */
  getNonce(address: string): Promise<NonceResponse>;
    
  /**
   * Get comprehensive token fee information
   */
  getTokenFeeInfo(request: { contractIds: string[] }): Promise<TokenFeeInfoResponse>;
  
  /**
   * Get balance for an address and contract ID
   */
  getBalance(address: string, contractId: string): Promise<BalanceResponse>;

  /**
   * Get base fee info for a transaction type and public key
   */
  getBaseFee(publicKey: PublicKey | undefined, txnType: TRANSACTION_TYPE): Promise<BaseFeeResponse>;
}

/**
 * Validator API Client Class
 */
class ValidatorAPIClientImpl implements ValidatorAPIClient {
  private client: PromiseClient<typeof APIService>;

  constructor(options: GRPCConfig = {}) {
    const config = { ...options };
    this.client = createClient(APIService, config);
  }

  /**
   * Get nonce for an address
   */
  async getNonce(address: string): Promise<NonceResponse> {
    const request = new NonceRequest({
      walletAddress: new Uint8Array(sanitizeAndDecodeAddress(address)), // Convert base58 to bytes
      encoded: false // Decode on local side for marginally faster processing
    });
    return this.client.nonce(request);
  }

  /**
   * Get comprehensive token fee information
   */
  async getTokenFeeInfo(request: { contractIds: string[] }): Promise<TokenFeeInfoResponse> {
    const protoRequest = new TokenFeeInfoRequest({
      contractIds: request.contractIds
    });
    return this.client.getTokenFeeInfo(protoRequest);
  }

  /**
   * Get balance for an address and contract ID
   */
  async getBalance(address: string, contractId: string): Promise<BalanceResponse> {
    const request = new BalanceRequest({
      walletAddress: new Uint8Array(sanitizeAndDecodeAddress(address)), // Convert base58 to bytes
      contractId: contractId,
      encoded: false // Decode on local side for marginally faster processing
    });
    return this.client.balance(request);
  }

  /**
   * Get base fee info for a transaction type and public key
   */
  async getBaseFee(publicKey: PublicKey | undefined, txnType: TRANSACTION_TYPE): Promise<BaseFeeResponse> {
    const request = new BaseFeeRequest({
      ...(publicKey ? { publicKey } : {}),
      txnType: txnType
    });
    return this.client.baseFee(request);
  }
}

/**
 * Create a pre-configured validator API client
 */
export function createValidatorAPIClient(options: GRPCConfig = {}): ValidatorAPIClient {
  return new ValidatorAPIClientImpl(options);
}
