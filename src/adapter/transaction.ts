/**
 * Wallet Adapter - Transaction Building & Signing
 *
 * Provides functions to build unsigned transactions and finalize them
 * with an external signer. This decouples transaction construction from
 * signing, enabling browser wallets, hardware wallets, and other external
 * signers to participate in the ZERA transaction lifecycle.
 *
 * @module adapter/transaction
 *
 * @example
 * ```typescript
 * import {
 *   buildUnsignedCoinTXN,
 *   signCoinTXN,
 *   signAndFinalize,
 *   KeyPairSigner
 * } from '@zera-os/zera.js';
 *
 * // 1. Build unsigned transaction (no private keys needed)
 * const unsigned = await buildUnsignedCoinTXN(inputs, outputs, '$ZRA+0000');
 *
 * // 2. Sign with any ZeraSigner implementation
 * const signer = new KeyPairSigner(publicKey, privateKey);
 * const signed = await signCoinTXN(unsigned, [signer]);
 *
 * // 3. Send it
 * const hash = await sendCoinTXN(signed);
 * ```
 */

import { protoInt64 } from '@bufbuild/protobuf';

import { Timestamp } from '../../proto/generated/google/protobuf/timestamp_pb.js';
import {
  CoinTXN,
  InputTransfers,
  OutputTransfers,
  BaseTXN,
  TransferAuthentication,
  PublicKey
} from '../../proto/generated/txn_pb.js';
import { getNonces } from '../api/handler/nonce/service.js';
import { getPublicKeyBytes, generateAddressFromPublicKey, sanitizeAndDecodeAddress } from '../shared/crypto/address-utils.js';
import { createTransactionHash } from '../shared/crypto/signature-utils.js';
import { UniversalFeeCalculator, type FeeConfig, type FeeConfigHelper } from '../shared/fee-calculators/universal-fee-calculator.js';
import { logger } from '../shared/monitoring/index.js';
import { signStandardTXN, addHash } from '../shared/tx/signing.js';
import { validateExactAmountBalance, Decimal } from '../shared/utils/amount-utils.js';
import { sanitizeProtobufObject } from '../shared/utils/protobuf-utils.js';
import { MAINNET_GRPC_CONFIG } from '../shared/utils/testing-defaults/index.js';
import { getTokenInfo, type TokenInfo } from '../shared/utils/token-info.js';
import { toSmallestUnits } from '../shared/utils/unified-amount-conversion.js';
import { isValidContractId } from '../shared/utils/validation.js';
import type {
  GRPCConfig,
  AmountInput
} from '../types/index.js';

import type { ZeraSigner } from './signer.js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Input for building an unsigned CoinTXN.
 * Unlike `CoinTXNInput`, private keys are NOT required.
 */
export interface UnsignedCoinTXNInput {
  /** Base58-encoded public key identifier (required) */
  publicKey?: string;
  /** Amount to spend (user-friendly format) */
  amount?: AmountInput;
  /** Fee percentage (default: '100') */
  feePercent?: string;
  /** Allowance address (for allowance transactions) */
  allowanceAddress?: string;
  /**
   * Optional nonce override. When provided, skips network nonce fetch for this input.
   * WARNING: Manually specified nonces are not validated.
   */
  nonce?: string | number | bigint;
}

// ============================================================================
// INTERNAL HELPERS (mirrored from coin-txn/transaction.ts without signing)
// ============================================================================

function validateTransactionRequirements(
  inputs: UnsignedCoinTXNInput[],
  outputs: { to: string; amount: AmountInput; memo?: string }[],
  contractId: string
): void {
  if (!Array.isArray(inputs) || !Array.isArray(outputs)) {
    throw new Error('Inputs and outputs must be arrays');
  }
  if (inputs.length === 0 || outputs.length === 0) {
    throw new Error('Must have at least one input and one output');
  }
  if (!contractId || !isValidContractId(contractId)) {
    throw new Error('ContractId must be provided and follow the format $[letters]+[4 digits] (e.g., $ZRA+0000)');
  }
}

function validateTransactionBalance(
  inputs: UnsignedCoinTXNInput[],
  outputs: { to: string; amount: AmountInput; memo?: string }[],
  contractId: string,
  tokenInfoMap: Map<string, TokenInfo>
): void {
  const mainTokenInfo = tokenInfoMap.get(contractId);
  const inputAmounts = inputs.map(i => {
    if (!i.amount) {
      throw new Error(`Input at index ${inputs.indexOf(i)} must have a defined amount`);
    }
    return toSmallestUnits(i.amount, contractId, mainTokenInfo?.denomination
      ? { denomination: mainTokenInfo.denomination }
      : {}
    );
  });
  const outputAmounts = outputs.map(o => toSmallestUnits(o.amount, contractId, mainTokenInfo?.denomination
    ? { denomination: mainTokenInfo.denomination }
    : {}
  ));
  validateExactAmountBalance(inputAmounts, outputAmounts);
}

