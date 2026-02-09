/**
 * Base Fee Constants
 * Network fee calculation constants for different transaction types, key types, and hash operations
 * These are fallback values for when remote data is not available
 */

import { KEY_TYPE, HASH_TYPE } from '../crypto/constants.js';
import { TRANSACTION_TYPE } from '../protobuf/index.js';

/**
 * Signature sizes for different key types
 */
export const SIGNATURE_SIZES = {
  ED25519: 64,  // Ed25519 signature size in bytes
  ED448: 114     // Ed448 signature size in bytes
} as const;

/**
 * Hash sizes for different hash types
 */
export const HASH_SIZES = {
  SHA3_256: 32,  // SHA3-256 hash size in bytes
  SHA3_512: 64,  // SHA3-512 hash size in bytes  
  BLAKE3: 32     // BLAKE3 hash size in bytes (typically 32 bytes)
} as const;

export const HASH_SIZE = HASH_SIZES.SHA3_256; // TXN Hash size

/**
 * Calculate protobuf overhead for bytes fields (hash / signature)
 */
export const PROTOBUF_HASH_OVERHEAD = 2;
export const PROTOBUF_BASE_SIGNATURE_OVERHEAD = 2;
export const PROTOBUF_AUTH_SIGNATURE_OVERHEAD = 2;


/**
 * Get fee calculation constants for external use
 */
export function getFeeConstants(): typeof FEE_CONSTANTS {
  return { ...FEE_CONSTANTS };
}

/**
 * Update fee calculation constants
 */
export function updateFeeConstants(newConstants: Partial<typeof FEE_CONSTANTS>): void {
  Object.assign(FEE_CONSTANTS, newConstants);
}

/**
 * Get signature size for a key type
 */
export function getSignatureSize(keyType: string, _hashType?: string): number {
  if (keyType === KEY_TYPE.ED25519) {
    return SIGNATURE_SIZES.ED25519;
  } else if (keyType === KEY_TYPE.ED448) {
    return SIGNATURE_SIZES.ED448;
  } else {
    // Default to Ed25519 size
    return SIGNATURE_SIZES.ED25519;
  }
}

/**
 * Get hash size for a hash type
 */
export function getHashSize(hashType: string): number {
  switch (hashType) {
  case HASH_TYPE.SHA3_256:
    return HASH_SIZES.SHA3_256;
  case HASH_TYPE.SHA3_512:
    return HASH_SIZES.SHA3_512;
  case HASH_TYPE.BLAKE3:
    return HASH_SIZES.BLAKE3;
  default:
    return HASH_SIZE; // Default to SHA3-256
  }
}

/**
 * Comprehensive Fee Constants
 * All fee calculation constants organized by category
 * These are fallback values for when remote data is not available
 */
