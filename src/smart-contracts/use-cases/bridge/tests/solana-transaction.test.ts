/**
 * Solana Bridge Transaction Builders Tests
 * 
 * Tests for the complete transaction builders that use @solana/web3.js.
 */

import { randomBytes } from 'crypto';

import { Keypair, PublicKey, Transaction } from '@solana/web3.js';
import bs58 from 'bs58';
import { describe, it, expect } from 'vitest';

import {
  buildReleaseSplTransaction,
  buildReleaseSolTransaction,
  buildLockSplTransaction,
  buildLockSolTransaction,
  buildBurnWrappedTransaction
} from '../solana/transactions/index.js';
import type { GuardianSignature } from '../solana/types.js';

// Mock data for testing
const MOCK_RECIPIENT = Keypair.generate().publicKey.toBase58();
const MOCK_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // USDC
const MOCK_TXN_ID = 'a'.repeat(64);
const MOCK_EXPECTED_HASH = 'b'.repeat(64);
const MOCK_PAYER = Keypair.generate().publicKey;
const MOCK_ZERA_ADDRESS = 'z1abc123def456';

// Mock guardian signature (64-byte sig, 32-byte public key)
const MOCK_SIGNATURES: GuardianSignature[] = [
  {
    signature: bs58.encode(randomBytes(64)),
    publicKey: bs58.encode(randomBytes(32))
  }
];

