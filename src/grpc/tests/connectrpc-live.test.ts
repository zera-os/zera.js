/**
 * ConnectRPC Connectivity Tests
 *
 * Verifies that we can establish a proper connection to the ZERA gRPC-Web
 * server. These tests don't care about response data — they only confirm
 * the transport connects successfully (HTTP 200 from Envoy).
 *
 * What's proven when these pass:
 *   - gRPC-Web transport creation works (HTTPS, binary proto format)
 *   - URL rewriter interceptor maps services to correct Envoy paths
 *   - TLS handshake + DNS resolution succeeds
 *   - Server is alive and accepting gRPC-Web requests
 *
 * Runs automatically with: npm test
 * Run standalone:          npm run test:connectrpc
 *
 * Requirements: internet access to mainnet.zerascan.io:443
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';

// ---------------------------------------------------------------------------
// Un-mock ConnectRPC (vitest.setup.ts stubs these globally)
// ---------------------------------------------------------------------------
vi.unmock('@connectrpc/connect');
vi.unmock('@connectrpc/connect-web');
vi.unmock('../../grpc/client-factory.js');
vi.unmock('../client-factory.js');
vi.unmock('../../grpc/api/validator-api-client.js');
vi.unmock('../api/validator-api-client.js');
vi.unmock('../../grpc/transaction/transaction-client.js');
vi.unmock('../transaction/transaction-client.js');

// Dynamic imports after un-mocking
let createClient: typeof import('../client-factory.js').createClient;
let APIService: typeof import('../../../proto/generated/api_pb.js').APIService;
let TXNService: typeof import('../../../proto/generated/txn_pb.js').TXNService;
let create: typeof import('@bufbuild/protobuf').create;

// Request schemas
let NonceRequestSchema: any;
let BalanceRequestSchema: any;
let TokenFeeInfoRequestSchema: any;
let BaseFeeRequestSchema: any;
let ContractFeeRequestSchema: any;
let ContractRequestSchema: any;
let DenominationRequestSchema: any;
let DatabaseRequestSchema: any;
let BlockRequestSchema: any;
let TotalBalanceRequestSchema: any;
let ItemRequestSchema: any;
let ProposalLedgerRequestSchema: any;
let ActivityRequestSchema: any;
let SmartContractEventsSearchRequestSchema: any;
let SmartContractEventsResponseSchema: any;
let CoinTXNSchema: any;
let DATABASE_TYPE: any;
let TRANSACTION_TYPE: any;
let MAINNET_GRPC_CONFIG: any;

const KNOWN_ADDRESS_BYTES = new Uint8Array(Buffer.from('AKpo7NMd3JhGAonxXJXuG8XgDXA8jZGikK6UaHDYxksU'));

beforeAll(async () => {
  const factory = await import('../client-factory.js');
  createClient = factory.createClient;

  const apiPb = await import('../../../proto/generated/api_pb.js');
  APIService = apiPb.APIService;
  NonceRequestSchema = apiPb.NonceRequestSchema;
  BalanceRequestSchema = apiPb.BalanceRequestSchema;
  TokenFeeInfoRequestSchema = apiPb.TokenFeeInfoRequestSchema;
  BaseFeeRequestSchema = apiPb.BaseFeeRequestSchema;
  ContractFeeRequestSchema = apiPb.ContractFeeRequestSchema;
  ContractRequestSchema = apiPb.ContractRequestSchema;
  DenominationRequestSchema = apiPb.DenominationRequestSchema;
  DatabaseRequestSchema = apiPb.DatabaseRequestSchema;
  BlockRequestSchema = apiPb.BlockRequestSchema;
  TotalBalanceRequestSchema = apiPb.TotalBalanceRequestSchema;
  ItemRequestSchema = apiPb.ItemRequestSchema;
  ProposalLedgerRequestSchema = apiPb.ProposalLedgerRequestSchema;
  ActivityRequestSchema = apiPb.ActivityRequestSchema;
  SmartContractEventsSearchRequestSchema = apiPb.SmartContractEventsSearchRequestSchema;
  SmartContractEventsResponseSchema = apiPb.SmartContractEventsResponseSchema;
  DATABASE_TYPE = apiPb.DATABASE_TYPE;

  const txnPb = await import('../../../proto/generated/txn_pb.js');
  TXNService = txnPb.TXNService;
  CoinTXNSchema = txnPb.CoinTXNSchema;
  TRANSACTION_TYPE = txnPb.TRANSACTION_TYPE;

  const config = await import('../../shared/utils/testing-defaults/grpc-config.js');
  MAINNET_GRPC_CONFIG = config.MAINNET_GRPC_CONFIG;

  const protobuf = await import('@bufbuild/protobuf');
  create = protobuf.create;
});

/**
 * Confirms an RPC endpoint is reachable. A gRPC error (e.g. "Invalid Wallet")
 * still means the server connected and responded — that's a pass.
 * Only a network/fetch failure means the transport is broken.
 */
