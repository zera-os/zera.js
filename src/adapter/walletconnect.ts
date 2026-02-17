/**
 * WalletConnect v2 — ZERA & Solana Namespace Definitions
 *
 * Defines the chain namespaces, methods, and events for WalletConnect v2
 * sessions. These constants are used by both the dApp side (SignClient)
 * and the wallet side (Web3Wallet) to negotiate session capabilities.
 *
 * Also exports `WalletConnectSigner` — a `ZeraSigner` implementation that
 * delegates signing to an active WC session.
 *
 * @module adapter/walletconnect
 *
 * @example
 * ```typescript
 * import {
 *   ZERA_WC_REQUIRED_NAMESPACES,
 *   SOLANA_WC_REQUIRED_NAMESPACES,
 *   WalletConnectSigner
 * } from '@zera-os/zera.js';
 *
 * // dApp side: propose session with both chains
 * const { uri, approval } = await signClient.connect({
 *   requiredNamespaces: {
 *     ...ZERA_WC_REQUIRED_NAMESPACES,
 *     ...SOLANA_WC_REQUIRED_NAMESPACES,
 *   }
 * });
 *
 * // After approval, sign transactions via WC
 * const signer = new WalletConnectSigner(signClient, session, publicKey);
 * const signed = await signAndFinalize(txn, signer);
 * ```
 */

import type { ZeraSigner } from '../sign/signer.js';

// ============================================================================
// ZERA NAMESPACE
// ============================================================================

/** WalletConnect namespace identifier for ZERA */
export const ZERA_WC_NAMESPACE = 'zera' as const;

/** ZERA chain identifiers (CAIP-2 format) */
export const ZERA_WC_CHAINS = ['zera:mainnet'] as const;

/** JSON-RPC methods the wallet must support for ZERA */
export const ZERA_WC_METHODS = [
  'zera_getAccounts',
  'zera_signTransaction',
  'zera_signMessage',
] as const;

/** Events the wallet may emit for ZERA */
export const ZERA_WC_EVENTS = [
  'accountsChanged',
] as const;

/** Required namespaces object for ZERA — pass to `signClient.connect()` */
export const ZERA_WC_REQUIRED_NAMESPACES = {
  [ZERA_WC_NAMESPACE]: {
    chains: ZERA_WC_CHAINS as unknown as string[],
    methods: ZERA_WC_METHODS as unknown as string[],
    events: ZERA_WC_EVENTS as unknown as string[],
  },
} as const;

// ============================================================================
// SOLANA NAMESPACE (standard)
// ============================================================================

/** WalletConnect namespace identifier for Solana */
export const SOLANA_WC_NAMESPACE = 'solana' as const;

/** Solana chain identifiers (CAIP-2 format) */
export const SOLANA_WC_CHAINS = ['solana:mainnet'] as const;

/** JSON-RPC methods the wallet must support for Solana */
export const SOLANA_WC_METHODS = [
  'solana_signTransaction',
  'solana_signMessage',
] as const;

/** Events the wallet may emit for Solana */
export const SOLANA_WC_EVENTS = [
  'accountsChanged',
] as const;

/** Required namespaces object for Solana */
export const SOLANA_WC_REQUIRED_NAMESPACES = {
  [SOLANA_WC_NAMESPACE]: {
    chains: SOLANA_WC_CHAINS as unknown as string[],
    methods: SOLANA_WC_METHODS as unknown as string[],
    events: SOLANA_WC_EVENTS as unknown as string[],
  },
} as const;

// ============================================================================
// COMBINED NAMESPACES — convenience for dApps supporting both chains
// ============================================================================

/** All required namespaces for a dual-chain (ZERA + Solana) session */
export const ALL_WC_REQUIRED_NAMESPACES = {
  ...ZERA_WC_REQUIRED_NAMESPACES,
  ...SOLANA_WC_REQUIRED_NAMESPACES,
} as const;

// ============================================================================
// TYPES
// ============================================================================

/** Minimal WC SignClient interface (avoids hard dependency on @walletconnect/sign-client) */
export interface WCSignClient {
  request<T = unknown>(params: {
    topic: string;
    chainId: string;
    request: { method: string; params: unknown };
  }): Promise<T>;
}

/** Minimal WC session object */
export interface WCSession {
  topic: string;
}

/** Response from `zera_signTransaction` */
export interface ZeraWCSignTransactionResult {
  signature: string; // base64-encoded signature bytes
}

/** Response from `zera_signMessage` */
export interface ZeraWCSignMessageResult {
  signature: string; // base64-encoded signature bytes
}

/** Response from `zera_getAccounts` */
export interface ZeraWCGetAccountsResult {
  accounts: Array<{
    publicKey: string;  // ZERA public key identifier (e.g. "A_<base58>")
    address: string;    // ZERA address
  }>;
}

// ============================================================================
// BASE64 HELPERS (isomorphic)
// ============================================================================

function toBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(b64, 'base64'));
  }
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ============================================================================
// WALLETCONNECT SIGNER
// ============================================================================

/**
 * `ZeraSigner` implementation that delegates signing to an active
 * WalletConnect session.
 *
 * Used by dApps: after establishing a WC session with VisionHub,
 * pass this signer to `signAndFinalize()` to sign ZERA transactions
 * remotely via the WC relay.
 *
 * @example
 * ```typescript
 * const signer = new WalletConnectSigner(signClient, session, publicKey);
 * const signed = await signAndFinalize(unsignedTxn, signer);
 * const hash = await sendCoinTXN(signed);
 * ```
 */
export class WalletConnectSigner implements ZeraSigner {
  readonly publicKey: string;
  private readonly _client: WCSignClient;
  private readonly _session: WCSession;
  private readonly _chainId: string;

  constructor(
    client: WCSignClient,
    session: WCSession,
    publicKey: string,
    chainId: string = 'zera:mainnet'
  ) {
    this._client = client;
    this._session = session;
    this.publicKey = publicKey;
    this._chainId = chainId;
  }

  /**
   * Sign transaction bytes by sending a `zera_signTransaction` RPC
   * request through the WalletConnect relay to the connected wallet.
   *
   * The wallet will show an approval prompt; the returned signature
   * is the raw Ed25519 bytes.
   */
  async sign(data: Uint8Array): Promise<Uint8Array> {
    const result = await this._client.request<ZeraWCSignTransactionResult>({
      topic: this._session.topic,
      chainId: this._chainId,
      request: {
        method: 'zera_signTransaction',
        params: {
          transaction: toBase64(data),
        },
      },
    });

    return fromBase64(result.signature);
  }

  /**
   * Sign an arbitrary message (non-transaction).
   * Not part of ZeraSigner, but useful for auth / proof-of-ownership.
   */
  async signMessage(message: Uint8Array): Promise<Uint8Array> {
    const result = await this._client.request<ZeraWCSignMessageResult>({
      topic: this._session.topic,
      chainId: this._chainId,
      request: {
        method: 'zera_signMessage',
        params: {
          message: toBase64(message),
        },
      },
    });

    return fromBase64(result.signature);
  }
}
