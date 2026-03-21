/**
 * Guardian VAA Module
 * 
 * Helper functions to fetch VAA (Verified Action Approval) payloads from the 
 * Guardian service and submit them to the destination chain.
 * 
 * These functions automate the full bridge flow:
 * 1. Fetch VAA from Guardian API
 * 2. Build the appropriate transaction
 * 3. Submit to destination chain
 * 
 * ## Functions
 * - `fetchSolanaVAA` - Fetch VAA for ZERA→Solana transfers
 * - `fetchZeraVAA` - Fetch VAA for Solana→ZERA transfers
 * - `submitVAAToSolana` - Fetch VAA + build tx + submit to Solana
 * - `submitVAAToZera` - Fetch VAA + build tx + submit to ZERA
 */

import { Connection, Keypair, sendAndConfirmTransaction } from '@solana/web3.js';

import { GuardianService } from '../../../../../proto/generated/guardian_pb.js';
import {
  PayloadRequestSchema,
  NETWORK_TYPE,
  type SolanaPayload,
  type ZeraPayload
} from '../../../../../proto/generated/guardian_pb.js';
import { create } from '@bufbuild/protobuf';
import { createClient } from '../../../../grpc/client-factory.js';
import type { GRPCConfig } from '../../../../types/index.js';
import {
  buildReleaseSplTransaction,
  buildReleaseSolTransaction,
  buildMintWrappedTransaction,
  buildMintWrappedExistingTransaction
} from '../solana/transactions/index.js';
import type { GuardianSignature } from '../solana/types.js';

// ============================================================================
// TYPES
// ============================================================================

export interface SubmitVAAToSolanaOptions {
  /** Original ZERA transaction hash */
  txnHash: string;
  /** Guardian service gRPC config */
  guardianConfig: GRPCConfig;
  /** Solana connection */
  connection: Connection;
  /** Solana payer/signer keypair */
  payer: Keypair;
  /** Optional: Skip confirmation (default: false) */
  skipConfirmation?: boolean;
  /** Optional: Skip preflight simulation (default: false) */
  skipPreflight?: boolean;
  /** Optional: Retry VAA fetch with exponential backoff */
  retryOptions?: VAARetryOptions;
}

export interface SubmitVAAToSolanaResult {
  /** Solana transaction signature */
  signature: string;
  /** Type of operation performed */
  operationType: 'release_spl' | 'release_sol' | 'mint_wrapped';
  /** The VAA payload that was submitted */
  payload: SolanaPayload;
}

export interface SubmitVAAToZeraOptions {
  /** Original Solana transaction signature */
  txSignature: string;
  /** Guardian service gRPC config */
  guardianConfig: GRPCConfig;
  /** ZERA network gRPC config */
  zeraConfig: GRPCConfig;
  /** ZERA signer public key (base58) */
  publicKeyBase58: string;
  /** ZERA signer private key (base58) */
  privateKeyBase58: string;
  /** Optional fee amount in USD (skips auto-calculation if provided) */
  feeAmountUsd?: string;
  /** Optional gas fee in USD for smart contract execution */
  gasFeeInUsd?: number;
  /** Optional fee contract ID (defaults to the bridged token if not specified) */
  feeId?: string;
  /** Optional fee amount in raw parts (overrides auto-calculation) */
  feeAmount?: string;
  /** Optional: Retry VAA fetch with exponential backoff */
  retryOptions?: VAARetryOptions;
}

export interface SubmitVAAToZeraResult {
  /** ZERA transaction hash */
  txnHash: string;
  /** Type of operation performed */
  operationType: 'release' | 'mint';
  /** The VAA payload that was submitted */
  payload: ZeraPayload;
}


// ============================================================================
// VAA INTEGRITY VALIDATION
// ============================================================================

