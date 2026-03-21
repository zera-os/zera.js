/**
 * Shared utilities for standard (non-CoinTXN) transactions
 */

import { protoInt64, create } from '@bufbuild/protobuf';

import { TimestampSchema } from '../../../proto/generated/google/protobuf/timestamp_pb.js';
import { BaseTXNSchema, PublicKeySchema } from '../../../proto/generated/txn_pb.js';
import type { BaseTXN } from '../../../proto/generated/txn_pb.js';
import { getNonce as fetchNonce } from '../../api/handler/nonce/service.js';
import { generateAddressFromPublicKey, getPublicKeyBytes } from '../../shared/crypto/address-utils.js';
import type { GRPCConfig } from '../../types/index.js';

/**
 * Build a standard BaseTXN (includes public key and nonce)
 */
export function buildStandardBaseTXN(
  params: {
    publicKeyId: string;
    feeId?: string;
    feeAmountParts?: string;
    nonce: bigint;
    memo?: string;
  }
): BaseTXN {
  const { publicKeyId, nonce, memo } = params;
  const finalFeeId = params.feeId || '$ZRA+0000';
  const finalFeeAmount = params.feeAmountParts || '1';
  if (!finalFeeAmount || finalFeeAmount === '0') {
    throw new Error('Base fee must be provided and cannot be 0');
  }

  const now = new Date();
  const timestamp = create(TimestampSchema, {
    seconds: protoInt64.parse(Math.floor(now.getTime() / 1000)),
    nanos: (now.getTime() % 1000) * 1000000
  });

  const publicKey = create(PublicKeySchema, {
    single: new Uint8Array(getPublicKeyBytes(publicKeyId))
  });

  const base: Record<string, unknown> = {
    publicKey,
    timestamp,
    feeAmount: String(finalFeeAmount),
    feeId: finalFeeId,
    nonce
  };
  if (memo && memo.trim() !== '') base.memo = memo;

  return create(BaseTXNSchema, base);
}

/**
 * Derive address from public key identifier and fetch its nonce
 */
export async function getAddressAndNonce(
  publicKeyId: string,
  grpcConfig: GRPCConfig = {}
): Promise<{ address: string; nonce: bigint }> {
  const address = generateAddressFromPublicKey(publicKeyId);
  const nonceDecimal = await fetchNonce(address, grpcConfig);
  const nonce = protoInt64.uParse(nonceDecimal.toString());
  return { address, nonce };
}