function validateFeePercentages(inputTransfers: InputTransfers[]): void {
  const totalFeePercent = inputTransfers.reduce((sum, t) => new Decimal(sum).add(t.feePercent), new Decimal(0));
  if (!totalFeePercent.equals(100000000)) {
    throw new Error(`Fee percentages must sum to exactly 100% (100,000,000). Current sum: ${totalFeePercent.toString()}`);
  }
}

async function processUnsignedInputs(
  inputs: UnsignedCoinTXNInput[],
  contractID: string,
  tokenInfoMap: Map<string, TokenInfo>,
  grpcConfig: GRPCConfig = {}
): Promise<{
  publicKeys: PublicKey[];
  inputTransfers: InputTransfers[];
  nonces: bigint[];
  allowanceAddresses: Uint8Array[] | null;
  allowanceNonces: bigint[] | null;
}> {
  const publicKeys: PublicKey[] = [];
  const inputTransfers: InputTransfers[] = [];
  const addresses: string[] = [];
  let isAllowance = false;

  const allInputsHaveNonces = inputs.every(input => input.nonce !== undefined);
  if (allInputsHaveNonces) {
    logger.warn('Manual nonces specified for all inputs - skipping network nonce fetch.', {
      operation: 'processUnsignedInputs',
      inputCount: inputs.length
    });
  }

  for (const input of inputs) {
    if (!input.publicKey && !input.allowanceAddress) {
      throw new Error(`Input ${inputs.indexOf(input)} is missing publicKey`);
    } else if (input.allowanceAddress) {
      isAllowance = true;
    }

    let address = '';
    if (input.publicKey) {
      address = generateAddressFromPublicKey(input.publicKey);
    } else if (input.allowanceAddress) {
      address = input.allowanceAddress;
    } else {
      throw new Error(`Input ${inputs.indexOf(input)} is missing or using unsupported publicKey type`);
    }
    addresses.push(address);
  }

  let nonceDecimals: Decimal[];
  if (allInputsHaveNonces) {
    nonceDecimals = inputs.map(input => new Decimal(String(input.nonce)));
  } else {
    nonceDecimals = await getNonces(addresses, grpcConfig);
  }

  let allowanceNonceDecimals: Decimal[] = [];
  let allowanceAddresses: string[] = [];
  let finalNonceDecimals = nonceDecimals;

  if (isAllowance) {
    allowanceNonceDecimals = nonceDecimals.slice(1);
    allowanceAddresses = addresses.slice(1);
    finalNonceDecimals = nonceDecimals.slice(0, 1);
  }

  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i];
    if (!input) throw new Error(`Input at index ${i} is undefined`);

    if (input.publicKey) {
      const publicKeyObj = new PublicKey({ single: new Uint8Array(getPublicKeyBytes(input.publicKey)) });
      publicKeys.push(publicKeyObj);
    } else if (!input.publicKey && !isAllowance) {
      throw new Error(`Input ${i} is missing publicKey`);
    }

    if (isAllowance && input.publicKey) continue;

    const inputTokenInfo = tokenInfoMap.get(contractID);

    if (!input.amount && input.allowanceAddress) {
      throw new Error(`Allowance input at index ${i} must specify an amount`);
    }
    if (!input.amount) {
      throw new Error(`Input at index ${i} must specify an amount`);
    }

    const finalAmount = toSmallestUnits(input.amount, contractID, inputTokenInfo?.denomination
      ? { denomination: inputTokenInfo.denomination }
      : {}
    );
    const feePercent = input.feePercent !== undefined ? input.feePercent : '100';
    const scaledFeePercent = new Decimal(feePercent).mul(1000000).toFixed(0);

    inputTransfers.push(new InputTransfers({
      index: protoInt64.parse(i),
      amount: finalAmount,
      feePercent: parseInt(scaledFeePercent, 10)
    }));
  }

  const nonces = finalNonceDecimals.map(nonce => protoInt64.uParse(nonce.toString()));

  const allowanceNonces = allowanceNonceDecimals.length > 0
    ? allowanceNonceDecimals.map(nonce => protoInt64.uParse(nonce.toString()))
    : null;

  const finalAllowanceAddresses = allowanceAddresses.length > 0
    ? allowanceAddresses.map(addr => sanitizeAndDecodeAddress(addr))
    : null;

  return { publicKeys, inputTransfers, nonces, allowanceAddresses: finalAllowanceAddresses, allowanceNonces };
}

