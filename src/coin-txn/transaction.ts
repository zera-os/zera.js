/**
 * Transaction Module - CoinTXN
 * 
 * This module provides comprehensive functionality for creating and managing
 * CoinTXN transactions on the ZERA Network. It handles transaction creation,
 * signing, validation, and submission with full type safety and error handling.
 * 
 * @module CoinTXN
 * @version 1.0.0
 * @author ZERA Community
 * @since 1.0.0
 * 
 * @example
 * ```typescript
 * import { createCoinTXN, sendCoinTXN } from '@zera/sdk';
 * 
 * // Create a transaction
 * const transaction = await createCoinTXN(
 *   inputs,
 *   outputs,
 *   '$ZRA+0000',
 *   feeConfig
 * );
 * 
 * // Send the transaction
 * const txHash = await sendCoinTXN(transaction);
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
import { createTransactionClient } from '../grpc/transaction/transaction-client.js';
import { getPublicKeyBytes, generateAddressFromPublicKey, sanitizeAndDecodeAddress } from '../shared/crypto/address-utils.js';
import { signTransactionData } from '../shared/crypto/signature-utils.js';
import { UniversalFeeCalculator, type FeeConfig, type FeeConfigHelper } from '../shared/fee-calculators/universal-fee-calculator.js';
import { logger } from '../shared/monitoring/index.js';
import { addHash } from '../shared/tx/signing.js';
import { validateExactAmountBalance, Decimal } from '../shared/utils/amount-utils.js';
import { sanitizeProtobufObject } from '../shared/utils/protobuf-utils.js';
import { MAINNET_GRPC_CONFIG } from '../shared/utils/testing-defaults/index.js';
import { getTokenInfo, type TokenInfo } from '../shared/utils/token-info.js';
import { toSmallestUnits } from '../shared/utils/unified-amount-conversion.js';
import { isValidContractId } from '../shared/utils/validation.js';
import type {
  CoinTXNInput,
  CoinTXNOutput,
  GRPCConfig,
  AmountInput
} from '../types/index.js';

/**
 * Helper to convert Uint8Array to Hex
 */
function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Validates transaction inputs and outputs for basic requirements
 */