export const FEE_CONSTANTS = {
  // ===== RESTRICTED KEY FEES =====
  // Multiplier applied to key/hash fees when using restricted keys
  RESTRICTED_KEY_MULTIPLIER: 3.0,          // 3x multiplier on key/hash fees

  // ===== KEY FEES (Fixed Cost) =====
  // Fixed fees for different key types (in USD cents)
  ED25519_KEY_FEE: 0.02,                   // 2 cents for ED25519 keys (A_ prefix)
  ED448_KEY_FEE: 0.05,                     // 5 cents for ED448 keys (B_ prefix)

  // ===== HASH FEES (Fixed Cost) =====
  // Fixed fees for different hash types (in USD cents)
  SHA3_256_HASH_FEE: 0.02,                 // 2 cents for SHA3-256 (a_ prefix)
  SHA3_512_HASH_FEE: 0.05,                 // 5 cents for SHA3-512 (b_ prefix)
  BLAKE3_HASH_FEE: 0.01,                   // 1 cent for BLAKE3 (c_ prefix)
  CUSTOM_HASH_D_FEE: 0.50,                 // 50 cents for custom hash D (d_ prefix)
  CUSTOM_HASH_E_FEE: 1.00,                 // $1.00 for custom hash E (e_ prefix)
  CUSTOM_HASH_F_FEE: 2.00,                 // $2.00 for custom hash F (f_ prefix)
  CUSTOM_HASH_G_FEE: 4.00,                 // $4.00 for custom hash G (g_ prefix)
  CUSTOM_HASH_DBZ_FEE: 9.01,               // $9.01 for custom hash DBZ (dbz_ prefix)
  CUSTOM_HASH_H_FEE: 2.00,                 // $2.00 for custom hash H (h_ prefix)
  CUSTOM_HASH_I_FEE: 4.00,                 // $4.00 for custom hash I (i_ prefix)
  CUSTOM_HASH_J_FEE: 8.00,                 // $8.00 for custom hash J (j_ prefix)

  // ===== TRANSACTION TYPE FEES (Cost Per Byte) =====
  // Per-byte fees for different transaction types (in USD cents per byte)
  COIN_TXN_FEE: 0.00015,                   // 0.015 cents per byte - Basic coin transfers
  MINT_TXN_FEE: 0.001,                     // 0.1 cents per byte - Token minting
  FOUNDATION_TXN_FEE: 0.0001,              // 0.01 cents per byte - Foundation transactions
  ITEM_MINT_TXN_FEE: 0.001,                // 0.1 cents per byte - Itemized minting
  CONTRACT_TXN_FEE: 0.00086,                 // 0.086 cents per byte - Contract creation
  VOTE_TXN_FEE: 0.0001,                    // 0.01 cents per byte - Governance voting
  PROPOSAL_TXN_FEE: 0.005,                 // 0.5 cents per byte - Governance proposals
  SMART_CONTRACT_DEPLOYMENT_FEE: 0.0004,   // 0.04 cents per byte - Smart contract deployment
  SMART_CONTRACT_EXECUTE_FEE: 0.0015,      // 0.15 cents per byte - Smart contract execution
  SMART_CONTRACT_INSTANTIATE_FEE: 0.02,    // 2 cents per byte - Smart contract instantiation
  SELF_CURRENCY_EQUIV_FEE: 0.0005,         // 0.05 cents per byte - Self currency equivalence
  AUTHORIZED_CURRENCY_EQUIV_FEE: 0.0005,   // 0.05 cents per byte - Authorized currency equivalence
  EXPENSE_RATIO_FEE: 0.10,                 // 10 cents per byte - Expense ratio transactions
  NFT_TXN_FEE: 0.0003,                     // 0.03 cents per byte - NFT transactions
  UPDATE_CONTRACT_FEE: 0.075,              // 7.5 cents per byte - Contract updates
  VALIDATOR_REGISTRATION_FEE: 0.01,        // 1 cent per byte - Validator registration
  VALIDATOR_HEARTBEAT_FEE: 0.00005,        // 0.005 cents per byte - Validator heartbeat
  PROPOSAL_RESULT_FEE: 0.01,               // 1 cent per byte - Proposal results
  DELEGATED_VOTING_FEE: 0.05,              // 5 cents per byte - Delegated voting
  REVOKE_TXN_FEE: 0.001,                   // 0.1 cents per byte - Revocation transactions
  QUASH_TXN_FEE: 0.001,                    // 0.1 cents per byte - Quash transactions
  FAST_QUORUM_FEE: 0.04,                   // 4 cents per byte - Fast quorum transactions
  COMPLIANCE_FEE: 0.0001,                  // 0.01 cents per byte - Compliance transactions
  SBT_BURN_FEE: 0.0001,                    // 0.01 cents per byte - SBT burn transactions
  REQUIRED_VERSION_FEE: 0.0001,            // 0.01 cents per byte - Required version transactions
  ALLOWANCE_FEE: 0.0001,                   // 0.01 cents per byte - Allowance transactions
  UNKNOWN_TXN_FEE: 0.0001                 // 0.01 cents per byte - Unknown transaction types (fallback)
} as const;