function processOutputs(
  outputs: { to: string; amount: AmountInput; memo?: string }[],
  tokenInfoMap: Map<string, TokenInfo>,
  contractId: string
): OutputTransfers[] {
  return outputs.map(output => {
    const outputTokenInfo = tokenInfoMap.get(contractId);
    const finalAmount = toSmallestUnits(output.amount, contractId, outputTokenInfo?.denomination
      ? { denomination: outputTokenInfo.denomination }
      : {}
    );
    const data: { walletAddress: Uint8Array; amount?: string; memo?: string } = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      walletAddress: new Uint8Array(sanitizeAndDecodeAddress(output.to) as any) as any
    };
    if (finalAmount && finalAmount !== '0') {
      data.amount = finalAmount;
    }
    if (output.memo && output.memo.trim() !== '') {
      data.memo = output.memo;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new OutputTransfers(data as any);
  });
}

function createBaseTransaction(baseFeeId: string = '$ZRA+0000', baseFee: AmountInput, baseMemo: string): BaseTXN {
  if (!baseFee || baseFee === '0') {
    throw new Error('Base fee must be provided and cannot be 0');
  }

  const now = new Date();
  const timestamp = new Timestamp({
    seconds: protoInt64.parse(Math.floor(now.getTime() / 1000)),
    nanos: (now.getTime() % 1000) * 1000000
  });

  const baseData: { timestamp: Timestamp; feeAmount: string; feeId: string; memo?: string } = {
    timestamp: timestamp,
    feeAmount: String(baseFee),
    feeId: baseFeeId
  };
  if (baseMemo && baseMemo.trim() !== '') {
    baseData.memo = baseMemo;
  }
  return new BaseTXN(baseData);
}