function validateTransactionRequirements(
  inputs: CoinTXNInput[], 
  outputs: CoinTXNOutput[], 
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

/**
 * Validates transaction balance (inputs must equal outputs)
 */
function validateTransactionBalance(
  inputs: CoinTXNInput[], 
  outputs: CoinTXNOutput[], 
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

  // Verify input and output amounts are exactly equal
  validateExactAmountBalance(inputAmounts, outputAmounts);
}

/**
 * Validates fee percentages sum to exactly 100%
 */
function validateFeePercentages(inputTransfers: InputTransfers[]): void {
  const totalFeePercent = inputTransfers.reduce((sum, t) => new Decimal(sum).add(t.feePercent), new Decimal(0));
  if (!totalFeePercent.equals(100000000)) {
    throw new Error(`Fee percentages must sum to exactly 100% (100,000,000). Current sum: ${totalFeePercent.toString()}`);
  }
}

/**
 * Process inputs and create authentication data
 */
async function processInputs(
  inputs: CoinTXNInput[],
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

  // Check if all inputs have manual nonces specified
  const allInputsHaveNonces = inputs.every(input => input.nonce !== undefined);
  if (allInputsHaveNonces) {
    logger.warn('Manual nonces specified for all inputs - skipping network nonce fetch. Nonces are not validated and incorrect values will cause transaction failure.', {
      operation: 'processInputs',
      inputCount: inputs.length
    });
  }

  // Extract addresses for nonce requests (only needed if we need to fetch nonces)
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

  // Get nonces - either from manual specification or network
  let nonceDecimals: Decimal[];
  if (allInputsHaveNonces) {
    // Use manually specified nonces - convert to Decimal for consistency
    nonceDecimals = inputs.map(input => new Decimal(String(input.nonce)));
  } else {
    // Fetch nonces from network
    nonceDecimals = await getNonces(addresses, grpcConfig);
  }

  // For allowance transactions, split the results more efficiently
  let allowanceNonceDecimals: Decimal[] = [];
  let allowanceAddresses: string[] = [];
  let finalNonceDecimals = nonceDecimals;

  if (isAllowance) {
    // Extract allowance data: everything from index 1 onwards (maintaining order)
    allowanceNonceDecimals = nonceDecimals.slice(1);
    allowanceAddresses = addresses.slice(1);

    // Keep only index 0 for the main transaction (non-allowance)
    finalNonceDecimals = nonceDecimals.slice(0, 1);
  }
  
  // Process each input
  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i];
    
    if (!input) {
      throw new Error(`Input at index ${i} is undefined`);
    }

    // Add public key for auth
    if (input.publicKey) {
      const publicKeyObj = new PublicKey({ single: new Uint8Array(getPublicKeyBytes(input.publicKey)) });
      publicKeys.push(publicKeyObj);
    } else if (!input.publicKey && !isAllowance) {
      throw new Error(`Input ${i} is missing publicKey`);
    } 

    // For allowance transactions, skip inputs with public keys since they're just authorizers
    if (isAllowance && input.publicKey) {
      continue;
    }
    
    // Create input transfer
    const inputTokenInfo = tokenInfoMap.get(contractID);
    
    // Check for undefined amount for allowance transactions
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
    
    const inputTransferData = {
      index: protoInt64.parse(i),
      amount: finalAmount,
      feePercent: parseInt(scaledFeePercent, 10)
    };
    
    inputTransfers.push(new InputTransfers(inputTransferData));
  }
  
  // Convert Decimal nonces to uint64 using protobuf utilities
  const nonces = finalNonceDecimals.map(nonce => protoInt64.uParse(nonce.toString()));
  
  // Parse allowance nonces to uint64 and handle empty arrays
  const allowanceNonces = allowanceNonceDecimals.length > 0 
    ? allowanceNonceDecimals.map(nonce => protoInt64.uParse(nonce.toString()))
    : null;
  
  const finalAllowanceAddresses = allowanceAddresses.length > 0 
    ? allowanceAddresses.map(addr => sanitizeAndDecodeAddress(addr)) 
    : null;
  
  return { publicKeys, inputTransfers, nonces, allowanceAddresses: finalAllowanceAddresses, allowanceNonces };
}

/**
 * Process outputs
 */