/**
 * Transaction type to per-byte fee mapping
 * Maps transaction type numbers to their corresponding per-byte fee constants
 */
const TRANSACTION_TYPE_FEE_MAP: Record<number, number> = {
  [TRANSACTION_TYPE.COIN_TYPE]: FEE_CONSTANTS.COIN_TXN_FEE,
  [TRANSACTION_TYPE.MINT_TYPE]: FEE_CONSTANTS.MINT_TXN_FEE,
  [TRANSACTION_TYPE.ITEM_MINT_TYPE]: FEE_CONSTANTS.ITEM_MINT_TXN_FEE,
  [TRANSACTION_TYPE.CONTRACT_TXN_TYPE]: FEE_CONSTANTS.CONTRACT_TXN_FEE,
  [TRANSACTION_TYPE.VOTE_TYPE]: FEE_CONSTANTS.VOTE_TXN_FEE,
  [TRANSACTION_TYPE.PROPOSAL_TYPE]: FEE_CONSTANTS.PROPOSAL_TXN_FEE,
  [TRANSACTION_TYPE.SMART_CONTRACT_TYPE]: FEE_CONSTANTS.SMART_CONTRACT_DEPLOYMENT_FEE,
  [TRANSACTION_TYPE.SMART_CONTRACT_EXECUTE_TYPE]: FEE_CONSTANTS.SMART_CONTRACT_EXECUTE_FEE,
  [TRANSACTION_TYPE.EXPENSE_RATIO_TYPE]: FEE_CONSTANTS.EXPENSE_RATIO_FEE,
  [TRANSACTION_TYPE.NFT_TYPE]: FEE_CONSTANTS.NFT_TXN_FEE,
  [TRANSACTION_TYPE.UPDATE_CONTRACT_TYPE]: FEE_CONSTANTS.UPDATE_CONTRACT_FEE,
  [TRANSACTION_TYPE.VALIDATOR_REGISTRATION_TYPE]: FEE_CONSTANTS.VALIDATOR_REGISTRATION_FEE,
  [TRANSACTION_TYPE.VALIDATOR_HEARTBEAT_TYPE]: FEE_CONSTANTS.VALIDATOR_HEARTBEAT_FEE,
  [TRANSACTION_TYPE.PROPOSAL_RESULT_TYPE]: FEE_CONSTANTS.PROPOSAL_RESULT_FEE,
  [TRANSACTION_TYPE.DELEGATED_VOTING_TYPE]: FEE_CONSTANTS.DELEGATED_VOTING_FEE,
  [TRANSACTION_TYPE.REVOKE_TYPE]: FEE_CONSTANTS.REVOKE_TXN_FEE,
  [TRANSACTION_TYPE.QUASH_TYPE]: FEE_CONSTANTS.QUASH_TXN_FEE,
  [TRANSACTION_TYPE.FAST_QUORUM_TYPE]: FEE_CONSTANTS.FAST_QUORUM_FEE,
  [TRANSACTION_TYPE.COMPLIANCE_TYPE]: FEE_CONSTANTS.COMPLIANCE_FEE,
  [TRANSACTION_TYPE.SBT_BURN_TYPE]: FEE_CONSTANTS.SBT_BURN_FEE,
  [TRANSACTION_TYPE.REQUIRED_VERSION]: FEE_CONSTANTS.REQUIRED_VERSION_FEE,
  [TRANSACTION_TYPE.SMART_CONTRACT_INSTANTIATE_TYPE]: FEE_CONSTANTS.SMART_CONTRACT_INSTANTIATE_FEE,
  [TRANSACTION_TYPE.UKNOWN_TYPE]: FEE_CONSTANTS.UNKNOWN_TXN_FEE,
  [TRANSACTION_TYPE.ALLOWANCE_TYPE]: FEE_CONSTANTS.ALLOWANCE_FEE
};

