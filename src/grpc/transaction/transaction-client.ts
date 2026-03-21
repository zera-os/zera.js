/**
 * Transaction Client
 * 
 * Pre-configured gRPC client for the ZERA transaction service.
 * Minimal wrapper around the generic gRPC client.
 */

import type { Client } from '@connectrpc/connect';

import { TXNService } from '../../../proto/generated/txn_pb.js';
import type { 
  CoinTXN, 
  GovernanceVote, 
  SmartContractExecuteTXN, 
  InstrumentContract, 
  ContractUpdateTXN 
} from '../../../proto/generated/txn_pb.js';
import type { GRPCConfig } from '../../types/index.js';
import { createClient } from '../client-factory.js';

/**
 * Transaction client interface
 */
export interface TransactionClient {
  /**
   * Submit a coin transaction
   */
  submitCoinTransaction(coinTxn: CoinTXN): Promise<{ success: boolean; hash?: string }>;
  /**
   * Submit a governance vote transaction
   */
  submitGovernanceVote(vote: GovernanceVote): Promise<{ success: boolean }>;
  /**
   * Submit a smart contract execute transaction
   */
  submitSmartContractExecute(txn: SmartContractExecuteTXN): Promise<{ success: boolean }>;
  /**
   * Submit a contract creation transaction
   */
  submitContract(contract: InstrumentContract): Promise<{ success: boolean }>;
  /**
   * Submit a contract update transaction
   */
  submitContractUpdate(update: ContractUpdateTXN): Promise<{ success: boolean }>;
}

/**
 * Helper to convert Uint8Array to Hex
 */
function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Transaction Client Class
 */
class TransactionClientImpl implements TransactionClient {
  private client: Client<typeof TXNService>;

  constructor(options: GRPCConfig = {}) {
    const config = { ...options };
    this.client = createClient(TXNService, config);
  }

  /**
   * Submit a coin transaction
   */
  async submitCoinTransaction(coinTxn: CoinTXN): Promise<{ success: boolean; hash?: string }> {
    await this.client.coin(coinTxn);
    if (coinTxn.base?.hash) {
      return { success: true, hash: toHex(coinTxn.base.hash) };
    }
    return { success: true };
  }

  /**
   * Submit a governance vote transaction
   */
  async submitGovernanceVote(vote: GovernanceVote): Promise<{ success: boolean }> {
    await this.client.governVote(vote);
    return { success: true };
  }

  /**
   * Submit a smart contract execute transaction
   */
  async submitSmartContractExecute(txn: SmartContractExecuteTXN): Promise<{ success: boolean }> {
    await this.client.smartContractExecute(txn);
    return { success: true };
  }

  /**
   * Submit a contract creation transaction
   */
  async submitContract(contract: InstrumentContract): Promise<{ success: boolean }> {
    await this.client.contract(contract);
    return { success: true };
  }

  /**
   * Submit a contract update transaction
   */
  async submitContractUpdate(update: ContractUpdateTXN): Promise<{ success: boolean }> {
    await this.client.contractUpdate(update);
    return { success: true };
  }
}

/**
 * Create a pre-configured transaction client
 */
export function createTransactionClient(options: GRPCConfig = {}): TransactionClient {
  return new TransactionClientImpl(options);
}
