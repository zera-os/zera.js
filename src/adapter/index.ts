/**
 * Wallet Adapter Module
 *
 * Provides abstractions for decoupled transaction signing, enabling
 * external wallets (browser extensions, hardware wallets, mobile apps)
 * to sign ZERA transactions without direct access to private keys.
 *
 * @module adapter
 *
 * ## Key Concepts
 *
 * - **`ZeraSigner`** — interface for anything that can sign bytes
 * - **`KeyPairSigner`** — built-in signer for local private keys
 * - **`buildUnsignedCoinTXN()`** — build a CoinTXN without signing
 * - **`signCoinTXN()`** — sign a CoinTXN with one or more signers
 * - **`signAndFinalize()`** — sign any standard transaction with a signer
 * - **`serializeTransaction()`** / **`deserializeTransaction()`** — portable encoding
 *
 * @example
 * ```typescript
 * import {
 *   buildUnsignedCoinTXN,
 *   signCoinTXN,
 *   sendCoinTXN,
 *   KeyPairSigner
 * } from '@zera-os/zera.js';
 *
 * // Build → Sign → Send
 * const unsigned = await buildUnsignedCoinTXN(inputs, outputs, '$ZRA+0000');
 * const signer = new KeyPairSigner(publicKey, privateKey);
 * const signed = await signCoinTXN(unsigned, [signer]);
 * const hash = await sendCoinTXN(signed);
 * ```
 */

// ============================================================================
// SIGNER
// ============================================================================

export {
  type ZeraSigner,
  KeyPairSigner
} from './signer.js';

// ============================================================================
// TRANSACTION BUILDERS & SIGNING
// ============================================================================

export {
  buildUnsignedCoinTXN,
  signCoinTXN,
  signAndFinalize,
  type UnsignedCoinTXNInput
} from './transaction.js';

// ============================================================================
// SERIALIZATION
// ============================================================================

export {
  serializeTransaction,
  deserializeTransaction,
  getRegisteredTypes,
  type SerializedTransaction
} from './serialization.js';