function processOutputs(
  outputs: CoinTXNOutput[], 
  tokenInfoMap: Map<string, TokenInfo>,
  contractId: string
): OutputTransfers[] {
  return outputs.map(output => {
    const outputTokenInfo = tokenInfoMap.get(contractId);
    const finalAmount = toSmallestUnits(output.amount, contractId, outputTokenInfo?.denomination 
      ? { denomination: outputTokenInfo.denomination }
      : {}
    );
    const data: {
      walletAddress: Uint8Array;
      amount?: string;
      memo?: string;
    } = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      walletAddress: new Uint8Array(sanitizeAndDecodeAddress(output.to) as any) as any
    };
    
    // Only include amount if it's not '0' or empty
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

/**
 * Create transfer authentication
 */
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

/**
 * Create base transaction for CoinTXN
 * Note: CoinTXN base only has timestamp, feeAmount, and feeId (no public key or nonce)
 */
function createBaseTransaction(baseFeeId: string = '$ZRA+0000', baseFee: AmountInput, baseMemo: string): BaseTXN {
  // Validate base fee is not 0
  if (!baseFee || baseFee === '0') {
    throw new Error('Base fee must be provided and cannot be 0');
  }

  const now = new Date();
  const timestamp = new Timestamp({
    seconds: protoInt64.parse(Math.floor(now.getTime() / 1000)),
    nanos: (now.getTime() % 1000) * 1000000
  });

  const baseData: {
    timestamp: Timestamp;
    feeAmount: string;
    feeId: string;
    memo?: string;
  } = {
    timestamp: timestamp,
    feeAmount: String(baseFee),
    feeId: baseFeeId
  };
  
  if (baseMemo && baseMemo.trim() !== '') {
    baseData.memo = baseMemo;
  }
  
  return new BaseTXN(baseData);
}

/**
 * Calculates fees for the transaction using UniversalFeeCalculator
 */
async function calculateTransactionFees(
  coinTxn: CoinTXN,
  feeConfig: FeeConfig,
  tokenInfoMap: Map<string, TokenInfo>
): Promise<CoinTXN> {
  try {
    const feeConfigHelper: FeeConfigHelper<CoinTXN> = {
      ...feeConfig,
      contractId: coinTxn.contractId,
      protoObject: coinTxn,
      tokenInfoMap
    };

    return await UniversalFeeCalculator.calculateFee(feeConfigHelper);
  } catch (error) {
    throw new Error(`Failed to calculate automatic fee: ${(error as Error).message}`);
  }
}

/**
 * Sanitizes and prepares the transaction for signing
 */
function sanitizeTransaction(coinTxn: CoinTXN): CoinTXN {
  // Sanitize the protobuf object here to eliminate any empty strings
  const sanitizedCoinTxnData = sanitizeProtobufObject(coinTxn, { removeEmptyFields: true });
  if (!sanitizedCoinTxnData) {
    throw new Error('Failed to sanitize transaction object');
  }
  // Reconstruct the CoinTXN object from sanitized data
   
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new CoinTXN(sanitizedCoinTxnData as any);}

/**
 * Signs the transaction with all required private keys
 */
function signTransaction(
  coinTxn: CoinTXN,
  signersArray: CoinTXNInput[]
): CoinTXN {
  // Sign transaction (without hash)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const serializedTxnWithoutHash = (coinTxn as any).toBinary();
  
  // Initialize signature array if it doesn't exist (field was not present initially)
  const authData = coinTxn.auth || {} as Partial<TransferAuthentication>;
  if (!authData.signature) {
    authData.signature = [];
  }
  
  for (let i = 0; i < signersArray.length; i++) {
    try {
      const signer = signersArray[i];
      if (!signer) {
        throw new Error(`Signer at index ${i} is undefined`);
      }
      if (!signer.privateKey || !signer.publicKey) {
        throw new Error(`Signer at index ${i} is missing privateKey or publicKey`);
      }
      const signature = signTransactionData(serializedTxnWithoutHash, signer.privateKey, signer.publicKey);
      authData.signature.push(signature); // Add signature directly to existing auth
    } catch (error) {
      throw new Error(`Failed to sign transaction with input ${i}: ${(error as Error).message}`);
    }
  }

  return coinTxn;
}


/**
 * Creates a CoinTXN transaction with inputs and outputs using exact decimal arithmetic.
 * 
 * This function handles the complete transaction creation process including:
 * - Input validation and processing
 * - Output validation and processing
 * - Nonce retrieval from the network
 * - Automatic fee calculation (if not provided)
 * - Transaction signing
 * - Hash generation
 * 
 * @param inputs - Array of transaction inputs containing private keys, amounts, and fee percentages
 * @param outputs - Array of transaction outputs containing recipient addresses and amounts
 * @param contractId - The contract ID for the transaction (e.g., '$ZRA+0000')
 * @param feeConfig - Optional fee configuration. If not provided, fees will be calculated automatically
 * @param baseMemo - Optional memo for the transaction
 * @param grpcConfig - Optional gRPC configuration for network communication
 * @returns Promise that resolves to a complete CoinTXN ready for submission
 * 
 * @example
 * ```typescript
 * const inputs: CoinTXNInput[] = [{
 *   privateKey: 'your-private-key',
 *   publicKey: 'your-public-key',
 *   amount: '10.5',
 *   feePercent: '100'
 * }];
 * 
 * const outputs: CoinTXNOutput[] = [{
 *   to: 'recipient-address',
 *   amount: '10.0',
 *   memo: 'Payment for services'
 * }];
 * 
 * const transaction = await createCoinTXN(
 *   inputs,
 *   outputs,
 *   '$ZRA+0000',
 *   { baseFeeId: '$ZRA+0000' },
 *   'Transaction memo'
 * );
 * ```
 * 
 * @throws {ValidationError} When inputs, outputs, or contract ID are invalid
 * @throws {NetworkError} When network communication fails
 * @throws {CryptoError} When cryptographic operations fail
 * @throws {TransactionError} When transaction creation fails
 * 
 * @since 1.0.0
 */
export async function createCoinTXN(
  inputs: CoinTXNInput[], 
  outputs: CoinTXNOutput[], 
  contractId: string, 
  feeConfig: FeeConfig = { baseFeeId: '$ZRA+0000' }, 
  baseMemo: string = '', 
  grpcConfig: GRPCConfig = MAINNET_GRPC_CONFIG
): Promise<CoinTXN> {
  // Validate basic transaction requirements
  validateTransactionRequirements(inputs, outputs, contractId);

  // Get all required token info in a single optimized call
  const tokenInfoMap = await getTokenInfo(contractId, [feeConfig.contractFeeId, feeConfig.interfaceFeeId, feeConfig.baseFeeId].filter((id): id is string => Boolean(id)), grpcConfig);

  // Process inputs (includes nonce generation)
  const { publicKeys, inputTransfers, nonces, allowanceAddresses, allowanceNonces } = await processInputs(inputs, contractId, tokenInfoMap, grpcConfig);

  // Used for signatures at bottom, accounts for allowance inputs (filtered to exclude allowance-based inputs)
  const signersArray = JSON.parse(JSON.stringify(inputs)).filter((input: CoinTXNInput) => !input.allowanceAddress);

  // If allowance, remove them from input
  if (allowanceAddresses && allowanceAddresses.length > 0) {    
    // Remove index 0 from inputs (allowance authorizer)
    inputs.splice(0, 1);
  }

  // Process outputs
  const outputTransfers = processOutputs(outputs, tokenInfoMap, contractId);

  // Validate transaction balance
  validateTransactionBalance(inputs, outputs, contractId, tokenInfoMap);

  // Validate fee percentages
  validateFeePercentages(inputTransfers);

  // Create a temporary transaction without fees for size calculation
  const initialTxnBase = createBaseTransaction(feeConfig.baseFeeId, '1', baseMemo); // Use 1 fee temporarily
  const initialCoinTxnData: Partial<CoinTXN> = {
    base: initialTxnBase,
    contractId,
    auth: createTransferAuth(publicKeys, [], nonces, allowanceAddresses, allowanceNonces), // No signatures initially
    inputTransfers,
    outputTransfers
  };

  // Calculate fees
  let coinTxn = new CoinTXN(initialCoinTxnData);
  coinTxn = await calculateTransactionFees(coinTxn, feeConfig, tokenInfoMap);
  
  // Sanitize transaction
  coinTxn = sanitizeTransaction(coinTxn);
  
  // Sign transaction
  coinTxn = signTransaction(coinTxn, signersArray);

  // Add transaction hash
  coinTxn = addHash(coinTxn);

  return coinTxn;
}

/**
 * Sends a CoinTXN transaction to the ZERA Network via gRPC.
 * 
 * This function submits a completed transaction to the network for processing.
 * The transaction must be properly signed and have a valid hash before submission.
 * 
 * @param coinTxn - The complete CoinTXN transaction to submit
 * @param grpcConfig - Optional gRPC configuration for network communication
 * @returns Promise that resolves to the transaction hash on successful submission
 * 
 * @example
 * ```typescript
 * const transaction = await createCoinTXN(inputs, outputs, '$ZRA+0000');
 * const txHash = await sendCoinTXN(transaction);
 * ```
 * 
 * @throws {NetworkError} When network communication fails
 * @throws {TransactionError} When transaction submission fails
 * @throws {ValidationError} When transaction is invalid or incomplete
 * 
 * @since 1.0.0
 */
export async function sendCoinTXN(coinTxn: CoinTXN, grpcConfig: GRPCConfig = {}): Promise<string> {
  try {
    const client = createTransactionClient(grpcConfig);
    const _response = await client.submitCoinTransaction(coinTxn);
    
    // Return transaction hash on success
    return coinTxn.base?.hash ? 
      toHex(coinTxn.base.hash) : 
      'Transaction sent successfully (no hash available)';
  } catch (error) {
    // Preserve the original error type for proper error handling
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to submit coin transaction: ${(error as Error).message}`);
  }
}
