/**
 * End-to-End SOL Bridge Roundtrip (Solana ↔ ZERA)
 * 
 * Demonstrates a complete SOL bridge lifecycle:
 * 
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │ STEP 1: Lock native SOL on Solana  (Solana → vault)           │
 *   │ STEP 2: Submit VAA to ZERA         (Guardian → ZERA mint)     │
 *   │ STEP 3: Burn wrapped SOL on ZERA   (ZERA → burn)              │
 *   │ STEP 4: Submit VAA to Solana       (Guardian → Solana release) │
 *   └─────────────────────────────────────────────────────────────────┘
 * 
 * Each step feeds its output hash into the next step.
 * VAA fetches use exponential backoff (1s → 120s) because guardians
 * may not have the payload ready immediately after the on-chain tx.
 * 
 * @example
 * Run: npx tsx src/smart-contracts/use-cases/bridge/examples/e2e-solana-sol-roundtrip.ts
 */

import { Connection, Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

// --- Solana bridge builders ---
import { PROTONET_GRPC_CONFIG } from '../../../../shared/utils/testing-defaults/index.js';
import { SOLANA_TEST_KEYS, SOLANA_TEST_RPC, ED25519_TEST_KEYS, TEST_WALLET_ADDRESSES } from '../../../../test-utils/index.js';
import { sendSmartContractExecuteTXN } from '../../../execute/index.js';
import {
  submitVAAToSolana,
  submitVAAToZera
} from '../guardian/index.js';
import {
  buildLockSolTransaction
} from '../solana/transactions/index.js';
import { burnSol } from '../zera/index.js';

// ============================================================================
// CONFIGURATION
// ============================================================================

/** Guardian service endpoint */
const GUARDIAN_CONFIG = {
  host: 'guardian.zerascan.io',
  protocol: 'https' as const,
  port: 443
};

/** Solana RPC connection */
const connection = new Connection(SOLANA_TEST_RPC.devnet);

/** Solana wallet (signs lock + release transactions) */
const solanaWallet = Keypair.fromSecretKey(bs58.decode(SOLANA_TEST_KEYS.primary.privateKey));
const PAYER = solanaWallet.publicKey;

/** ZERA wallet (signs burn transaction) */
const ZERA_PUBLIC_KEY = ED25519_TEST_KEYS.alice.publicKey;
const ZERA_PRIVATE_KEY = ED25519_TEST_KEYS.alice.privateKey;

/** ZERA network config */
const ZERA_CONFIG = PROTONET_GRPC_CONFIG;

/** Fee config for ZERA transactions */
const FEE_AMOUNT_USD = '5.00';
const FEE_CONTRACT_ID = '$ZRA+0000';

/** ZERA recipient address (Alice's wallet address — receives wrapped SOL on ZERA) */
const ZERA_RECIPIENT = TEST_WALLET_ADDRESSES.alice;

/** Solana destination address (receives native SOL back from ZERA) */
const SOLANA_DESTINATION = SOLANA_TEST_KEYS.primary.publicKey;

/** Wrapped SOL contract ID on ZERA */
const WRAPPED_SOL_CONTRACT = '$sol-SOL+000000';

/** Amount of SOL to bridge (in lamports for Solana, decimal for ZERA) */
const SOL_AMOUNT_LAMPORTS = '100000000'; // 0.1 SOL
const SOL_AMOUNT_DECIMAL = '0.1';        // 0.1 SOL

// ============================================================================
// HELPER: Sign and send a Solana transaction
// ============================================================================

async function signAndSend(
  transaction: import('@solana/web3.js').Transaction,
  signers: Keypair[]
): Promise<string> {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = PAYER;

  transaction.sign(...signers);
  const signature = await connection.sendRawTransaction(transaction.serialize(), {
    skipPreflight: true
  });

  await connection.confirmTransaction({
    signature,
    blockhash,
    lastValidBlockHeight
  }, 'confirmed');

  return signature;
}

// ============================================================================
// STEP 1: Lock native SOL on Solana → vault
// ============================================================================

/**
 * Lock native SOL into the bridge vault on Solana.
 * Returns the Solana transaction signature, which STEP 2 uses to fetch the VAA.
 */
async function step1_lockSol(): Promise<string> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 1: Lock native SOL on Solana');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Amount:   ${SOL_AMOUNT_LAMPORTS} lamports (${SOL_AMOUNT_DECIMAL} SOL)`);
  console.log(`  ZERA Dst: ${ZERA_RECIPIENT.slice(0, 30)}...`);
  console.log('');

  const result = await buildLockSolTransaction(
    {
      amount: SOL_AMOUNT_LAMPORTS,
      zeraAddress: ZERA_RECIPIENT
    },
    PAYER,
    connection
  );

  console.log(`  Vault ATA: ${result.accounts.vaultAta.toBase58()}`);

  const signature = await signAndSend(result.transaction, [solanaWallet]);
  console.log(`  ✅ Locked! Solana sig: ${signature}`);
  console.log('');

  return signature;
}

// ============================================================================
// STEP 2: Submit VAA to ZERA (mints wrapped SOL on ZERA)
// ============================================================================

/**
 * Fetch the VAA for the Solana lock transaction and submit it to ZERA.
 * This mints wrapped SOL on the ZERA network.
 * Returns the ZERA transaction hash, which STEP 3 uses.
 */