describe('Solana Bridge Transaction Builders', () => {
  describe('buildReleaseSplTransaction', () => {
    it('should build valid release SPL transaction structure', async () => {
      const result = await buildReleaseSplTransaction(
        {
          amount: BigInt(1000000),
          recipient: MOCK_RECIPIENT,
          mint: MOCK_MINT,
          txnId: MOCK_TXN_ID,
          timestamp: Math.floor(Date.now() / 1000),
          signatures: MOCK_SIGNATURES,
          expectedHash: MOCK_EXPECTED_HASH,
          usdPriceNano: BigInt(1e9),
          liquidityUsdNano: BigInt(1e12),
          tier: 1
        },
        MOCK_PAYER
      );

      expect(result.transaction).toBeInstanceOf(Transaction);
      expect(result.coreInstruction).toBeDefined();
      expect(result.tokenInstruction).toBeDefined();
      expect(result.signatureInstructions.length).toBeGreaterThanOrEqual(0);
      expect(result.accounts.recipientAta).toBeInstanceOf(PublicKey);
      expect(result.accounts.vaultAta).toBeInstanceOf(PublicKey);
      expect(result.accounts.usedMarker).toBeInstanceOf(PublicKey);
      expect(result.accounts.redeemedMarker).toBeInstanceOf(PublicKey);
    });

    it('should include correct number of instructions', async () => {
      const result = await buildReleaseSplTransaction(
        {
          amount: BigInt(1000000),
          recipient: MOCK_RECIPIENT,
          mint: MOCK_MINT,
          txnId: MOCK_TXN_ID,
          timestamp: Math.floor(Date.now() / 1000),
          signatures: MOCK_SIGNATURES,
          expectedHash: MOCK_EXPECTED_HASH,
          usdPriceNano: BigInt(1e9),
          liquidityUsdNano: BigInt(1e12),
          tier: 1
        },
        MOCK_PAYER
      );

      // Should have: signature verifications + core + token instructions
      const expectedCount = MOCK_SIGNATURES.length + 2;
      expect(result.transaction.instructions.length).toBe(expectedCount);
    });
  });

  describe('buildReleaseSolTransaction', () => {
    it('should build valid release SOL transaction structure', async () => {
      const result = await buildReleaseSolTransaction(
        {
          amount: BigInt(1e9), // 1 SOL in lamports
          recipient: MOCK_RECIPIENT,
          txnId: MOCK_TXN_ID,
          timestamp: Math.floor(Date.now() / 1000),
          signatures: MOCK_SIGNATURES,
          expectedHash: MOCK_EXPECTED_HASH,
          usdAmount: BigInt(1e9)
        },
        MOCK_PAYER
      );

      expect(result.transaction).toBeInstanceOf(Transaction);
      expect(result.coreInstruction).toBeDefined();
      expect(result.tokenInstruction).toBeDefined();
      expect(result.accounts.vault).toBeInstanceOf(PublicKey);
      expect(result.accounts.usedMarker).toBeInstanceOf(PublicKey);
      expect(result.accounts.redeemedMarker).toBeInstanceOf(PublicKey);
    });
  });

  describe('buildLockSplTransaction', () => {
    it('should build valid lock SPL transaction structure', async () => {
      const result = await buildLockSplTransaction(
        {
          amount: BigInt(1000000),
          zeraAddress: MOCK_ZERA_ADDRESS,
          mint: MOCK_MINT
        },
        MOCK_PAYER
      );

      expect(result.transaction).toBeInstanceOf(Transaction);
      expect(result.instruction).toBeDefined();
      expect(result.accounts.userAta).toBeInstanceOf(PublicKey);
      expect(result.accounts.vaultAta).toBeInstanceOf(PublicKey);
      expect(result.accounts.routerSigner).toBeInstanceOf(PublicKey);
    });

    it('should include ZERA address in instruction data', async () => {
      const result = await buildLockSplTransaction(
        {
          amount: BigInt(1000000),
          zeraAddress: MOCK_ZERA_ADDRESS,
          mint: MOCK_MINT
        },
        MOCK_PAYER
      );

      // Instruction data should contain the ZERA address
      expect(result.instruction.data.length).toBeGreaterThan(8 + MOCK_ZERA_ADDRESS.length);
    });

    it('should have single instruction in transaction', async () => {
      const result = await buildLockSplTransaction(
        {
          amount: BigInt(1000000),
          zeraAddress: MOCK_ZERA_ADDRESS,
          mint: MOCK_MINT
        },
        MOCK_PAYER
      );

      expect(result.transaction.instructions.length).toBe(1);
    });
  });

  describe('buildLockSolTransaction', () => {
    it('should build valid lock SOL transaction structure', async () => {
      const result = await buildLockSolTransaction(
        {
          amount: BigInt(1e9), // 1 SOL
          zeraAddress: MOCK_ZERA_ADDRESS
        },
        MOCK_PAYER
      );

      expect(result.transaction).toBeInstanceOf(Transaction);
      expect(result.instruction).toBeDefined();
      expect(result.accounts.vault).toBeInstanceOf(PublicKey);
    });
  });

  describe('buildBurnWrappedTransaction', () => {
    it('should build valid burn wrapped transaction structure', async () => {
      const result = await buildBurnWrappedTransaction(
        {
          amount: BigInt(1000000),
          wrappedMint: MOCK_MINT,
          zeraRecipient: MOCK_ZERA_ADDRESS
        },
        MOCK_PAYER
      );

      expect(result.transaction).toBeInstanceOf(Transaction);
      expect(result.instruction).toBeDefined();
      expect(result.accounts.wrappedMint).toBeInstanceOf(PublicKey);
      expect(result.accounts.userAta).toBeInstanceOf(PublicKey);
      expect(result.accounts.mintAuthority).toBeInstanceOf(PublicKey);
    });
  });

  describe('Transaction properties', () => {
    it('should set feePayer correctly', async () => {
      const result = await buildLockSplTransaction(
        {
          amount: BigInt(1000000),
          zeraAddress: MOCK_ZERA_ADDRESS,
          mint: MOCK_MINT
        },
        MOCK_PAYER
      );

      expect(result.transaction.feePayer?.toBase58()).toBe(MOCK_PAYER.toBase58());
    });

    it('should not have blockhash when no connection provided', async () => {
      const result = await buildLockSplTransaction(
        {
          amount: BigInt(1000000),
          zeraAddress: MOCK_ZERA_ADDRESS,
          mint: MOCK_MINT
        },
        MOCK_PAYER
      );

      expect(result.transaction.recentBlockhash).toBeUndefined();
    });
  });
});