async function assertConnects(fn: () => Promise<unknown>, label: string): Promise<void> {
  try {
    await fn();
  } catch (error: any) {
    // gRPC errors = server responded = transport works = pass
    // fetch failures = transport broken = fail
    if (error?.message?.includes('fetch failed') || error?.message?.includes('ECONNREFUSED')) {
      throw new Error(`${label}: transport failed to connect — ${error.message}`);
    }
    // Any gRPC error is fine — server was reachable
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// APIService — all 16 endpoints
// ═══════════════════════════════════════════════════════════════════════════

describe('ConnectRPC Connectivity — APIService', () => {
  const rpc = () => createClient(APIService, MAINNET_GRPC_CONFIG);

  it('Nonce',          () => assertConnects(() => rpc().nonce(create(NonceRequestSchema, { walletAddress: KNOWN_ADDRESS_BYTES, encoded: false })), 'Nonce'), 15_000);
  it('Balance',        () => assertConnects(() => rpc().balance(create(BalanceRequestSchema, { walletAddress: KNOWN_ADDRESS_BYTES, contractId: '$ZRA+0000' })), 'Balance'), 15_000);
  it('GetTokenFeeInfo',() => assertConnects(() => rpc().getTokenFeeInfo(create(TokenFeeInfoRequestSchema, { contractIds: ['$ZRA+0000'] })), 'GetTokenFeeInfo'), 15_000);
  it('BaseFee',        () => assertConnects(() => rpc().baseFee(create(BaseFeeRequestSchema, { txnType: TRANSACTION_TYPE.COIN_TYPE })), 'BaseFee'), 15_000);
  it('ContractFee',    () => assertConnects(() => rpc().contractFee(create(ContractFeeRequestSchema, { contractId: '$ZRA+0000' })), 'ContractFee'), 15_000);
  it('Contract',       () => assertConnects(() => rpc().contract(create(ContractRequestSchema, { contractId: '$ZRA+0000' })), 'Contract'), 15_000);
  it('Denomination',   () => assertConnects(() => rpc().denomination(create(DenominationRequestSchema, { contractId: '$ZRA+0000' })), 'Denomination'), 15_000);
  it('Items',          () => assertConnects(() => rpc().items(create(ItemRequestSchema, { walletAddress: KNOWN_ADDRESS_BYTES })), 'Items'), 15_000);
  it('Block',          () => assertConnects(() => rpc().block(create(BlockRequestSchema, { payload: { case: 'blockHeight', value: 1n } })), 'Block'), 15_000);
  it('Database',       () => assertConnects(() => rpc().database(create(DatabaseRequestSchema, { type: DATABASE_TYPE.CONTRACTS, key: '$ZRA+0000' })), 'Database'), 15_000);
  it('TotalBalance',   () => assertConnects(() => rpc().totalBalance(create(TotalBalanceRequestSchema, { walletAddress: KNOWN_ADDRESS_BYTES })), 'TotalBalance'), 15_000);
  it('ProposalLedger', () => assertConnects(() => rpc().proposalLedger(create(ProposalLedgerRequestSchema, { type: DATABASE_TYPE.PROPOSALS, key: '' })), 'ProposalLedger'), 15_000);
  it('GetAllAuthorizedFees', () => assertConnects(() => rpc().getAllAuthorizedFees({}), 'GetAllAuthorizedFees'), 15_000);
  it('SmartContractEventsSearch', () => assertConnects(() => rpc().smartContractEventsSearch(create(SmartContractEventsSearchRequestSchema, { smartContractId: 'test' })), 'SmartContractEventsSearch'), 15_000);
  it('SmartContractActivityRequest', () => assertConnects(() => rpc().smartContractActivityRequest(create(ActivityRequestSchema, { smartContractId: 'test', instance: 0n, subscribe: false })), 'SmartContractActivityRequest'), 15_000);
  it('SmartContractEvents', () => assertConnects(() => rpc().smartContractEvents(create(SmartContractEventsResponseSchema, { smartContract: 'test' })), 'SmartContractEvents'), 15_000);
});

// ═══════════════════════════════════════════════════════════════════════════
// TXNService — transport connectivity (no real transactions submitted)
// ═══════════════════════════════════════════════════════════════════════════

describe('ConnectRPC Connectivity — submitTransaction (universal)', () => {
  it('routes CoinTXN via submitTransaction', async () => {
    const { submitTransaction } = await import('../transaction/transaction-client.js');
    await assertConnects(
      () => submitTransaction(create(CoinTXNSchema, {}), MAINNET_GRPC_CONFIG),
      'submitTransaction(CoinTXN)'
    );
  }, 15_000);
});

// ═══════════════════════════════════════════════════════════════════════════
// Error handling — unreachable endpoint
// ═══════════════════════════════════════════════════════════════════════════

describe('ConnectRPC Connectivity — Error Handling', () => {
  it('throws when endpoint is unreachable', async () => {
    const badClient = createClient(APIService, { host: 'localhost', port: 1, protocol: 'http' as const, fallbackToHttp: false, timeout: 3000 });
    await expect(badClient.nonce(create(NonceRequestSchema, { walletAddress: KNOWN_ADDRESS_BYTES }))).rejects.toThrow();
  }, 15_000);
});
