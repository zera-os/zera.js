/**
 * ZERA Wallet Adapter
 *
 * Framework-agnostic wallet connection manager for browser dApps. Handles:
 * - Provider detection (`window.zera` injected by compatible wallet apps)
 * - Deep-link redirect strategy for external browsers (Brave, Safari, Chrome)
 * - Connection lifecycle (connect / disconnect / reconnect)
 * - Produces a `ZeraSigner` for use with `signAndFinalize()`
 * - Event emission (connect, disconnect, error)
 *
 * @module adapter/wallet-adapter
 *
 * @example
 * ```typescript
 * import {
 *   ZeraWalletAdapter,
 *   buildVoteTXN,
 *   signAndFinalize,
 *   sendVoteTXN
 * } from '@zera-os/zera.js';
 *
 * const adapter = new ZeraWalletAdapter();
 * await adapter.connect();
 *
 * const txn = await buildVoteTXN({
 *   publicKeyId: adapter.publicKey!,
 *   contractId: 'GOVERNANCE_CONTRACT',
 *   proposalHash: '...',
 *   option: 'Yes',
 * });
 *
 * const signed = await signAndFinalize(txn, adapter.signer!);
 * await sendVoteTXN(signed);
 *
 * adapter.disconnect();
 * ```
 */

import { WalletSigner, DeepLinkSigner, type ZeraProvider } from './wallet-signer.js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Configuration options for `ZeraWalletAdapter`.
 */
export interface WalletAdapterConfig {
  /** Attempt auto-connect on instantiation (default: false) */
  autoConnect?: boolean;
  /** Base deep link URL for wallet actions (default: 'zera-wallet://') */
  deepLinkUrl?: string;
  /** Timeout for signing requests in ms (default: 300000 = 5 min) */
  signTimeout?: number;
  /**
   * Callback URL to redirect back to after the wallet app processes
   * deep-link requests. Defaults to `window.location.href` (current page).
   * The SDK strips any existing `zera_*` params before using this.
   */
  callbackUrl?: string;
}

/** Events emitted by the adapter */
export type WalletAdapterEvent = 'connect' | 'disconnect' | 'error';
type EventHandler = (...args: unknown[]) => void;

/** Adapter connection state */
export type WalletAdapterState = 'disconnected' | 'connecting' | 'connected';

/** Strategy the adapter used to connect */
export type WalletConnectionMode = 'embedded' | 'deeplink' | 'manual';

// ============================================================================
// CONSTANTS
// ============================================================================

const STORAGE_KEY = 'zera-wallet-adapter';
const PENDING_KEY = 'zera-wallet-pending';

// URL param keys used in deep-link callback
const PARAM_RESULT = 'zera_result';
const PARAM_REQUEST_ID = 'zera_request_id';
const PARAM_ERROR = 'zera_error';

// BroadcastChannel for cross-tab result forwarding
// When the wallet app redirects back (opening a new browser tab), the new tab
// broadcasts the result so the original tab can complete the connection.
const BROADCAST_CHANNEL = 'zera-wallet-bridge';

// ============================================================================
// ADAPTER
// ============================================================================

/**
 * Framework-agnostic wallet adapter for ZERA dApps.
 *
 * **Two connection strategies:**
 *
 * 1. **Embedded** (wallet dApp browser) — detects `window.zera`, auto-connects,
 *    signs via PostMessage bridge. Zero redirects.
 *
 * 2. **Deep-link redirect** (external browser — Brave, Safari, Chrome) — redirects
 *    to `zera-wallet://connect?callback=...`, any compatible wallet app shows
 *    approval, redirects back with `?zera_result=...`. Signing also uses
 *    deep-link round-trips.
 *
 * Works in any JavaScript framework — React, Vue, Svelte, vanilla JS, etc.
 */
export class ZeraWalletAdapter {
  // ── State ────────────────────────────────────────────────────────────
  private _state: WalletAdapterState = 'disconnected';
  private _publicKey: string | null = null;
  private _address: string | null = null;
  private _signer: WalletSigner | DeepLinkSigner | null = null;
  private _provider: ZeraProvider | null = null;
  private _connectionMode: WalletConnectionMode | null = null;
  private _listeners: Record<string, EventHandler[]> = {};
  private readonly _config: Required<WalletAdapterConfig>;
  private _broadcastChannel: BroadcastChannel | null = null;

