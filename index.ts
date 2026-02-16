/**
 * ZERA JavaScript SDK - Main Entry Point
 * 
 * A modern, ESM-compatible TypeScript SDK for the ZERA Network with support for:
 * - HD wallet creation with BIP32/BIP39/SLIP-0010 compliance
 * - Multiple key types (Ed25519, Ed448) and hash algorithms
 * - CoinTXN creation and submission
 * - API services for nonce and exchange rate management
 * 
 * @version 1.0.0
 * @author ZERA Community
 * @license MIT
 */

// Import wallet creation functionality
export { 
  WalletFactory,
  createWallet,
  deriveMultipleWallets,
  generateZeraPublicKeyIdentifier,
  createBaseWallet,
  generateZeraAddress,
  generateAddressFromPublicKey,
  CryptoUtils,
  generateMnemonicPhrase,
  buildDerivationPath,
  generateSeed,
  validateMnemonicPhrase,
  createHDWallet,
  deriveMultipleAddresses,
  getHDWalletInfo,
  KEY_TYPE,
  HASH_TYPE,
  VALID_KEY_TYPES,
  VALID_HASH_TYPES,
  KEY_TYPE_PREFIXES,
  HASH_TYPE_PREFIXES,
  isValidKeyType,
  isValidHashType,
  ZERA_TYPE,
  ZERA_TYPE_HEX,
  ZERA_SYMBOL,
  ZERA_NAME,
  SLIP0010_DERIVATION_PATH,
  MNEMONIC_LENGTHS,
  type WalletOptions,
  type Wallet,
  type HDOptions,
  type MultipleWalletOptions,
  type KeyType,
  type HashType,
  type MnemonicLength
} from './src/wallet-creation/index.js';

// Import CoinTXN functionality
export { 
  createCoinTXN, 
  sendCoinTXN,
  type CoinTXNInput,
  type CoinTXNOutput,
  type GRPCConfig
} from './src/coin-txn/index.js';

// Import Smart Contract Execute functionality
export {
  createSmartContractExecuteTXN,
  sendSmartContractExecuteTXN,
  type ExecuteParameter,
  type ParameterType,
  ParamType
} from './src/smart-contracts/execute/index.js';

// Import Bridge functionality (ZERA chain lock/unlock)
export {
  bridgeZeraToSol,
  bridgeZeraToSolAndSend,
  type BridgeZeraOptions
} from './src/smart-contracts/use-cases/bridge/zera/index.js';

// Import Solana Bridge functionality (instruction builders)
export * as solanaBridge from './src/smart-contracts/use-cases/bridge/solana/index.js';

// Import Guardian Bridge functionality (admin operations)
export * as guardianBridge from './src/smart-contracts/use-cases/bridge/guardian/index.js';

// Import Vote functionality
export {
  createVoteTXN,
  sendVoteTXN,
  type CreateVoteTXNOptions
} from './src/vote/index.js';

// Import Contract functionality
export {
  createContract,
  sendCreateContract,
  updateContract,
  sendUpdateContract,
  type CreateContractOptions,
  type UpdateContractOptions
} from './src/contract/index.js';

// Import Sign module (universal signing)
export {
  type ZeraSigner,
  KeyPairSigner,
  signAndFinalize,
  signWithKey,
  signCoinTXN,
  signCoinTXNWithKeys,
  type CoinTXNKeyPair
} from './src/sign/index.js';

// Import Adapter functionality (builders + serialization)
export {
  buildCoinTXN,
  buildVoteTXN,
  buildContractTXN,
  buildContractUpdateTXN,
  buildSmartContractExecuteTXN,
  serializeTransaction,
  deserializeTransaction,
  getRegisteredTypes,
  type CoinTXNBuildInput,
  type BuildVoteTXNOptions,
  type BuildContractOptions,
  type BuildContractUpdateOptions,
  type BuildSmartContractExecuteOptions,
  type SerializedTransaction
} from './src/adapter/index.js';

// Import API services
export {
  getNonce,
  getNonces
} from './src/api/handler/nonce/service.js';

export {
  getBalance,
  getBalances,
  type EnhancedBalanceResponse
} from './src/api/validator/balance/service.js';

export {
  getExchangeRate
} from './src/api/handler/fee-info/service.js';

export {
  getTokenFeeInfo,
  getTokenInfoForSingle,
  isTokenSupported,
  getTokenDenomination,
  getTokenRate,
  getTokenInfoMap,
  type TokenInfo
} from './src/api/handler/token-info/service.js';

// Re-export TokenFeeInfoResponse type
export type { TokenFeeInfoResponse } from './src/shared/utils/token-info.js';

export {
  toSmallestUnits,
  fromSmallestUnits
} from './src/shared/utils/unified-amount-conversion.js';

// Export validation utilities
export {
  isValidContractId,
  isValidAddress,
  validateAmount,
  validateBase58Address
} from './src/shared/utils/validation.js';

// Import error classes
export {
  WalletCreationError,
  InvalidKeyTypeError,
  InvalidHashTypeError,
  InvalidMnemonicLengthError,
  InvalidMnemonicError,
  InvalidDerivationPathError,
  InvalidHDParameterError,
  MissingParameterError,
  CryptographicError
} from './src/wallet-creation/errors.js';

/**
 * SDK version
 */
export const VERSION = '1.0.0' as const;

/**
 * SDK description
 */
export const DESCRIPTION = 'ZERA JavaScript SDK' as const;