async function step2_submitToZera(solanaSig: string): Promise<string> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 2: Submit VAA to ZERA (mint wrapped SOL)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Solana sig: ${solanaSig.slice(0, 30)}...`);
  console.log('  Fetching VAA with exp backoff (1s → 120s)...');
  console.log('');

  const result = await submitVAAToZera({
    txSignature: solanaSig,
    guardianConfig: GUARDIAN_CONFIG,
    zeraConfig: ZERA_CONFIG,
    publicKeyBase58: ZERA_PUBLIC_KEY,
    privateKeyBase58: ZERA_PRIVATE_KEY,
    feeAmountUsd: FEE_AMOUNT_USD,
    feeId: FEE_CONTRACT_ID,
    retryOptions: { retry: true }
  });

  console.log(`  ✅ Minted on ZERA! Hash: ${result.txnHash}`);
  console.log(`  Operation: ${result.operationType}`);
  console.log('');

  return result.txnHash;
}

// ============================================================================
// STEP 3: Burn wrapped SOL on ZERA (initiates release back to Solana)
// ============================================================================

/**
 * Burn the wrapped SOL on ZERA to initiate a release back to Solana.
 * Returns the ZERA transaction hash, which STEP 4 uses to fetch the VAA.
 */
async function step3_burnSol(): Promise<string> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 3: Burn wrapped SOL on ZERA');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Contract:   ${WRAPPED_SOL_CONTRACT}`);
  console.log(`  Amount:     ${SOL_AMOUNT_DECIMAL} SOL`);
  console.log(`  Solana Dst: ${SOLANA_DESTINATION.slice(0, 30)}...`);
  console.log('');

  const txn = await burnSol(
    WRAPPED_SOL_CONTRACT,
    SOL_AMOUNT_DECIMAL,
    SOLANA_DESTINATION,
    ZERA_PUBLIC_KEY,
    ZERA_PRIVATE_KEY,
    {
      grpcConfig: ZERA_CONFIG,
      feeId: FEE_CONTRACT_ID,
      feeAmountUsd: FEE_AMOUNT_USD
    }
  );

  const hash = await sendSmartContractExecuteTXN(txn, ZERA_CONFIG);

  console.log(`  ✅ Burned! ZERA hash: ${hash}`);
  console.log('');

  return hash;
}

// ============================================================================
// STEP 4: Submit VAA to Solana (releases native SOL from vault)
// ============================================================================

/**
 * Fetch the VAA for the ZERA burn transaction and submit it to Solana.
 * This releases native SOL from the bridge vault back to the user.
 * Uses the two-transaction split: TX1 (verify + core), TX2 (release_spl).
 */
async function step4_submitToSolana(zeraHash: string): Promise<string> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 4: Submit VAA to Solana (release SPL)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  ZERA hash: ${zeraHash.slice(0, 30)}...`);
  console.log('  Fetching VAA with exp backoff (1s → 120s)...');
  console.log('');

  const result = await submitVAAToSolana({
    txnHash: zeraHash,
    guardianConfig: GUARDIAN_CONFIG,
    connection,
    payer: solanaWallet,
    skipPreflight: true,
    retryOptions: { retry: true }
  });

  console.log(`  ✅ Released! Solana sig: ${result.signature}`);
  console.log(`  Operation: ${result.operationType}`);
  console.log('');

  return result.signature;
}

// ============================================================================
// MAIN: Full roundtrip orchestrator
// ============================================================================

/**
 * Execute the full SOL bridge roundtrip:
 *   Solana (lock) → ZERA (mint) → ZERA (burn) → Solana (release)
 * 
 * Each step's output hash feeds directly into the next step.
 */
async function runFullRoundtrip() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║        SOL Bridge Roundtrip: Solana → ZERA → Solana        ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  Solana wallet: ${PAYER.toBase58().slice(0, 38)}...  ║`);
  console.log(`║  ZERA wallet:   ${ZERA_PUBLIC_KEY.slice(0, 38)}...  ║`);
  console.log(`║  Amount:        ${SOL_AMOUNT_DECIMAL} SOL${' '.repeat(35)}║`);
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  const startTime = Date.now();

  try {
    // STEP 1: Lock SOL on Solana
    const solanaSig = await step1_lockSol();

    // STEP 2: Submit VAA → ZERA (mints wrapped SOL)
    const zeraHash1 = await step2_submitToZera(solanaSig);

    // STEP 3: Burn wrapped SOL on ZERA
    const zeraHash2 = await step3_burnSol();

    // STEP 4: Submit VAA → Solana (releases native SOL)
    const finalSig = await step4_submitToSolana(zeraHash2);

    // Summary
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║                   ✅ ROUNDTRIP COMPLETE                     ║');
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log(`║  Total time: ${elapsed}s${' '.repeat(Math.max(0, 44 - elapsed.length))}║`);
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log(`║  1. Lock SOL:      ${solanaSig.slice(0, 38)}...  ║`);
    console.log(`║  2. Mint on ZERA:  ${zeraHash1.slice(0, 38)}...  ║`);
    console.log(`║  3. Burn on ZERA:  ${zeraHash2.slice(0, 38)}...  ║`);
    console.log(`║  4. Release SPL:   ${finalSig.slice(0, 38)}...  ║`);
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');

  } catch (error) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error('');
    console.error(`❌ Roundtrip failed after ${elapsed}s`);
    console.error(`   ${error instanceof Error ? error.message : String(error)}`);
    console.error('');
    process.exit(1);
  }
}

// ============================================================================
// RUN
// ============================================================================

runFullRoundtrip().catch(console.error);