/**
 * Deduplicate VAA payload signatures and public keys
 * 
 * Performs sanity checks and automatically removes duplicates:
 * - Removes duplicate signatures (keeping the first occurrence)
 * - Removes corresponding public key entries to maintain pairing
 * - Ensures matching length of signatures and public keys arrays
 * 
 * @param signatures - Array of guardian signatures
 * @param publicKeys - Array of guardian public keys
 * @returns Deduplicated arrays of signatures and public keys
 * @throws Error if arrays are empty or have mismatched lengths
 */
function deduplicateVAA(signatures: string[], publicKeys: string[]): { signatures: string[], publicKeys: string[] } {
  // Check for matching array lengths
  if (signatures.length !== publicKeys.length) {
    throw new Error(
      `VAA integrity check failed: signatures count (${signatures.length}) does not match public keys count (${publicKeys.length})`
    );
  }

  // Check for empty arrays
  if (signatures.length === 0) {
    throw new Error('VAA integrity check failed: no signatures present');
  }

  // Deduplicate by tracking seen signatures and keeping paired entries
  const seenSignatures = new Set<string>();
  const deduplicatedSignatures: string[] = [];
  const deduplicatedPublicKeys: string[] = [];

  for (let i = 0; i < signatures.length; i++) {
    const sig = signatures[i] as string;
    const pubKey = publicKeys[i] as string;
    if (!seenSignatures.has(sig)) {
      seenSignatures.add(sig);
      deduplicatedSignatures.push(sig);
      deduplicatedPublicKeys.push(pubKey);
    }
  }

  // Log if duplicates were removed
  if (deduplicatedSignatures.length !== signatures.length) {
    console.log(`VAA sanity check: removed ${signatures.length - deduplicatedSignatures.length} duplicate signature(s)`);
  }

  return {
    signatures: deduplicatedSignatures,
    publicKeys: deduplicatedPublicKeys
  };
}

// ============================================================================
// FETCH VAA HELPERS
// ============================================================================

/** Options for VAA retry behavior */
export interface VAARetryOptions {
  /** Enable exponential backoff retry. Default: false */
  retry?: boolean;
  /** Maximum total elapsed time in ms before giving up. Default: 120_000 (120s) */
  maxElapsedMs?: number;
  /** Initial delay between retries in ms. Doubles each attempt. Default: 1000 (1s) */
  initialDelayMs?: number;
}

/**
 * Execute an async fetch function with exponential backoff retry.
 * 
 * Starts with `initialDelayMs` (default 1s), doubles each attempt, and
 * stops once the total elapsed time exceeds `maxElapsedMs` (default 120s).
 * Logs each miss (retry) and hit (success) to the console.
 * 
 * @param label - Human-readable label for log messages (e.g. "SolanaVAA")
 * @param fn - The async function to retry
 * @param options - Retry timing options
 * @returns The result of `fn` on success
 * @throws The last error if all retries are exhausted
 */
async function fetchWithRetry<T>(
  label: string,
  fn: () => Promise<T>,
  options: VAARetryOptions = {}
): Promise<T> {
  const maxElapsedMs = options.maxElapsedMs ?? 120_000;
  const initialDelayMs = options.initialDelayMs ?? 1_000;

  const startTime = Date.now();
  let delay = initialDelayMs;
  let attempt = 1;

   
  while (true) {
    try {
      const result = await fn();
      console.log(`  ✅ [${label}] Hit on attempt ${attempt} (${Date.now() - startTime}ms elapsed)`);
      return result;
    } catch (error) {
      const elapsed = Date.now() - startTime;

      if (elapsed + delay > maxElapsedMs) {
        console.log(`  ❌ [${label}] Miss on attempt ${attempt} — timeout reached (${elapsed}ms elapsed). Giving up.`);
        throw error;
      }

      const msg = error instanceof Error ? error.message : String(error);
      console.log(`  ⏳ [${label}] Miss on attempt ${attempt} (${elapsed}ms elapsed): ${msg}. Retrying in ${delay}ms...`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * 2, maxElapsedMs - (Date.now() - startTime));
      attempt++;
    }
  }
}

