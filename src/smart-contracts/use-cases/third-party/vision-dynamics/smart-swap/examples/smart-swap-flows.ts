/**
 * Smart Swap — Drop-In Examples
 * 
 * Each function below is an independent, self-contained example of a different
 * way to perform indexer-powered swaps on the ZERA DEX. Pick the one that
 * fits your use case and drop it into your app.
 * 
 * ## Available Examples
 * 
 *   1. `getQuote()`                  — Get a price quote (no keys needed)
 *   2. `getQuoteAndTransaction()`    — Get quote and ready-to-sign transaction in one call
 *   3. `buildFromQuote(quote)`       — Build a swap transaction from a previous quote's stages
 *   4. `signAndSubmit(transaction)`  — Sign a serialized envelope and submit to network
 * 
 * ## Prerequisites
 * 
 * - A Vision Dynamics Indexer API instance (default: https://api.zerascan.io)
 * - `indexer-api-ts` — resolved automatically (local sibling dir → npm `@visiondynamics/zera-indexer`)
 * - For build/submit: ZERA keypair
 * - For submit: gRPC access to a ZERA node
 * 
 * @example
 * Run: npx tsx src/smart-contracts/use-cases/third-party/vision-dynamics/smart-swap/examples/smart-swap-flows.ts
 */

import {
  KeyPairSigner, signAndFinalize,
  deserializeTransaction, sendSmartContractExecuteTXN,
  type SerializedTransaction
} from '../../../../../../../index.js';
import { MAINNET_GRPC_CONFIG } from '../../../../../../shared/utils/testing-defaults/index.js';
import { ED25519_TEST_KEYS } from '../../../../../../test-utils/index.js';
import { resolveIndexerClient } from '../resolve-indexer.js';

// ============================================================================
// CONFIGURATION — Change these values for your app
// ============================================================================

const publicKey = ED25519_TEST_KEYS.alice.publicKey;
const privateKey = ED25519_TEST_KEYS.alice.privateKey;

const grpcConfig = MAINNET_GRPC_CONFIG;

/** Vision Dynamics Indexer API base URL — override to point at a local or custom indexer */
const INDEXER_URL = 'https://api.zerascan.io';

/**
 * Authorization for the indexer API.
 * Supports two formats:
 *   - 'Bearer <token>'  → passed as bearerToken to ZeraClient
 *   - 'Api-Key <key>'   → passed as apiKey to ZeraClient
 */
const AUTHORIZATION = 'Api-Key YOUR_API_KEY_HERE'; // or 'Bearer YOUR_TOKEN_HERE'

// Token pair
const TOKEN_IN = '$LEET+1337';
const TOKEN_OUT = '$sol-SOL+000000';

/** Input amount in smallest denomination (raw units) */
const AMOUNT_IN = 10000000;

/** Token used to pay network transaction fees */
const FEE_CONTRACT_ID = '$ZRA+0000';

// ============================================================================
// INDEXER CLIENT SETUP
// ============================================================================

/**
 * The indexer client is resolved at runtime via resolveIndexerClient().
 * It tries to import from a local sibling `indexer-api-ts` directory first,
 * then falls back to `@visiondynamics/zera-indexer` from npm.
 */
let dex: any;

async function initClient() {
  const { ZeraClient } = await resolveIndexerClient() as any;

  const clientConfig: any = { baseUrl: INDEXER_URL };
  if (AUTHORIZATION.startsWith('Bearer ')) {
    clientConfig.bearerToken = AUTHORIZATION.replace('Bearer ', '');
  } else if (AUTHORIZATION.startsWith('Api-Key ')) {
    clientConfig.apiKey = AUTHORIZATION.replace('Api-Key ', '');
  }

  const client = new ZeraClient(clientConfig);
  dex = client.v1.dex;
}

// ============================================================================
// EXAMPLE 1: Get a Quote
//   — Simplest call. No keys needed. Just shows what you'd get for a swap.
//   — Use this to display pricing in your UI.
// ============================================================================

async function getQuote() {
  const quote = await dex.swap({
    tokenIn: TOKEN_IN,
    tokenOut: TOKEN_OUT,
    amountIn: AMOUNT_IN
  });

  console.log('📊 Quote');
  console.log(`   ${AMOUNT_IN} ${TOKEN_IN} → ${quote.amountOut} ${TOKEN_OUT}`);
  console.log(`   Route: ${quote.stages?.length} stages, ${quote.hopDetails?.length} hops`);
  console.log(`   Slippage: ${quote.slippage}% | Pool Fee: ${quote.poolFeePercent}%`);
  console.log('');
  return quote;
}