  constructor(config?: WalletAdapterConfig) {
    this._config = {
      autoConnect: config?.autoConnect ?? false,
      deepLinkUrl: config?.deepLinkUrl ?? 'zera-wallet://',
      signTimeout: config?.signTimeout ?? 5 * 60 * 1000,
      callbackUrl: config?.callbackUrl ?? ''
    };

    // Check for deep-link callback result on page load
    if (typeof window !== 'undefined') {
      this._handleRedirectResult();
      this._setupBroadcastListener();
    }

    if (this._config.autoConnect && typeof window !== 'undefined') {
      this.connect().catch((err) => {
        this._emit('error', err);
      });
    }
  }

  // ── Public Getters ───────────────────────────────────────────────────

  /** Current connection state */
  get state(): WalletAdapterState { return this._state; }

  /** Whether the wallet is currently connected */
  get connected(): boolean { return this._state === 'connected'; }

  /** Connected wallet's public key (null if disconnected) */
  get publicKey(): string | null { return this._publicKey; }

  /** Connected wallet's display address (null if disconnected) */
  get address(): string | null { return this._address; }

  /**
   * A `ZeraSigner` bound to the connected wallet.
   * Pass this to `signAndFinalize(txn, adapter.signer)`.
   * Returns `null` if not connected.
   */
  get signer(): WalletSigner | DeepLinkSigner | null { return this._signer; }

  /** The underlying window.zera provider (null if using deep-link mode) */
  get provider(): ZeraProvider | null { return this._provider; }

  /** Whether running inside a wallet's dApp browser (window.zera exists) */
  get isEmbedded(): boolean {
    return this._connectionMode === 'embedded';
  }

  /** How the wallet is connected: 'embedded', 'deeplink', 'manual', or null */
  get connectionMode(): WalletConnectionMode | null { return this._connectionMode; }

  // ── Static Helpers ───────────────────────────────────────────────────

  /**
   * Check if a ZERA provider is available in the current environment.
   * Returns true if `window.zera` exists and identifies as a ZERA wallet.
   */
  static isAvailable(): boolean {
    if (typeof window === 'undefined') return false;
    const provider = (window as unknown as Record<string, unknown>).zera as ZeraProvider | undefined;
    return provider?.isZeraWallet === true;
  }

  /**
   * Get a more detailed detection status for UI display.
   *
   * - `'injected'` — Running inside a wallet's dApp browser (`window.zera` exists)
   * - `'available'` — On a mobile device where deep-link connect will work
   * - `'unknown'`  — Desktop browser with no injected provider detected
   */
  static getDetectionStatus(): 'injected' | 'available' | 'unknown' {
    if (typeof window === 'undefined') return 'unknown';
    const provider = (window as unknown as Record<string, unknown>).zera as ZeraProvider | undefined;
    if (provider?.isZeraWallet) return 'injected';
    // On mobile, deep link connection is always an option
    if (typeof navigator !== 'undefined' && /android|iphone|ipad|ipod/i.test(navigator.userAgent)) {
      return 'available';
    }
    return 'unknown';
  }

  /**
   * Truncate a public key for display: `"ed25519:9Xk3a...bY4f"`
   */
  static truncateKey(key: string, prefixLen = 6, suffixLen = 4): string {
    if (key.length <= prefixLen + suffixLen + 3) return key;
    return `${key.slice(0, prefixLen)}...${key.slice(-suffixLen)}`;
  }

  // ── Connection Lifecycle ─────────────────────────────────────────────

  /**
   * Connect to the ZERA wallet.
   *
   * **Strategy 1 — Embedded (window.zera available):**
   * Calls `zera_requestAccounts`, returns immediately with public key.
   *
   * **Strategy 2 — Deep-link redirect (external browser):**
   * Saves pending request to `sessionStorage`, navigates to
   * `zera-wallet://connect?callback=...`. The wallet app shows approval,
   * then redirects back with `?zera_result=...` to resolve the connection.
   *
   * **Manual fallback:**
   * Call `connectManual(publicKey)` to connect with a known public key
   * (view-only, signing requires deep-link round-trip).
   *
   * @returns The connected public key
   */
  async connect(): Promise<string> {
    if (this._state === 'connected' && this._publicKey) {
      return this._publicKey;
    }

    this._state = 'connecting';

    // Strategy 1: Embedded provider (window.zera)
    const provider = this._detectProvider();
    if (provider) {
      return this._connectViaProvider(provider);
    }

    // Strategy 2: Deep-link redirect
    return this._connectViaDeepLink();
  }