/**
 * Fetch Solana-bound VAA from Guardian service
 * 
 * Use this when a ZERA transaction needs to trigger a Solana release/mint.
 * 
 * @param txnHash - ZERA transaction hash
 * @param guardianConfig - Guardian gRPC config
 * @param retryOptions - Optional retry with exponential backoff (1s → 120s)
 * @returns The SolanaPayload VAA with signatures
 */
export async function fetchSolanaVAA(
  txnHash: string,
  guardianConfig: GRPCConfig,
  retryOptions?: VAARetryOptions
): Promise<SolanaPayload> {
  const doFetch = async (): Promise<SolanaPayload> => {
    const client = createClient(GuardianService, guardianConfig);
    
    const request = create(PayloadRequestSchema, {
      payloadId: txnHash,
      networkType: NETWORK_TYPE.ZERA
    });
    
    const response = await client.getPayload(request) as any;
    
    if (response.payload.case !== 'solanaPayload') {
      throw new Error(`Expected Solana payload, got: ${response.payload.case}`);
    }
    
    const payload = response.payload.value;
    
    // Deduplicate VAA signatures/public keys before returning
    const deduplicated = deduplicateVAA(payload.signatures, payload.publicKeys);
    payload.signatures = deduplicated.signatures;
    payload.publicKeys = deduplicated.publicKeys;
    
    return payload;
  };

  if (retryOptions?.retry) {
    return fetchWithRetry(`SolanaVAA tx=${txnHash}`, doFetch, retryOptions);
  }
  return doFetch();
}

/**
 * Fetch ZERA-bound VAA from Guardian service
 * 
 * Use this when a Solana transaction needs to trigger a ZERA release/mint.
 * 
 * @param txSignature - Solana transaction signature
 * @param guardianConfig - Guardian gRPC config
 * @param retryOptions - Optional retry with exponential backoff (1s → 120s)
 * @returns The ZeraPayload VAA with signatures
 */
export async function fetchZeraVAA(
  txSignature: string,
  guardianConfig: GRPCConfig,
  retryOptions?: VAARetryOptions
): Promise<ZeraPayload> {
  const doFetch = async (): Promise<ZeraPayload> => {
    const client = createClient(GuardianService, guardianConfig);
    
    const request = create(PayloadRequestSchema, {
      payloadId: txSignature,
      networkType: NETWORK_TYPE.SOLANA
    });
    
    const response = await client.getPayload(request) as any;
    
    if (response.payload.case !== 'zeraPayload') {
      throw new Error(`Expected ZERA payload, got: ${response.payload.case}`);
    }
    
    const payload = response.payload.value;
    
    // Deduplicate VAA signatures/public keys before returning
    const deduplicated = deduplicateVAA(payload.signatures, payload.publicKeys);
    payload.signatures = deduplicated.signatures;
    payload.publicKeys = deduplicated.publicKeys;
    
    return payload;
  };

  if (retryOptions?.retry) {
    return fetchWithRetry(`ZeraVAA tx=${txSignature}`, doFetch, retryOptions);
  }
  return doFetch();
}



// ============================================================================
// SUBMIT VAA TO SOLANA
// ============================================================================

/**
 * Submit a VAA to Solana to complete a ZERA → Solana bridge transfer
 * 
 * This is the main function for completing a ZERA → Solana bridge transfer.
 * It fetches the VAA from the Guardian service and submits the appropriate
 * transaction to Solana.
 * 
 * @example
 * ```typescript
 * import { Connection, Keypair } from '@solana/web3.js';
 * import { guardian } from '@zera-os/zera.js';
 * 
 * const result = await guardian.submitVAAToSolana({
 *   txnHash: 'your-zera-txn-hash',
 *   guardianConfig: { host: 'guardian.zerascan.io' },
 *   connection: new Connection('https://api.mainnet-beta.solana.com'),
 *   payer: Keypair.fromSecretKey(yourSecretKey)
 * });
 * 
 * console.log('Solana signature:', result.signature);
 * ```
 */
