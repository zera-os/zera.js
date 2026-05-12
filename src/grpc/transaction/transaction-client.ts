/**
 * Transaction Client
 * 
 * Pre-configured gRPC client for the ZERA transaction service.
 * 
 * Provides a universal `submitTransaction()` that auto-detects the protobuf
 * message type via `$typeName` and routes to the correct TXNService RPC method.
 */

import type { Message } from '@bufbuild/protobuf';
import type { Client } from '@connectrpc/connect';

import { TXNService } from '../../../proto/generated/txn_pb.js';
import type { 
  CoinTXN, 
  GovernanceVote, 
  SmartContractExecuteTXN, 
  InstrumentContract, 
  ContractUpdateTXN,
  ItemizedMintTXN,
  NFTTXN,
  BurnSBTTXN
} from '../../../proto/generated/txn_pb.js';
import type { GRPCConfig } from '../../types/index.js';
import { createClient } from '../client-factory.js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Any ZERA transaction protobuf message that can be submitted.
 * All protobuf-es messages satisfy this — CoinTXN, GovernanceVote, etc.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyZeraTransaction = Message<any>;

/**
 * Transaction client interface
 */
export interface TransactionClient {
  /**
   * Universal transaction submission.
   * Auto-detects the transaction type from `$typeName` and routes to the
   * correct TXNService RPC method.
   *
   * @param txn - Any ZERA transaction protobuf (CoinTXN, GovernanceVote, etc.)
   * @returns `{ success: true }` with optional `hash` if available
   * @throws Error if the transaction type is unknown
   *
   * @example
   * ```typescript
   * const client = createTransactionClient();
   * await client.submitTransaction(coinTxn);      // routes to TXNService.Coin
   * await client.submitTransaction(voteTxn);       // routes to TXNService.GovernVote
   * await client.submitTransaction(scExecuteTxn);  // routes to TXNService.SmartContractExecute
   * ```
   */
  submitTransaction(txn: AnyZeraTransaction): Promise<{ success: boolean; hash?: string }>;

  // Legacy specific methods (backward compatible)
  submitCoinTransaction(coinTxn: CoinTXN): Promise<{ success: boolean; hash?: string }>;
  submitGovernanceVote(vote: GovernanceVote): Promise<{ success: boolean }>;
  submitSmartContractExecute(txn: SmartContractExecuteTXN): Promise<{ success: boolean }>;
  submitContract(contract: InstrumentContract): Promise<{ success: boolean }>;
  submitContractUpdate(update: ContractUpdateTXN): Promise<{ success: boolean }>;
  submitItemizedMint(txn: ItemizedMintTXN): Promise<{ success: boolean }>;
  submitNFT(txn: NFTTXN): Promise<{ success: boolean }>;
  submitBurnSBT(txn: BurnSBTTXN): Promise<{ success: boolean }>;
}

// ============================================================================
// INTERNAL
// ============================================================================

/**
 * Maps protobuf `$typeName` → TXNService RPC method name.
 * 
 * All 19 TXNService methods are covered:
 *   Coin, Mint, ItemMint, Contract, GovernProposal, GovernVote,
 *   SmartContract, SmartContractExecute, SmartContractInstantiate,
 *   ExpenseRatio, NFT, ContractUpdate, DelegatedVoting, Quash,
 *   FastQuorum, Revoke, Compliance, BurnSBT, Allowance
 */
const TXN_TYPE_TO_RPC: Record<string, keyof Client<typeof TXNService>> = {
  'zera_txn.CoinTXN':                      'coin',
  'zera_txn.MintTXN':                      'mint',
  'zera_txn.ItemizedMintTXN':              'itemMint',
  'zera_txn.InstrumentContract':            'contract',
  'zera_txn.GovernanceProposal':            'governProposal',
  'zera_txn.GovernanceVote':                'governVote',
  'zera_txn.SmartContractTXN':              'smartContract',
  'zera_txn.SmartContractExecuteTXN':       'smartContractExecute',
  'zera_txn.SmartContractInstantiateTXN':   'smartContractInstantiate',
  'zera_txn.ExpenseRatioTXN':              'expenseRatio',
  'zera_txn.NFTTXN':                        'nFT',
  'zera_txn.ContractUpdateTXN':             'contractUpdate',
  'zera_txn.DelegatedTXN':                  'delegatedVoting',
  'zera_txn.QuashTXN':                      'quash',
  'zera_txn.FastQuorumTXN':                 'fastQuorum',
  'zera_txn.RevokeTXN':                     'revoke',
  'zera_txn.ComplianceTXN':                 'compliance',
  'zera_txn.BurnSBTTXN':                    'burnSBT',
  'zera_txn.AllowanceTXN':                  'allowance'
};

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ============================================================================
// IMPLEMENTATION
// ============================================================================

