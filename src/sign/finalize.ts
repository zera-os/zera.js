/**
 * ZERA Transaction Signing
 *
 * All signing workflows for ZERA transactions in one place.
 *
 * ## Standard Transactions (Vote, Contract, SmartContract)
 * - `signAndFinalize(txn, signer)` — sign with any ZeraSigner
 * - `signWithKey(txn, privateKey, publicKeyId)` — sign with a private key
 *
 * ## CoinTXN (multi-input)
 * - `signCoinTXN(txn, signers[])` — sign with ZeraSigner instances
 * - `signCoinTXNWithKeys(txn, keys[])` — sign with private key pairs
 *
 * @module sign/finalize
 */

import { toBinary } from '@bufbuild/protobuf';

import type { BaseTXN, CoinTXN, TransferAuthentication } from '../../proto/generated/txn_pb.js';
import { getSchemaForTypeName } from '../adapter/serialization.js';
import { signTransactionData, createTransactionHash } from '../shared/crypto/signature-utils.js';

import type { ZeraSigner } from './signer.js';

// ============================================================================
// INTERNAL HELPER — Generic toBinary using schema registry
// ============================================================================

/**
 * Serialize any protobuf message to binary using its $typeName to look up the schema.
 * Falls back to the v1 .toBinary() instance method if the schema is not found.
 */
function messageToBytes(msg: unknown): Uint8Array {
  const typedMsg = msg as { $typeName?: string; toBinary?: () => Uint8Array };
  if (typedMsg.$typeName) {
    const schema = getSchemaForTypeName(typedMsg.$typeName);
    if (schema) {
      return toBinary(schema as any, msg as any);
    }
  }
  // Fallback: try v1 instance method
  if (typeof typedMsg.toBinary === 'function') {
    return typedMsg.toBinary();
  }
  throw new Error('Cannot serialize message: no $typeName found and no toBinary method');
}

// ============================================================================
// STANDARD TRANSACTIONS — External Signer
// ============================================================================

/**
 * Sign and finalize a standard transaction with a `ZeraSigner`.
 *
 * Works with GovernanceVote, SmartContractExecuteTXN, InstrumentContract,
 * ContractUpdateTXN, and any transaction that uses `BaseTXN`.
 *
 * @example
 * ```typescript
 * const signer = new KeyPairSigner(publicKey, privateKey);
 * const signed = await signAndFinalize(vote, signer);
 * ```
 */
export async function signAndFinalize<T extends { base?: BaseTXN }>(
  txn: T,
  signer: ZeraSigner
): Promise<T> {
  const bytes = messageToBytes(txn);
  const signature = await signer.sign(bytes);

  const baseData = (txn.base || {} as Partial<BaseTXN>) as BaseTXN;
  baseData.signature = signature;

  const signedBytes = messageToBytes(txn);
  baseData.hash = createTransactionHash(signedBytes);

  return txn;
}

// ============================================================================
// STANDARD TRANSACTIONS — Private Key
// ============================================================================

/**
 * Sign and hash a standard transaction with a private key.
 *
 * Combines signing + hashing in a single call. This is the convenience
 * method used by `createVoteTXN()`, `createContract()`, etc.
 *
 * @example
 * ```typescript
 * const txn = await buildVoteTXN(contractId, proposalId, publicKey);
 * signWithKey(txn, privateKey, publicKeyId);
 * ```
 */
export function signWithKey<T extends { base?: BaseTXN }>(
  txn: T,
  privateKey: string,
  publicKeyId: string
): T {
  // Sign
  const bytes = messageToBytes(txn);
  const signature = signTransactionData(bytes, privateKey, publicKeyId);
  const baseData = (txn.base || ({} as Partial<BaseTXN>)) as BaseTXN;
  baseData.signature = signature;

  // Hash
  const signedBytes = messageToBytes(txn);
  baseData.hash = createTransactionHash(signedBytes);

  return txn;
}

// ============================================================================
// COIN TXN — External Signer (multi-input)
// ============================================================================

/**
 * Sign a CoinTXN with one or more `ZeraSigner` instances.
 *
 * Each signer produces a signature. After all signatures are collected,
 * the transaction hash is computed.
 *
 * @example
 * ```typescript
 * const signer = new KeyPairSigner(publicKey, privateKey);
 * const signed = await signCoinTXN(unsigned, [signer]);
 * ```
 */
export async function signCoinTXN(
  txn: CoinTXN,
  signers: ZeraSigner[]
): Promise<CoinTXN> {
  if (!signers || signers.length === 0) {
    throw new Error('At least one signer is required');
  }

  const txnBytes = messageToBytes(txn);

  const authData = txn.auth || {} as Partial<TransferAuthentication>;
  if (!authData.signature) {
    authData.signature = [];
  }

  for (let i = 0; i < signers.length; i++) {
    const signer = signers[i];
    if (!signer) throw new Error(`Signer at index ${i} is undefined`);

    try {
      const signature = await signer.sign(txnBytes);
      authData.signature.push(signature);
    } catch (error) {
      throw new Error(`Failed to sign with signer ${i}: ${(error as Error).message}`);
    }
  }

  // Hash after all signatures
  const signedBytes = messageToBytes(txn);
  const baseData = (txn.base || {} as Partial<BaseTXN>) as BaseTXN;
  baseData.hash = createTransactionHash(signedBytes);

  return txn;
}

// ============================================================================
// COIN TXN — Private Keys (multi-input)
// ============================================================================

/** Key pair for CoinTXN signing (one per input) */
export interface CoinTXNKeyPair {
  publicKey: string;
  privateKey: string;
}

/**
 * Sign a CoinTXN with private key pairs (one per input).
 *
 * This is the convenience method used by `createCoinTXN()`.
 * Each key pair signs the serialized transaction bytes, and
 * the hash is computed after all signatures are collected.
 *
 * @example
 * ```typescript
 * const txn = await buildCoinTXN(inputs, outputs, '$ZRA+0000');
 * signCoinTXNWithKeys(txn, [
 *   { publicKey: 'ed25519:abc...', privateKey: '5Jd8...' }
 * ]);
 * ```
 */
export function signCoinTXNWithKeys(
  txn: CoinTXN,
  keys: CoinTXNKeyPair[]
): CoinTXN {
  if (!keys || keys.length === 0) {
    throw new Error('At least one key pair is required');
  }

  const txnBytes = messageToBytes(txn);

  const authData = txn.auth || {} as Partial<TransferAuthentication>;
  if (!authData.signature) {
    authData.signature = [];
  }

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (!key) throw new Error(`Key pair at index ${i} is undefined`);
    if (!key.privateKey || !key.publicKey) {
      throw new Error(`Key pair at index ${i} is missing privateKey or publicKey`);
    }

    try {
      const signature = signTransactionData(txnBytes, key.privateKey, key.publicKey);
      authData.signature.push(signature);
    } catch (error) {
      throw new Error(`Failed to sign with key ${i}: ${(error as Error).message}`);
    }
  }

  // Hash after all signatures
  const signedBytes = messageToBytes(txn);
  const baseData = (txn.base || {} as Partial<BaseTXN>) as BaseTXN;
  baseData.hash = createTransactionHash(signedBytes);

  return txn;
}
