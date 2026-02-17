/**
 * Wallet Signers
 *
 * Two implementations of the `ZeraSigner` interface:
 *
 * 1. **WalletSigner** — delegates `sign()` to `window.zera` (PostMessage bridge).
 *    Used when running inside a wallet's dApp browser (embedded mode).
 *
 * 2. **DeepLinkSigner** — delegates `sign()` via a `visionhub://sign` deep link.
 *    Used when running in an external browser (Brave, Safari, Chrome).
 *    The signing flow causes a full page redirect; the result is read from
 *    URL params on the next page load.
 *
 * @module adapter/wallet-signer
 */

import type { ZeraSigner } from '../sign/signer.js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Minimal interface for a ZERA wallet provider.
 * Matches the `window.zera` object injected by compatible wallet apps.
 */
export interface ZeraProvider {
  readonly isZeraWallet: boolean;
  readonly isConnected: boolean;
  readonly publicKey: string | null;
  request(method: string, params?: Record<string, unknown>): Promise<unknown>;
  on?(event: string, handler: (...args: unknown[]) => void): void;
  off?(event: string, handler: (...args: unknown[]) => void): void;
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

function fromBase64(base64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ============================================================================
// WALLET SIGNER (embedded mode — window.zera)
// ============================================================================

/**
 * A `ZeraSigner` implementation that delegates signing to an in-page
 * wallet provider (`window.zera`). Used when embedded in a wallet's
 * dApp browser — no page redirects needed.
 */
export class WalletSigner implements ZeraSigner {
  readonly publicKey: string;
  private readonly provider: ZeraProvider;

  constructor(publicKey: string, provider: ZeraProvider) {
    if (!publicKey) throw new Error('publicKey is required');
    if (!provider) throw new Error('provider is required');
    this.publicKey = publicKey;
    this.provider = provider;
  }

  /**
   * Sign transaction bytes by delegating to the external wallet provider.
   *
   * @param data - Serialized transaction bytes
   * @returns Raw signature bytes (Ed25519 — 64 bytes)
   */
  async sign(data: Uint8Array): Promise<Uint8Array> {
    const encoded = toBase64(data);

    const result = await this.provider.request('zera_signTransaction', {
      transaction: encoded
    }) as { signedTransaction?: string; signature?: string } | string;

    // The provider may return the signature directly or in an object
    let sigBase64: string;
    if (typeof result === 'string') {
      sigBase64 = result;
    } else if (result && typeof result === 'object') {
      sigBase64 = (result as { signedTransaction?: string; signature?: string }).signature
        ?? (result as { signedTransaction?: string; signature?: string }).signedTransaction
        ?? '';
    } else {
      throw new Error('Unexpected signing response from wallet provider');
    }

    if (!sigBase64) {
      throw new Error('Wallet provider returned empty signature');
    }

    return fromBase64(sigBase64);
  }
}

// ============================================================================
// DEEP LINK SIGNER (external browser mode)
// ============================================================================

const SIGN_PENDING_KEY = 'zera-wallet-sign-pending';

/**
 * A `ZeraSigner` implementation for external browsers (Brave, Safari, Chrome).
 *
 * When `sign()` is called, it:
 * 1. Saves the pending sign request to `sessionStorage`
 * 2. Navigates to `visionhub://sign?txn=...&callback=...`
 * 3. The wallet app signs and redirects back with `?zera_result=...`
 * 4. The adapter reads the URL param and resolves the pending promise
 *
 * **Important:** This causes a full page redirect. The calling code must
 * handle the fact that `sign()` will not return during this page load.
 * The result is picked up on the next page load by the adapter.
 */
export class DeepLinkSigner implements ZeraSigner {
  readonly publicKey: string;
  private readonly deepLinkUrl: string;
  private readonly callbackUrl: string;

  constructor(publicKey: string, deepLinkUrl: string, callbackUrl: string) {
    if (!publicKey) throw new Error('publicKey is required');
    this.publicKey = publicKey;
    this.deepLinkUrl = deepLinkUrl;
    this.callbackUrl = callbackUrl;
  }

  /**
   * Sign transaction bytes via deep-link redirect to a compatible wallet app.
   *
   * This triggers a page navigation. The signature is delivered
   * via URL params when the wallet app redirects back.
   */
  async sign(data: Uint8Array): Promise<Uint8Array> {
    if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') {
      throw new Error('Deep-link signing requires a browser environment');
    }

    const encoded = toBase64(data);
    const requestId = `zr_sign_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Save pending sign state so the app can resume after redirect
    sessionStorage.setItem(SIGN_PENDING_KEY, JSON.stringify({
      type: 'sign',
      requestId,
      transaction: encoded,
      timestamp: Date.now()
    }));

    // Redirect to wallet app via visionhub:// deep link
    const deepLink = `${this.deepLinkUrl}sign`
      + `?txn=${encodeURIComponent(encoded)}`
      + `&callback=${encodeURIComponent(this.callbackUrl)}`
      + `&requestId=${encodeURIComponent(requestId)}`
      + `&publicKey=${encodeURIComponent(this.publicKey)}`;

    window.location.href = deepLink;

    // This promise never resolves — the page navigates away.
    // The SDK adapter handles the result on the next page load.
    return new Promise(() => {});
  }

  /**
   * Check URL params for a signing result from a deep-link redirect.
   * Called by the adapter on page load.
   *
   * @returns The signature bytes, or null if no pending sign result
   */
  static checkSignResult(): { signature: Uint8Array; requestId: string } | null {
    if (typeof window === 'undefined') return null;

    const url = new URL(window.location.href);
    const sigBase64 = url.searchParams.get('zera_result');
    const requestId = url.searchParams.get('zera_request_id');
    const error = url.searchParams.get('zera_error');

    if (error) {
      // Clean URL
      url.searchParams.delete('zera_result');
      url.searchParams.delete('zera_request_id');
      url.searchParams.delete('zera_error');
      window.history.replaceState({}, '', url.toString());
      throw new Error(decodeURIComponent(error));
    }

    if (!sigBase64) return null;

    // Validate against pending request
    if (typeof sessionStorage !== 'undefined') {
      const pending = sessionStorage.getItem(SIGN_PENDING_KEY);
      if (pending) {
        try {
          const parsed = JSON.parse(pending) as { requestId: string };
          if (requestId && parsed.requestId !== requestId) return null;
        } catch { /* ignore */ }
        sessionStorage.removeItem(SIGN_PENDING_KEY);
      }
    }

    // Clean URL
    url.searchParams.delete('zera_result');
    url.searchParams.delete('zera_request_id');
    url.searchParams.delete('zera_error');
    window.history.replaceState({}, '', url.toString());

    return {
      signature: fromBase64(decodeURIComponent(sigBase64)),
      requestId: requestId ?? ''
    };
  }
}