// ============================================================================
// EXAMPLE 2: Get a Quote with Transaction
//   — One call returns both the quote AND a serialized transaction ready to sign.
//   — This is the most common pattern for apps that want to show pricing
//     and immediately have the transaction ready when the user confirms.
//   — Platform fee params are optional — include them if your dApp charges a fee.
// ============================================================================

async function getQuoteAndTransaction() {
  const result = await dex.swap({
    tokenIn: TOKEN_IN,
    tokenOut: TOKEN_OUT,
    amountIn: AMOUNT_IN,
    includeTransaction: true,       // ← this tells the indexer to also build the txn
    publicKey: publicKey,
    minAmountOut: '0',              // set to a real value for slippage protection
    feeContractID: FEE_CONTRACT_ID

    // Optional: platform fee — remove these if your dApp doesn't charge a fee
    // platformFeeBps: 75,                              // 0.75%
    // platformFeeAddress: ED25519_TEST_KEYS.bob.address,
  });

  console.log('🔨 Quote + Transaction');
  console.log(`   Quote:  ${result.amountOut} ${TOKEN_OUT}`);
  console.log(`   Type:   ${result.transaction?.type}`);
  console.log(`   Size:   ${result.transaction?.data?.length} bytes`);
  console.log('');
  return result;
}

// ============================================================================
// EXAMPLE 3: Build from Quote
//   — Two-step flow: show the user a quote, then build from the same route
//     when they confirm. Avoids re-computing the route.
// ============================================================================

async function buildFromQuote(quote: any) {
  // User confirms → build from the same stages
  const raw = await dex.swap({
    tokenIn: TOKEN_IN,
    tokenOut: TOKEN_OUT,
    amountIn: AMOUNT_IN,
    publicKey: publicKey,
    minAmountOut: '0',
    feeContractID: FEE_CONTRACT_ID,
    stages: quote.stages       // reuse the route from the quote
  }) as any;

  // Response shape may vary — check .transaction first, then top-level
  const txnData = raw.transaction || raw;
  const envelope: SerializedTransaction = {
    type: txnData.type,
    data: txnData.data,
    version: txnData.version
  };

  console.log('🔨 Built from Stages');
  console.log(`   Type:   ${envelope.type}`);
  console.log(`   Size:   ${envelope.data?.length} bytes`);
  console.log('');
  return envelope;
}

// ============================================================================
// UTILITY: Sign and Submit
//   — Takes a serialized transaction envelope from the indexer, signs it
//     locally, and submits it to the ZERA network.
// ============================================================================

async function signAndSubmit(transaction: NonNullable<any>) {
  // Deserialize the indexer's response into a protobuf object
  const deserialized = deserializeTransaction({
    type: transaction.type,
    data: transaction.data,
    version: transaction.version as 1
  });

  // Sign locally with keypair
  const signer = new KeyPairSigner(publicKey, privateKey);
  const signed = await signAndFinalize(deserialized as any, signer);

  // Submit to the ZERA network
  const txHash = await sendSmartContractExecuteTXN(signed as any, {
    ...grpcConfig,
    fallbackToHttp: true
  });

  console.log('✅ Swap Submitted');
  console.log(`   Hash: ${txHash}`);
  console.log('');
  return txHash;
}

// ============================================================================
// DEMO RUNNER
//   — Runs each example. Comment/uncomment what you want to test.
// ============================================================================

async function main() {
  await initClient();
  console.log('');

  // These are independent examples — run any combination:
  const quote = await getQuote();
  const quoteAndTxn = await getQuoteAndTransaction();
  const envelope = await buildFromQuote(quote);

  // ==========================================================================
  // ⚠️ Submit to Network
  // ==========================================================================
  console.log('⚠️  Submitting to network in 10 seconds. Press Ctrl+C to cancel.');
  for (let i = 10; i > 0; i--) {
    process.stdout.write(`\rStarting in ${i}s... `);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  process.stdout.write('\n\n');

  // We can pass the built transaction from either quoteAndTxn or envelope
  const SUBMIT_STAGES_FLOW = true; // Toggle to false to submit the One-Shot build instead

  if (SUBMIT_STAGES_FLOW) {
    console.log('--- Submitting Build From Stages ---');
    await signAndSubmit(envelope);
  } else {
    console.log('--- Submitting One-Shot Build ---');
    if (quoteAndTxn.transaction) {
      await signAndSubmit(quoteAndTxn.transaction);
    }
  }
}

main().catch(console.error);