  /**
   * Connect with a known public key (view-only mode).
   * Signing will use deep-link round-trips through a compatible wallet app.
   */
  connectManual(publicKey: string): void {
    if (!publicKey) throw new Error('publicKey is required');
    this._publicKey = publicKey;
    this._connectionMode = 'manual';
    this._signer = new DeepLinkSigner(publicKey, this._config.deepLinkUrl, this._getCallbackUrl());
    this._state = 'connected';
    this._persistConnection();
    this._emit('connect', { publicKey, mode: 'manual' });
  }

  /**
   * Disconnect from the wallet and clear all state.
   */
  async disconnect(): Promise<void> {
    if (this._provider) {
      try {
        await this._provider.request('zera_disconnect', {});
      } catch {
        // Ignore disconnect errors
      }
    }

    this._publicKey = null;
    this._address = null;
    this._signer = null;
    this._provider = null;
    this._connectionMode = null;
    this._state = 'disconnected';
    this._clearPersistence();
    this._emit('disconnect');
  }

  // ── Event Emitter ────────────────────────────────────────────────────

  /** Subscribe to adapter events */
  on(event: WalletAdapterEvent, handler: EventHandler): void {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event]!.push(handler);
  }

  /** Unsubscribe from adapter events */
  off(event: WalletAdapterEvent, handler: EventHandler): void {
    const handlers = this._listeners[event];
    if (!handlers) return;
    this._listeners[event] = handlers.filter(h => h !== handler);
  }

  // ── Convenience Methods ──────────────────────────────────────────────

  /**
   * Generate a deep link to open a URL in a compatible wallet's dApp browser.
   */
  getDeepLink(targetUrl?: string): string {
    const url = targetUrl ?? (typeof window !== 'undefined' ? window.location.href : '');
    return `${this._config.deepLinkUrl}browse?url=${encodeURIComponent(url)}`;
  }

  // ── Private: Connection Strategies ───────────────────────────────────

  /** Strategy 1: Connect via detected window.zera provider */
  private async _connectViaProvider(provider: ZeraProvider): Promise<string> {
    this._provider = provider;

    try {
      const result = await provider.request('zera_requestAccounts', {});
      const accounts = Array.isArray(result) ? result : (result as { accounts?: string[] })?.accounts ?? [];
      // Parse optional addresses array (wallet app provides actual wallet address)
      const addresses = !Array.isArray(result) ? (result as { addresses?: string[] })?.addresses ?? [] : [];

      if (!accounts.length) {
        throw new Error('No accounts returned from wallet');
      }

      const publicKey = accounts[0] as string;
      const address = addresses[0] as string | undefined;
      this._publicKey = publicKey;
      this._address = address ?? null;
      this._signer = new WalletSigner(publicKey, provider);
      this._connectionMode = 'embedded';
      this._state = 'connected';
      this._persistConnection();

      this._emit('connect', { publicKey, address: this._address, mode: 'embedded' });
      return publicKey;
    } catch (err) {
      this._state = 'disconnected';
      this._emit('error', err);
      throw err;
    }
  }

  /**
   * Strategy 2: Connect via deep-link redirect to a compatible wallet app.
   *
   * Saves a pending request to sessionStorage and navigates to
   * `zera-wallet://connect?callback=...&requestId=...`.
   *
   * This will cause a full page navigation. When the wallet redirects back,
   * the constructor's `_handleRedirectResult()` reads the params and
   * completes the connection.
   *
   * @returns Never (page navigates away). Throws if sessionStorage unavailable.
   */
  private async _connectViaDeepLink(): Promise<string> {
    if (typeof sessionStorage === 'undefined') {
      this._state = 'disconnected';
      throw new Error(
        'No ZERA wallet provider found and sessionStorage is unavailable. ' +
        'Open this page in a compatible wallet\'s dApp browser.'
      );
    }

    const requestId = this._generateRequestId();
    const callbackUrl = this._getCallbackUrl();

    // Save pending state
    sessionStorage.setItem(PENDING_KEY, JSON.stringify({
      type: 'connect',
      requestId,
      timestamp: Date.now()
    }));

    // Redirect to wallet app via zera-wallet:// deep link
    const deepLink = `${this._config.deepLinkUrl}connect`
      + `?callback=${encodeURIComponent(callbackUrl)}`
      + `&requestId=${encodeURIComponent(requestId)}`;

    window.location.href = deepLink;

    // This promise never resolves — the page navigates away.
    // The connection completes via _handleRedirectResult on the next page load.
    return new Promise(() => {});
  }

  // ── Private: Deep-Link Redirect Handling ─────────────────────────────

  /**
   * Called on page load (constructor). Checks the URL for `?zera_result=...`
   * params from a wallet deep-link redirect, restores state from
   * sessionStorage, and completes the pending operation.
   */
  private _handleRedirectResult(): void {
    if (typeof window === 'undefined') return;

    const url = new URL(window.location.href);
    const result = url.searchParams.get(PARAM_RESULT);
    const requestId = url.searchParams.get(PARAM_REQUEST_ID);
    const error = url.searchParams.get(PARAM_ERROR);

    // No deep-link result params? Try restoring from persistence.
    if (!result && !error) {
      this._restoreConnection();
      return;
    }

    // Validate pending request
    const pendingJson = typeof sessionStorage !== 'undefined'
      ? sessionStorage.getItem(PENDING_KEY)
      : null;

    if (pendingJson) {
      try {
        const pending = JSON.parse(pendingJson) as { type: string; requestId: string; timestamp: number };

        // Validate request ID matches
        if (requestId && pending.requestId !== requestId) {
          // Mismatched request — ignore, but still clean URL
          this._cleanUrl();
          return;
        }

        // Check for stale requests (> 10 minutes)
        if (Date.now() - pending.timestamp > 10 * 60 * 1000) {
          sessionStorage.removeItem(PENDING_KEY);
          this._cleanUrl();
          return;
        }

        sessionStorage.removeItem(PENDING_KEY);
      } catch {
        sessionStorage.removeItem(PENDING_KEY);
      }
    }

    // Handle error
    if (error) {
      this._cleanUrl();
      this._emit('error', new Error(decodeURIComponent(error)));
      return;
    }

    // Handle result — determine if this is a connect or sign result
    if (result) {
      // Check if there's a pending sign request — if so, this result
      // is a sign response, not a connect response. Let DeepLinkSigner
      // handle it via checkSignResult() instead.
      const signPending = typeof sessionStorage !== 'undefined'
        ? sessionStorage.getItem('zera-wallet-sign-pending')
        : null;

      if (signPending) {
        // This is a sign result — don't treat as connect.
        // DeepLinkSigner.checkSignResult() will read and clean up.
        // Just restore any existing connection.
        this._restoreConnection();
        return;
      }

      // This is a connect result
      const publicKey = decodeURIComponent(result);
      const addressParam = url.searchParams.get('zera_address');
      const address = addressParam ? decodeURIComponent(addressParam) : null;
      this._publicKey = publicKey;
      this._address = address;
      this._connectionMode = 'deeplink';
      this._signer = new DeepLinkSigner(publicKey, this._config.deepLinkUrl, this._getCallbackUrl());
      this._state = 'connected';
      this._persistConnection();
      this._cleanUrl();

      // Broadcast result to original tab via BroadcastChannel.
      // On mobile, the wallet app opens a NEW browser tab for the redirect,
      // so the original tab (where the user clicked "Connect") never gets the
      // URL params. This broadcast bridges the two tabs.
      this._broadcastResult({ publicKey, address });

      this._emit('connect', { publicKey, address, mode: 'deeplink' });
    }
  }

  /**
   * Clean `zera_*` params from the URL without triggering a page reload.
   */
  private _cleanUrl(): void {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.delete(PARAM_RESULT);
    url.searchParams.delete(PARAM_REQUEST_ID);
    url.searchParams.delete(PARAM_ERROR);
    url.searchParams.delete('zera_address');
    window.history.replaceState({}, '', url.toString());
  }

  // ── Private: Persistence ─────────────────────────────────────────────

  private _persistConnection(): void {
    if (typeof localStorage === 'undefined' || !this._publicKey) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      publicKey: this._publicKey,
      address: this._address,
      mode: this._connectionMode
    }));
  }

  private _clearPersistence(): void {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY);
    if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(PENDING_KEY);
  }

  private _restoreConnection(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      const { publicKey, address, mode } = JSON.parse(stored) as { publicKey: string; address?: string; mode: WalletConnectionMode };
      if (!publicKey) return;

      this._publicKey = publicKey;
      this._address = address ?? null;
      this._connectionMode = mode ?? 'manual';

      // For embedded mode, try to re-establish the provider
      if (mode === 'embedded') {
        const provider = this._detectProvider();
        if (provider) {
          this._provider = provider;
          this._signer = new WalletSigner(publicKey, provider);
        } else {
          // Provider gone (opened in external browser now), fallback to deep-link signer
          this._connectionMode = 'deeplink';
          this._signer = new DeepLinkSigner(publicKey, this._config.deepLinkUrl, this._getCallbackUrl());
        }
      } else {
        this._signer = new DeepLinkSigner(publicKey, this._config.deepLinkUrl, this._getCallbackUrl());
      }

      this._state = 'connected';
      this._emit('connect', { publicKey, address: this._address, mode: this._connectionMode });
    } catch {
      // Corrupt storage — ignore
    }
  }

  // ── Private: Cross-Tab Bridge ──────────────────────────────────────

  /**
   * Listen for wallet connect results from other tabs.
   * When the wallet app redirects to a NEW tab, the new tab broadcasts the
   * result here so the original tab can complete the connection seamlessly.
   */
  private _setupBroadcastListener(): void {
    if (typeof BroadcastChannel === 'undefined') return;
    try {
      this._broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL);
      this._broadcastChannel.onmessage = (event: MessageEvent) => {
        const data = event.data;
        if (!data || data.type !== 'zera-connect-result') return;
        // Don't process if already connected
        if (this._state === 'connected') return;

        const { publicKey, address } = data;
        if (!publicKey) return;

        this._publicKey = publicKey;
        this._address = address ?? null;
        this._connectionMode = 'deeplink';
        this._signer = new DeepLinkSigner(publicKey, this._config.deepLinkUrl, this._getCallbackUrl());
        this._state = 'connected';
        this._persistConnection();

        this._emit('connect', { publicKey, address, mode: 'deeplink' });
      };
    } catch {
      // BroadcastChannel not supported — fall back to normal redirect flow
    }
  }

  /**
   * Broadcast a connect result to other tabs and attempt to close this
   * (redirect) tab so the user returns to their original tab.
   */
  private _broadcastResult(data: { publicKey: string; address: string | null }): void {
    if (typeof BroadcastChannel === 'undefined') return;
    try {
      const bc = new BroadcastChannel(BROADCAST_CHANNEL);
      bc.postMessage({ type: 'zera-connect-result', ...data });
      bc.close();

      // Try to close this duplicate tab.
      // window.close() works on mobile Safari/Chrome in most cases when the
      // tab was opened by the OS via deep-link redirect (not user-initiated).
      setTimeout(() => {
        try { window.close(); } catch { /* ignore */ }
      }, 300);
    } catch {
      // BroadcastChannel not supported — user will just stay in the new tab
    }
  }

  // ── Private: Helpers ─────────────────────────────────────────────────

  private _detectProvider(): ZeraProvider | null {
    if (typeof window === 'undefined') return null;
    const win = window as unknown as Record<string, unknown>;
    const provider = win.zera as ZeraProvider | undefined;
    if (provider?.isZeraWallet) return provider;
    return null;
  }

  private _getCallbackUrl(): string {
    if (this._config.callbackUrl) return this._config.callbackUrl;
    if (typeof window === 'undefined') return '';

    // Strip existing zera_* params from current URL
    const url = new URL(window.location.href);
    url.searchParams.delete(PARAM_RESULT);
    url.searchParams.delete(PARAM_REQUEST_ID);
    url.searchParams.delete(PARAM_ERROR);
    return url.toString();
  }

  private _generateRequestId(): string {
    return `zr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  private _emit(event: string, ...args: unknown[]): void {
    const handlers = this._listeners[event];
    if (!handlers) return;
    for (const handler of handlers) {
      try { handler(...args); } catch { /* swallow listener errors */ }
    }
  }
}
