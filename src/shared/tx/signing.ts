/**
 * Shared signing and hashing helpers for standard (non-CoinTXN) transactions
 */

import type { BaseTXN } from '../../../proto/generated/txn_pb.js';
import { signTransactionData, createTransactionHash } from '../../shared/crypto/signature-utils.js';

/**
 * Sign a standard transaction: serializes, signs, and writes signature to base
 */
export function signStandardTXN<T extends { base?: BaseTXN }>(
  txn: T,
  params: { privateKey: string; publicKeyId: string }
): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bytes = (txn as any).toBinary();
  const signature = signTransactionData(bytes, params.privateKey, params.publicKeyId);
  const baseData = (txn.base || ({} as Partial<BaseTXN>)) as BaseTXN;
  baseData.signature = signature;
  return txn;
}

/**
 * Add a transaction hash: serializes (with signature) and writes hash to base
 */
export function addHash<T extends { base?: BaseTXN }>(txn: T): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bytes = (txn as any).toBinary();
  const hash = createTransactionHash(bytes);
  const baseData = (txn.base || ({} as Partial<BaseTXN>)) as BaseTXN;
  baseData.hash = hash;
  return txn;
}


