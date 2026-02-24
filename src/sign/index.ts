/**
 * ZERA Transaction Signing Module
 *
 * @module sign
 *
 * @example
 * ```typescript
 * import { KeyPairSigner, signAndFinalize, signWithKey } from '@zera-os/zera.js';
 *
 * // External signer
 * const signed = await signAndFinalize(txn, new KeyPairSigner(pub, priv));
 *
 * // Private key
 * signWithKey(txn, privateKey, publicKeyId);
 * ```
 */

// Signer interface and implementations
export {
  type ZeraSigner,
  KeyPairSigner
} from './signer.js';

// Signing workflows
export {
  signAndFinalize,
  signWithKey,
  signCoinTXN,
  signCoinTXNWithKeys,
  type CoinTXNKeyPair
} from './finalize.js';