export async function submitVAAToSolana(
  options: SubmitVAAToSolanaOptions
): Promise<SubmitVAAToSolanaResult> {
  const { txnHash, guardianConfig, connection, payer, skipConfirmation = false, skipPreflight = false, retryOptions } = options;
  
  // 1. Fetch VAA from Guardian
  const solanaPayload = await fetchSolanaVAA(txnHash, guardianConfig, retryOptions);
  
  // 2. Convert guardian signatures to our format
  const signatures: GuardianSignature[] = solanaPayload.signatures.map((sig, i) => ({
    signature: sig,
    publicKey: solanaPayload.publicKeys[i] || ''
  }));
  
  // Get timestamp in seconds
  const timestamp = solanaPayload.timestamp 
    ? Math.floor(solanaPayload.timestamp.seconds.toString() as unknown as number)
    : Math.floor(Date.now() / 1000);
  
  // 3. Build and send appropriate transaction based on payload type
  let signature: string;
  let operationType: 'release_spl' | 'release_sol' | 'mint_wrapped';
  
  switch (solanaPayload.payload.case) {
  case 'releasePayload': {
    const release = solanaPayload.payload.value;
      
    // Determine if SOL or SPL based on mint address
    // Wrapped SOL (NATIVE_MINT ...112) is an SPL token and goes through the SPL release path.
    // Only raw native SOL (empty or guardian's ...111 representation) uses the SOL release path.
    const isNativeSol = !release.solanaMintAddress 
      || release.solanaMintAddress === 'So11111111111111111111111111111111111111111';  // Guardian's native SOL representation
    if (isNativeSol) {
      // Native SOL release — two-transaction split (matches Rust reference)
      const { verifyTransaction, releaseTransaction } = await buildReleaseSolTransaction(
        {
          amount: BigInt(release.amount.toString()),
          recipient: release.solanaWalletAddress,
          txnId: release.txnHash,
          timestamp,
          signatures,
          expectedHash: solanaPayload.signedHash,
          usdAmount: BigInt(release.usdAmount.toString())
        },
        payer.publicKey,
        connection
      );

      // TX1: Ed25519 signature verification + core post_verified_transfer
      verifyTransaction.sign(payer);
      if (skipConfirmation) {
        await connection.sendRawTransaction(verifyTransaction.serialize(), { skipPreflight });
      } else {
        await sendAndConfirmTransaction(connection, verifyTransaction, [payer], { skipPreflight });
      }

      // TX2: Token bridge release_sol (needs fresh blockhash)
      const { blockhash } = await connection.getLatestBlockhash();
      releaseTransaction.recentBlockhash = blockhash;
      releaseTransaction.sign(payer);
      if (skipConfirmation) {
        signature = await connection.sendRawTransaction(releaseTransaction.serialize(), { skipPreflight });
      } else {
        signature = await sendAndConfirmTransaction(connection, releaseTransaction, [payer], { skipPreflight });
      }
      operationType = 'release_sol';
    } else {
      // SPL token release — two-transaction split (matches SOL/mint patterns)
      const { verifyTransaction, releaseTransaction } = await buildReleaseSplTransaction(
        {
          amount: BigInt(release.amount.toString()),
          recipient: release.solanaWalletAddress,
          mint: release.solanaMintAddress,
          txnId: release.txnHash,
          timestamp,
          signatures,
          expectedHash: solanaPayload.signedHash,
          usdPriceNano: BigInt(release.usdAmount.toString()),
          liquidityUsdNano: BigInt(release.liquidityUsd.toString()),
          tier: release.tier
        },
        payer.publicKey,
        connection
      );

      // TX1: Ed25519 signature verification + core post_verified_transfer
      verifyTransaction.sign(payer);
      if (skipConfirmation) {
        await connection.sendRawTransaction(verifyTransaction.serialize(), { skipPreflight });
      } else {
        await sendAndConfirmTransaction(connection, verifyTransaction, [payer], { skipPreflight });
      }

      // TX2: Token bridge release_spl (needs fresh blockhash)
      const { blockhash } = await connection.getLatestBlockhash();
      releaseTransaction.recentBlockhash = blockhash;
      releaseTransaction.sign(payer);
      if (skipConfirmation) {
        signature = await connection.sendRawTransaction(releaseTransaction.serialize(), { skipPreflight });
      } else {
        signature = await sendAndConfirmTransaction(connection, releaseTransaction, [payer], { skipPreflight });
      }
      operationType = 'release_spl';
    }
    break;
  }
    
  case 'mintPayload': {
    const mint = solanaPayload.payload.value;
      
    // For existing token mint (no metadata)
    const { verifyTransaction, mintTransaction: mintTx } = await buildMintWrappedExistingTransaction(
      {
        amount: BigInt(mint.amount.toString()),
        recipient: mint.solanaWalletAddress,
        contractId: mint.zeraContractId,
        txnId: mint.txnHash,
        timestamp,
        signatures,
        expectedHash: solanaPayload.signedHash,
        usdPriceNano: BigInt(mint.usdAmount.toString()),
        liquidityUsdNano: BigInt(mint.liquidityUsd.toString()),
        tier: mint.tier
      },
      payer.publicKey,
      connection
    );
      
    // TX1: Ed25519 signature verification + core post_verified_transfer
    verifyTransaction.sign(payer);
    if (skipConfirmation) {
      await connection.sendRawTransaction(verifyTransaction.serialize(), { skipPreflight });
    } else {
      await sendAndConfirmTransaction(connection, verifyTransaction, [payer], { skipPreflight });
    }

    // TX2: Token bridge mint_wrapped (needs fresh blockhash)
    const { blockhash: mintBlockhash } = await connection.getLatestBlockhash();
    mintTx.recentBlockhash = mintBlockhash;
    mintTx.sign(payer);
    if (skipConfirmation) {
      signature = await connection.sendRawTransaction(mintTx.serialize(), { skipPreflight });
    } else {
      signature = await sendAndConfirmTransaction(connection, mintTx, [payer], { skipPreflight });
    }
    operationType = 'mint_wrapped';
    break;
  }
    
  case 'contractPayload': {
    // First-time mint with metadata
    const contract = solanaPayload.payload.value;
      
    const { verifyTransaction, mintTransaction: mintTx } = await buildMintWrappedTransaction(
      {
        amount: BigInt(contract.amount.toString()),
        recipient: contract.solanaWalletAddress,
        contractId: contract.zeraContractId,
        decimals: parseInt(contract.decimals, 10),
        name: contract.name,
        symbol: contract.symbol,
        uri: contract.uri,
        txnId: contract.txnHash,
        timestamp,
        signatures,
        expectedHash: solanaPayload.signedHash,
        usdPriceNano: BigInt(contract.usdAmount.toString()),
        liquidityUsdNano: BigInt(contract.liquidityUsd.toString()),
        tier: contract.tier
      },
      payer.publicKey,
      connection
    );
      
    // TX1: Ed25519 signature verification + core post_verified_transfer
    verifyTransaction.sign(payer);
    if (skipConfirmation) {
      await connection.sendRawTransaction(verifyTransaction.serialize(), { skipPreflight });
    } else {
      await sendAndConfirmTransaction(connection, verifyTransaction, [payer], { skipPreflight });
    }

    // TX2: Token bridge mint_wrapped (needs fresh blockhash)
    const { blockhash: contractMintBlockhash } = await connection.getLatestBlockhash();
    mintTx.recentBlockhash = contractMintBlockhash;
    mintTx.sign(payer);
    if (skipConfirmation) {
      signature = await connection.sendRawTransaction(mintTx.serialize(), { skipPreflight });
    } else {
      signature = await sendAndConfirmTransaction(connection, mintTx, [payer], { skipPreflight });
    }
    operationType = 'mint_wrapped';
    break;
  }
    
  default:
    throw new Error(`Unsupported payload type: ${solanaPayload.payload.case}`);
  }
  
  return {
    signature,
    operationType,
    payload: solanaPayload
  };
}