/**
 * Get per-byte fee constant for a transaction type
 * 
 * This function returns the per-byte fee constant for the given transaction type.
 * In the future, this may look up updated values from an API, with these constants
 * serving as a fallback when the API is unavailable or returns no data.
 * 
 * @param transactionType - The transaction type (from TRANSACTION_TYPE enum)
 * @returns The per-byte fee constant in USD cents
 */
export function getPerByteFeeConstant(transactionType: number): number {
  return TRANSACTION_TYPE_FEE_MAP[transactionType] ?? FEE_CONSTANTS.UNKNOWN_TXN_FEE;
}

/**
 * Get key fee for a specific key type
 * 
 * @param keyType - The key type (e.g., 'ed25519', 'ed448')
 * @param isRestricted - Whether the key is restricted (applies 3x multiplier)
 * @returns The key fee in USD cents
 */
export function getKeyFee(keyType: string, isRestricted: boolean = false): number {
  let baseFee: number;
  
  switch (keyType.toLowerCase()) {
  case KEY_TYPE.ED25519:
  case 'a':
    baseFee = FEE_CONSTANTS.ED25519_KEY_FEE;
    break;
  case KEY_TYPE.ED448:
  case 'b':
    baseFee = FEE_CONSTANTS.ED448_KEY_FEE;
    break;
  default:
    baseFee = FEE_CONSTANTS.ED25519_KEY_FEE; // Default fallback
  }
  
  return isRestricted ? baseFee * FEE_CONSTANTS.RESTRICTED_KEY_MULTIPLIER : baseFee;
}

/**
 * Get hash fee for a specific hash type
 * 
 * @param hashType - The hash type (e.g., 'sha3-256', 'sha3-512', 'blake3', or custom types)
 * @param isRestricted - Whether the hash is restricted (applies 3x multiplier)
 * @returns The hash fee in USD cents
 */
export function getHashFee(hashType: string, isRestricted: boolean = false): number {
  let baseFee: number;
  
  switch (hashType.toLowerCase()) {
  case HASH_TYPE.SHA3_256:
  case 'a':
    baseFee = FEE_CONSTANTS.SHA3_256_HASH_FEE;
    break;
  case HASH_TYPE.SHA3_512:
  case 'b':
    baseFee = FEE_CONSTANTS.SHA3_512_HASH_FEE;
    break;
  case HASH_TYPE.BLAKE3:
  case 'c':
    baseFee = FEE_CONSTANTS.BLAKE3_HASH_FEE;
    break;
  case 'd':
    baseFee = FEE_CONSTANTS.CUSTOM_HASH_D_FEE;
    break;
  case 'e':
    baseFee = FEE_CONSTANTS.CUSTOM_HASH_E_FEE;
    break;
  case 'f':
    baseFee = FEE_CONSTANTS.CUSTOM_HASH_F_FEE;
    break;
  case 'g':
    baseFee = FEE_CONSTANTS.CUSTOM_HASH_G_FEE;
    break;
  case 'dbz':
    baseFee = FEE_CONSTANTS.CUSTOM_HASH_DBZ_FEE;
    break;
  case 'h':
    baseFee = FEE_CONSTANTS.CUSTOM_HASH_H_FEE;
    break;
  case 'i':
    baseFee = FEE_CONSTANTS.CUSTOM_HASH_I_FEE;
    break;
  case 'j':
    baseFee = FEE_CONSTANTS.CUSTOM_HASH_J_FEE;
    break;
  default:
    baseFee = FEE_CONSTANTS.SHA3_256_HASH_FEE; // Default fallback
  }
  
  return isRestricted ? baseFee * FEE_CONSTANTS.RESTRICTED_KEY_MULTIPLIER : baseFee;
}

/**
 * Check if a key identifier is restricted
 * 
 * @param keyIdentifier - The full key identifier (e.g., 'A_abc123', 'r_A_abc123')
 * @returns True if the key is restricted (starts with 'r_')
 */
export function isRestrictedKey(keyIdentifier: string): boolean {
  return keyIdentifier.startsWith('r_');
}

