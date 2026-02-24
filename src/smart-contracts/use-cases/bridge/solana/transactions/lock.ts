/**
 * Lock Transaction Builders
 * 
 * Builds transactions for locking tokens on Solana to bridge to ZERA.
 */

import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram
} from '@solana/web3.js';

import {
  concatBytes,
  encodeU64LE
} from '../../../../../shared/utils/byte-utils.js';
import type { LockSplOptions, LockSolOptions } from '../types.js';
import {
  CORE_PROGRAM_ID,
  TOKEN_BRIDGE_PROGRAM_ID,
  generateDiscriminator,
  deriveRouterSignerPDA,
  deriveRateLimitStatePDA,
  deriveTokenRegistrationPDA,
  getATA,
  encodeBorshString
} from '../utils.js';

// ============================================================================
// LOCK SPL TOKENS (Bridge to ZERA)
// ============================================================================

export interface LockSplResult {
  instruction: TransactionInstruction;
  transaction: Transaction;
  accounts: {
    userAta: PublicKey;
    vaultAta: PublicKey;
    routerSigner: PublicKey;
    routerConfig: PublicKey;
    rateLimitState: PublicKey;
    tokenRegistration: PublicKey;
  };
}

/**
 * Build a Lock SPL transaction
 * 
 * Locks SPL tokens in the vault to bridge to ZERA chain.
 */
export async function buildLockSplTransaction(
  options: LockSplOptions,
  payer: PublicKey,
  connection?: Connection
): Promise<LockSplResult> {
  const { amount, zeraAddress, mint } = options;

  const mintPubkey = new PublicKey(mint);
  const [routerSigner] = deriveRouterSignerPDA();
  const [rateLimitState] = deriveRateLimitStatePDA();
  const [tokenRegistration] = deriveTokenRegistrationPDA(mintPubkey);

  // Additional PDAs required by the on-chain program
  const [routerConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from('router_cfg')],
    CORE_PROGRAM_ID
  );

  const userAta = getATA(payer, mintPubkey);
  const vaultAta = getATA(routerSigner, mintPubkey);

  const amountBigInt = BigInt(amount);

  const data = concatBytes(
    generateDiscriminator('global:lock_spl'),
    encodeU64LE(amountBigInt),
    encodeBorshString(zeraAddress)
  );

  // Account order must match Rust reference exactly:
  // 1. core_program (readonly)
  // 2. router_cfg (readonly)
  // 3. payer (signer, writable)
  // 4. from_ata (writable)
  // 5. mint (readonly)
  // 6. router_signer (readonly)
  // 7. vault_ata (writable)
  // 8. rate_limit_state (writable)
  // 9. token_registration (writable)
  // 10. token_program (readonly)
  // 11. associated_token_program (readonly)
  // 12. system_program (readonly)
  const instruction = new TransactionInstruction({
    programId: TOKEN_BRIDGE_PROGRAM_ID,
    keys: [
      { pubkey: CORE_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: routerConfig, isSigner: false, isWritable: false },
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: userAta, isSigner: false, isWritable: true },
      { pubkey: mintPubkey, isSigner: false, isWritable: false },
      { pubkey: routerSigner, isSigner: false, isWritable: false },
      { pubkey: vaultAta, isSigner: false, isWritable: true },
      { pubkey: rateLimitState, isSigner: false, isWritable: true },
      { pubkey: tokenRegistration, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
    ],
    data: Buffer.from(data)
  });

  const transaction = new Transaction().add(instruction);
  transaction.feePayer = payer;

  if (connection) {
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
  }

  return {
    instruction,
    transaction,
    accounts: { userAta, vaultAta, routerSigner, routerConfig, rateLimitState, tokenRegistration }
  };
}

// ============================================================================
// LOCK SOL (Native, Bridge to ZERA)
// ============================================================================

export interface LockSolResult {
  instruction: TransactionInstruction;
  transaction: Transaction;
  accounts: {
    payerWsolAta: PublicKey;
    vaultAta: PublicKey;
    routerSigner: PublicKey;
    routerConfig: PublicKey;
    rateLimitState: PublicKey;
    tokenPriceRegistry: PublicKey;
  };
}

/** wSOL mint address */
const WSOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');

/**
 * Build a Lock SOL transaction
 * 
 * Locks native SOL by wrapping to wSOL and depositing to the vault ATA.
 * Uses the same ATA-based pattern as lock_spl, with the wSOL mint hardcoded.
 */
export async function buildLockSolTransaction(
  options: LockSolOptions,
  payer: PublicKey,
  connection?: Connection
): Promise<LockSolResult> {
  const { amount, zeraAddress } = options;

  const [routerSigner] = deriveRouterSignerPDA();
  const [rateLimitState] = deriveRateLimitStatePDA();
  
  // Additional PDAs required by the on-chain program
  const [routerConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from('router_cfg')],
    CORE_PROGRAM_ID
  );
  const [tokenPriceRegistry] = PublicKey.findProgramAddressSync(
    [Buffer.from('token_price_registry')],
    TOKEN_BRIDGE_PROGRAM_ID
  );

  // wSOL ATAs
  const payerWsolAta = getATA(payer, WSOL_MINT);
  const vaultAta = getATA(routerSigner, WSOL_MINT);

  const amountBigInt = BigInt(amount);

  const data = concatBytes(
    generateDiscriminator('global:lock_sol'),
    encodeU64LE(amountBigInt),
    encodeBorshString(zeraAddress)
  );

  // Account order must match Rust reference exactly:
  // 1.  core_program (readonly)
  // 2.  router_cfg (readonly)
  // 3.  payer (signer, writable)
  // 4.  payer_wsol_ata (writable)
  // 5.  vault_ata (writable)
  // 6.  router_signer (readonly)
  // 7.  wsol_mint (readonly)
  // 8.  rate_limit_state (writable)
  // 9.  token_price_registry (readonly)
  // 10. token_program (readonly)
  // 11. associated_token_program (readonly)
  // 12. system_program (readonly)
  const instruction = new TransactionInstruction({
    programId: TOKEN_BRIDGE_PROGRAM_ID,
    keys: [
      { pubkey: CORE_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: routerConfig, isSigner: false, isWritable: false },
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: payerWsolAta, isSigner: false, isWritable: true },
      { pubkey: vaultAta, isSigner: false, isWritable: true },
      { pubkey: routerSigner, isSigner: false, isWritable: false },
      { pubkey: WSOL_MINT, isSigner: false, isWritable: false },
      { pubkey: rateLimitState, isSigner: false, isWritable: true },
      { pubkey: tokenPriceRegistry, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
    ],
    data: Buffer.from(data)
  });

  const transaction = new Transaction().add(instruction);
  transaction.feePayer = payer;

  if (connection) {
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
  }

  return {
    instruction,
    transaction,
    accounts: { payerWsolAta, vaultAta, routerSigner, routerConfig, rateLimitState, tokenPriceRegistry }
  };
}