// ============================================================================
// SUBMIT VAA TO ZERA
// ============================================================================

/**
 * Submit a VAA to ZERA to complete a Solana → ZERA bridge transfer
 * 
 * This fetches the VAA from the Guardian service and submits the appropriate
 * transaction to ZERA.
 * 
 * @example
 * ```typescript
 * import { guardian } from '@zera-os/zera.js';
 * 
 * const result = await guardian.submitVAAToZera({
 *   txSignature: 'solana-tx-signature',
 *   guardianConfig: { host: 'guardian.zerascan.io' },
 *   zeraConfig: { host: 'mainnet.zerascan.io', port: 443 },
 *   publicKeyBase58: 'your-zera-public-key',
 *   privateKeyBase58: 'your-zera-private-key'
 * });
 * 
 * console.log('ZERA txn hash:', result.txnHash);
 * ```
 */
export async function submitVAAToZera(
  options: SubmitVAAToZeraOptions
): Promise<SubmitVAAToZeraResult> {
  const { txSignature, guardianConfig, zeraConfig, publicKeyBase58, privateKeyBase58, retryOptions } = options;
  
  // Import ZERA functions dynamically to avoid circular dependencies
  const { releaseZeraAndSend, mintSolAndSend, createSolAndSend } = await import('../zera/transactions/index.js');
  
  // 1. Fetch VAA from Guardian
  const zeraPayload = await fetchZeraVAA(txSignature, guardianConfig, retryOptions);
  
  // 2. Build and send appropriate transaction based on payload type
  let txnHash: string;
  let operationType: 'release' | 'mint';
  
  switch (zeraPayload.payload.case) {
  case 'releasePayload': {
    const release = zeraPayload.payload.value;
    
    txnHash = await releaseZeraAndSend(
      release.zeraWalletAddress,
      publicKeyBase58,
      privateKeyBase58,
      {
        payload: zeraPayload,
        grpcConfig: zeraConfig,
        ...(options.feeAmountUsd !== undefined && { feeAmountUsd: options.feeAmountUsd }),
        ...(options.gasFeeInUsd !== undefined && { gasFeeInUsd: options.gasFeeInUsd }),
        ...(options.feeId !== undefined && { feeId: options.feeId }),
        ...(options.feeAmount !== undefined && { feeAmountUsd: options.feeAmount })
      }
    );
    operationType = 'release';
    break;
  }
    
  case 'mintPayload': {
    const mint = zeraPayload.payload.value;
    
    txnHash = await mintSolAndSend(
      mint.zeraWalletAddress,
      publicKeyBase58,
      privateKeyBase58,
      {
        payload: zeraPayload,
        grpcConfig: zeraConfig,
        ...(options.feeAmountUsd !== undefined && { feeAmountUsd: options.feeAmountUsd }),
        ...(options.gasFeeInUsd !== undefined && { gasFeeInUsd: options.gasFeeInUsd }),
        ...(options.feeId !== undefined && { feeId: options.feeId }),
        ...(options.feeAmount !== undefined && { feeAmountUsd: options.feeAmount })
      }
    );
    operationType = 'mint';
    break;
  }
    
  case 'contractPayload': {
    const contract = zeraPayload.payload.value;
    
    txnHash = await createSolAndSend(
      contract.zeraWalletAddress,
      publicKeyBase58,
      privateKeyBase58,
      {
        payload: zeraPayload,
        grpcConfig: zeraConfig,
        ...(options.feeAmountUsd !== undefined && { feeAmountUsd: options.feeAmountUsd }),
        ...(options.gasFeeInUsd !== undefined && { gasFeeInUsd: options.gasFeeInUsd }),
        ...(options.feeId !== undefined && { feeId: options.feeId }),
        ...(options.feeAmount !== undefined && { feeAmountUsd: options.feeAmount })
      }
    );
    operationType = 'mint';
    break;
  }
    
  default:
    throw new Error(`Unsupported payload type: ${zeraPayload.payload.case}`);
  }
  
  return {
    txnHash,
    operationType,
    payload: zeraPayload
  };
}