/**
 * Check if a hash identifier is restricted
 * 
 * @param hashIdentifier - The full hash identifier (e.g., 'a_abc123', 'r_a_abc123')
 * @returns True if the hash is restricted (starts with 'r_')
 */
export function isRestrictedHash(hashIdentifier: string): boolean {
  return hashIdentifier.startsWith('r_');
}

/**
 * Extract key type from a key identifier, handling restricted keys
 * 
 * @param keyIdentifier - The full key identifier (e.g., 'A_abc123', 'r_A_abc123')
 * @returns The key type without the 'r_' prefix if present
 * @throws Error if the key type is not supported
 */
export function extractKeyTypeFromIdentifier(keyIdentifier: string): string {
  // Remove 'r_' prefix if present
  const cleanIdentifier = keyIdentifier.startsWith('r_') 
    ? keyIdentifier.substring(2) 
    : keyIdentifier;
  
  // Extract key type (everything up to the first underscore)
  const firstUnderscoreIndex = cleanIdentifier.indexOf('_');
  
  if (firstUnderscoreIndex > 0) {
    const keyTypePrefix = cleanIdentifier.substring(0, firstUnderscoreIndex);
    
    if (keyTypePrefix === 'A') {
      return KEY_TYPE.ED25519;
    } else if (keyTypePrefix === 'B') {
      return KEY_TYPE.ED448;
    } else {
      throw new Error(`Unsupported key type prefix: '${keyTypePrefix}'.`);
    }
  }
  
  throw new Error(`Invalid key identifier format: '${keyIdentifier}'.')`);
}

/**
 * Extract hash type from a key identifier, handling restricted keys.
 * 
 * For new-format identifiers (e.g., 'A_pubkey'), where no hash type
 * segment exists, returns 'none'.
 * For legacy identifiers (e.g., 'A_c_pubkey'), extracts the hash type.
 * 
 * @param hashIdentifier - The full key identifier (e.g., 'A_pubkey', 'A_c_pubkey', 'r_A_c_pubkey')
 * @returns The hash type string, or 'none' for key-only format identifiers
 * @throws Error if the hash type prefix is recognized but unsupported
 */
export function extractHashTypeFromIdentifier(hashIdentifier: string): string {
  // Remove 'r_' prefix if present
  const cleanIdentifier = hashIdentifier.startsWith('r_') 
    ? hashIdentifier.substring(2) 
    : hashIdentifier;
  
  // Skip past the key type prefix (e.g., 'A_' or 'B_')
  const firstUnderscoreIndex = cleanIdentifier.indexOf('_');
  
  if (firstUnderscoreIndex < 0) {
    throw new Error(`Invalid hash identifier format: '${hashIdentifier}'.`);
  }

  // Get the remaining string after the key type prefix
  const afterKeyType = cleanIdentifier.substring(firstUnderscoreIndex + 1);
  
  // Check if the next segment is a known hash type prefix (single lowercase letter followed by _)
  const secondUnderscoreIndex = afterKeyType.indexOf('_');
  
  if (secondUnderscoreIndex < 0) {
    // No second underscore — this is key-only format (e.g., A_pubkey)
    return 'none';
  }

  const potentialHashPrefix = afterKeyType.substring(0, secondUnderscoreIndex);
  
  switch (potentialHashPrefix.toLowerCase()) {
  case 'a':
    return HASH_TYPE.SHA3_256;
  case 'b':
    return HASH_TYPE.SHA3_512;
  case 'c':
    return HASH_TYPE.BLAKE3;
  case 'd':
    return 'd';
  case 'e':
    return 'e';
  case 'f':
    return 'f';
  case 'g':
    return 'g';
  case 'dbz':
    return 'dbz';
  case 'h':
    return 'h';
  case 'i':
    return 'i';
  case 'j':
    return 'j';
  default:
    // Not a recognized hash prefix — likely key-only format where the
    // base58 pubkey happens to contain an underscore (uncommon but possible)
    return 'none';
  }
}