function createTransferAuth(
  publicKeys: PublicKey[],
  signatures: Uint8Array[],
  nonces: bigint[],
  allowanceAddresses: Uint8Array[] | null = null,
  allowanceNonces: bigint[] | null = null
): TransferAuthentication {
  const authData: {
    publicKey?: PublicKey[];
    signature?: Uint8Array[];
    nonce?: bigint[];
    allowanceAddress?: Uint8Array[];
    allowanceNonce?: bigint[];
  } = {};
  if (publicKeys && publicKeys.length > 0) authData.publicKey = publicKeys;
  if (nonces && nonces.length > 0) authData.nonce = nonces;
  if (signatures && signatures.length > 0) authData.signature = signatures;
  if (allowanceAddresses && allowanceAddresses.length > 0) authData.allowanceAddress = allowanceAddresses;
  if (allowanceNonces && allowanceNonces.length > 0) authData.allowanceNonce = allowanceNonces;
  return new TransferAuthentication(authData);
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ============================================================================
// PUBLIC API — UNSIGNED BUILDERS
// ============================================================================

/**
 * Build an unsigned CoinTXN.
 *
 * Performs all the same validation, nonce fetching, and fee calculation
 * as `createCoinTXN`, but **stops before signing**. The returned transaction
 * has no signatures and no hash — it is ready to be signed externally.
 *
 * @param inputs   - Transaction inputs (publicKey + amount, no private key needed)
 * @param outputs  - Transaction outputs (recipient + amount)
 * @param contractId - Contract ID (e.g., '$ZRA+0000')
 * @param feeConfig  - Fee configuration
 * @param baseMemo   - Optional memo
 * @param grpcConfig - Optional gRPC configuration
 * @returns An unsigned `CoinTXN` protobuf (no signatures, no hash)
 *
 * @example
 * ```typescript
 * const unsigned = await buildUnsignedCoinTXN(
 *   [{ publicKey: 'ed25519:9Xk3...', amount: '10.5' }],
 *   [{ to: 'recipient-address', amount: '10.0' }],
 *   '$ZRA+0000'
 * );
 * ```
 */
export async function buildUnsignedCoinTXN(
  inputs: UnsignedCoinTXNInput[],
  outputs: { to: string; amount: AmountInput; memo?: string }[],
  contractId: string,
  feeConfig: FeeConfig = { baseFeeId: '$ZRA+0000' },
  baseMemo: string = '',
  grpcConfig: GRPCConfig = MAINNET_GRPC_CONFIG
): Promise<CoinTXN> {
  // Validate
  validateTransactionRequirements(inputs, outputs, contractId);

  const tokenInfoMap = await getTokenInfo(
    contractId,
    [feeConfig.contractFeeId, feeConfig.interfaceFeeId, feeConfig.baseFeeId].filter((id): id is string => Boolean(id)),
    grpcConfig
  );

  // Process inputs (without private keys)
  const inputsCopy = inputs.map(i => ({ ...i }));
  const { publicKeys, inputTransfers, nonces, allowanceAddresses, allowanceNonces } = await processUnsignedInputs(
    inputsCopy, contractId, tokenInfoMap, grpcConfig
  );

  // Filter inputs for validation (remove allowance authorizers)
  const validationInputs = allowanceAddresses && allowanceAddresses.length > 0
    ? inputsCopy.slice(1)
    : inputsCopy;

  const outputTransfers = processOutputs(outputs, tokenInfoMap, contractId);

  validateTransactionBalance(validationInputs, outputs, contractId, tokenInfoMap);
  validateFeePercentages(inputTransfers);

  // Build unsigned transaction
  const initialTxnBase = createBaseTransaction(feeConfig.baseFeeId, '1', baseMemo);
  const initialCoinTxnData: Partial<CoinTXN> = {
    base: initialTxnBase,
    contractId,
    auth: createTransferAuth(publicKeys, [], nonces, allowanceAddresses, allowanceNonces),
    inputTransfers,
    outputTransfers
  };

  let coinTxn = new CoinTXN(initialCoinTxnData);

  // Calculate fees
  const feeConfigHelper: FeeConfigHelper<CoinTXN> = {
    ...feeConfig,
    ...(grpcConfig && !feeConfig.grpcConfig ? { grpcConfig } : {}),
    contractId: coinTxn.contractId,
    protoObject: coinTxn,
    tokenInfoMap
  };
  coinTxn = await UniversalFeeCalculator.calculateFee(feeConfigHelper);

  // Sanitize
  const sanitizedData = sanitizeProtobufObject(coinTxn, { removeEmptyFields: true });
  if (!sanitizedData) throw new Error('Failed to sanitize transaction object');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  coinTxn = new CoinTXN(sanitizedData as any);

  // Return unsigned — no signatures, no hash
  return coinTxn;
}

// ============================================================================
// PUBLIC API — SIGNING
// ============================================================================

/**
 * Sign an unsigned CoinTXN with one or more `ZeraSigner` instances.
 *
 * Each signer produces a signature over the serialized transaction bytes.
 * After all signatures are added, the transaction hash is computed and set.
 *
 * @param unsignedTxn - The unsigned CoinTXN from `buildUnsignedCoinTXN`
 * @param signers     - Array of `ZeraSigner` instances (one per input that requires signing)
 * @returns A fully signed and hashed `CoinTXN` ready for submission
 *
 * @example
 * ```typescript
 * const signer = new KeyPairSigner(publicKey, privateKey);
 * const signed = await signCoinTXN(unsigned, [signer]);
 * const hash = await sendCoinTXN(signed);
 * ```
 */
export async function signCoinTXN(
  unsignedTxn: CoinTXN,
  signers: ZeraSigner[]
): Promise<CoinTXN> {
  if (!signers || signers.length === 0) {
    throw new Error('At least one signer is required');
  }

  // Serialize transaction bytes (without any existing signatures)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const txnBytes = (unsignedTxn as any).toBinary();

  // Initialize signature array
  const authData = unsignedTxn.auth || {} as Partial<TransferAuthentication>;
  if (!authData.signature) {
    authData.signature = [];
  }

  // Sign with each signer
  for (let i = 0; i < signers.length; i++) {
    const signer = signers[i];
    if (!signer) throw new Error(`Signer at index ${i} is undefined`);

    try {
      const signature = await signer.sign(txnBytes);
      authData.signature.push(signature);
    } catch (error) {
      throw new Error(`Failed to sign transaction with signer ${i}: ${(error as Error).message}`);
    }
  }

  // Add transaction hash
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const signedBytes = (unsignedTxn as any).toBinary();
  const hash = createTransactionHash(signedBytes);
  const baseData = (unsignedTxn.base || {} as Partial<BaseTXN>) as BaseTXN;
  baseData.hash = hash;

  return unsignedTxn;
}

/**
 * Sign and finalize a standard (non-CoinTXN) transaction with a single `ZeraSigner`.
 *
 * Works with GovernanceVote, SmartContractExecuteTXN, and any other transaction
 * type that uses the standard `BaseTXN` structure.
 *
 * @param unsignedTxn - The unsigned protobuf transaction
 * @param signer      - A `ZeraSigner` implementation
 * @returns The signed and hashed transaction
 *
 * @example
 * ```typescript
 * const signer = new KeyPairSigner(publicKey, privateKey);
 * const signed = await signAndFinalize(unsignedVote, signer);
 * ```
 */
export async function signAndFinalize<T extends { base?: BaseTXN }>(
  unsignedTxn: T,
  signer: ZeraSigner
): Promise<T> {
  // Serialize to bytes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bytes = (unsignedTxn as any).toBinary();

  // Sign
  const signature = await signer.sign(bytes);

  // Set signature on base
  const baseData = (unsignedTxn.base || {} as Partial<BaseTXN>) as BaseTXN;
  baseData.signature = signature;

  // Add hash
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const signedBytes = (unsignedTxn as any).toBinary();
  const hash = createTransactionHash(signedBytes);
  baseData.hash = hash;

  return unsignedTxn;
}