class TransactionClientImpl implements TransactionClient {
  private client: Client<typeof TXNService>;

  constructor(options: GRPCConfig = {}) {
    this.client = createClient(TXNService, { ...options });
  }

  /**
   * Universal transaction submission — auto-routes by $typeName.
   */
  async submitTransaction(txn: AnyZeraTransaction): Promise<{ success: boolean; hash?: string }> {
    const typeName = (txn as { $typeName: string }).$typeName;
    const rpcMethod = TXN_TYPE_TO_RPC[typeName];

    if (!rpcMethod) {
      const supported = Object.keys(TXN_TYPE_TO_RPC).join(', ');
      throw new Error(
        `Unknown transaction type: "${typeName}". ` +
        `Supported types: ${supported}`
      );
    }

    // All TXNService methods are unary with the same signature: (input) => Empty
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (this.client as any)[rpcMethod](txn);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const base = (txn as Record<string, any>).base;
    const hash = base?.hash instanceof Uint8Array ? toHex(base.hash) : undefined;
    return { success: true, ...(hash && { hash }) };
  }

  // Legacy methods — delegate to submitTransaction for consistency
  async submitCoinTransaction(coinTxn: CoinTXN): Promise<{ success: boolean; hash?: string }> {
    return this.submitTransaction(coinTxn);
  }

  async submitGovernanceVote(vote: GovernanceVote): Promise<{ success: boolean }> {
    return this.submitTransaction(vote);
  }

  async submitSmartContractExecute(txn: SmartContractExecuteTXN): Promise<{ success: boolean }> {
    return this.submitTransaction(txn);
  }

  async submitContract(contract: InstrumentContract): Promise<{ success: boolean }> {
    return this.submitTransaction(contract);
  }

  async submitContractUpdate(update: ContractUpdateTXN): Promise<{ success: boolean }> {
    return this.submitTransaction(update);
  }

  async submitItemizedMint(txn: ItemizedMintTXN): Promise<{ success: boolean }> {
    return this.submitTransaction(txn);
  }

  async submitNFT(txn: NFTTXN): Promise<{ success: boolean }> {
    return this.submitTransaction(txn);
  }

  async submitBurnSBT(txn: BurnSBTTXN): Promise<{ success: boolean }> {
    return this.submitTransaction(txn);
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Create a pre-configured transaction client.
 */
export function createTransactionClient(options: GRPCConfig = {}): TransactionClient {
  return new TransactionClientImpl(options);
}

/**
 * Universal transaction submission — standalone function.
 *
 * Creates a one-shot client and submits the transaction.
 * For repeated submissions, prefer `createTransactionClient()` and reuse it.
 *
 * @param txn - Any ZERA transaction protobuf message (CoinTXN, GovernanceVote, etc.)
 * @param grpcConfig - Optional gRPC configuration
 * @returns Transaction hash hex string, or a fallback message
 *
 * @example
 * ```typescript
 * import { submitTransaction } from '@zera-os/zera.js';
 *
 * const hash = await submitTransaction(coinTxn);
 * const hash2 = await submitTransaction(voteTxn);
 * const hash3 = await submitTransaction(scExecuteTxn);
 * ```
 */
export async function submitTransaction(
  txn: AnyZeraTransaction,
  grpcConfig: GRPCConfig = {}
): Promise<string> {
  const client = createTransactionClient(grpcConfig);
  const result = await client.submitTransaction(txn);
  return result.hash || 'Transaction submitted (no hash available)';
}
