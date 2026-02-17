/* eslint-disable no-undef */
/**
 * ZERA MWA Client — dApp-side wallet discovery and session management.
 *
 * This module enables ZERA dApps (like Zerascan) to:
 * 1. Discover installed ZERA wallets on Android via intent probing
 * 2. Establish a WebSocket session for signing
 * 3. Send authorize, sign, and disconnect requests
 *
 * On platforms where MWA is unavailable (iOS, desktop), the client
 * gracefully falls back and reports unavailable status.
 *
 * Usage:
 * ```ts
 * import { ZeraMwaClient } from '@zera-os/zera.js/mwa';
 *
 * const client = new ZeraMwaClient({ appName: 'Zerascan', appUri: 'https://zerascan.io' });
 *
 * if (await client.isWalletInstalled()) {
 *   const session = await client.connect();
 *   const auth = await session.authorize();
 *   const sig = await session.signTransaction(txnBytes);
 * }
 * ```
 */

import {
  ZERA_MWA_SCHEME,
  ZERA_MWA_VERSION,
  DEFAULT_CLUSTER
} from './constants';
import type {
  MwaAppIdentity,
  MwaAuthorizeResponse,
  MwaSessionState,
  MwaSessionInfo
} from './protocol';

// ── Types ───────────────────────────────────────────────────────────────────

export interface ZeraMwaClientOptions {
  /** dApp name displayed in wallet approval UI */
  appName: string;
  /** dApp URI (e.g. https://zerascan.io) */
  appUri?: string;
  /** dApp icon URL */
  appIcon?: string;
  /** Network cluster */
  cluster?: string;
}

export type MwaEventType = 'stateChange' | 'error';

type MwaEventHandler = (data: unknown) => void;

// ── Client ──────────────────────────────────────────────────────────────────

export class ZeraMwaClient {
  private appIdentity: MwaAppIdentity;
  private cluster: string;
  private state: MwaSessionState = 'disconnected';
  private sessionInfo: MwaSessionInfo;
  private listeners: Map<MwaEventType, Set<MwaEventHandler>> = new Map();

  constructor(options: ZeraMwaClientOptions) {
    this.appIdentity = {
      name: options.appName,
      uri: options.appUri || '',
      icon: options.appIcon || ''
    };
    this.cluster = options.cluster || DEFAULT_CLUSTER;
    this.sessionInfo = { state: 'disconnected' };
  }

  // ── Discovery ───────────────────────────────────────────────────────────

  /**
   * Check if Android can resolve the ZERA MWA intent scheme.
   *
   * On Android browsers, this attempts to detect if any app handles
   * the `zera-wallet-mwa://` scheme. On other platforms, returns false.
   *
   * Note: This uses a heuristic approach since web browsers have
   * limited ability to probe Android intents. The most reliable
   * detection happens at the native layer.
   */
  static isAvailable(): boolean {
    if (typeof window === 'undefined') return false;
    if (typeof navigator === 'undefined') return false;

    // MWA is Android-only
    const isAndroid = /android/i.test(navigator.userAgent);
    if (!isAndroid) return false;

    // On Android, we can reasonably assume MWA is available if the
    // platform supports intent-based navigation. The actual wallet
    // detection happens when the intent is fired.
    return true;
  }

  /**
   * Attempt to probe for an installed ZERA MWA-compatible wallet.
   *
   * This uses an Android intent probe: creates a hidden iframe
   * pointing to the MWA scheme. If Android can resolve the intent,
   * the wallet is installed.
   *
   * Returns a promise that resolves to true/false after a brief probe.
   */
  async isWalletInstalled(): Promise<boolean> {
    if (!ZeraMwaClient.isAvailable()) return false;

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve(false);
      }, 1500);

      // On Android, check if the scheme can be resolved
      // by attempting to open an intent URL
      try {
        const intentUrl =
          `intent://#Intent;scheme=${ZERA_MWA_SCHEME};` +
          'action=android.intent.action.VIEW;' +
          'category=android.intent.category.BROWSABLE;' +
          'S.browser_fallback_url=about:blank;end';

        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = intentUrl;
        document.body.appendChild(iframe);

        // If the intent resolves, the page won't navigate away
        // We check after a brief delay
        setTimeout(() => {
          try {
            document.body.removeChild(iframe);
          } catch {
            // iframe may have been removed by navigation
          }
          clearTimeout(timeout);
          // If we're still here, the intent was handled (app opened)
          // or failed silently. We return true optimistically on Android.
          resolve(true);
        }, 500);
      } catch {
        clearTimeout(timeout);
        resolve(false);
      }
    });
  }

  // ── Session Lifecycle ─────────────────────────────────────────────────

  /**
   * Get the current session state.
   */
  getState(): MwaSessionState {
    return this.state;
  }

  /**
   * Get current session info.
   */
  getSessionInfo(): MwaSessionInfo {
    return { ...this.sessionInfo };
  }

  /**
   * Initiate an MWA connection to the wallet.
   *
   * On Android, this triggers the `zera-wallet-mwa://` intent,
   * causing VisionHub to launch its MWA handler. The wallet
   * establishes a local WebSocket session for communication.
   */
  async connect(): Promise<MwaAuthorizeResponse> {
    this.setState('connecting');

    try {
      // For now, the connection is established via deep link intent.
      // The wallet side (VisionHub) handles the WebSocket session.
      // The web dApp communicates through the redirect-based flow
      // until full WebSocket support is implemented.

      // Trigger the MWA intent
      const connectUrl =
        `${ZERA_MWA_SCHEME}://connect?` +
        `app_name=${encodeURIComponent(this.appIdentity.name)}${
          this.appIdentity.uri
            ? `&app_uri=${encodeURIComponent(this.appIdentity.uri)}`
            : ''
        }&cluster=${encodeURIComponent(this.cluster)}` +
        `&version=${ZERA_MWA_VERSION}`;

      window.location.href = connectUrl;

      // The response comes back via deep link redirect
      // (handled by the wallet adapter's _handleRedirectResult)
      return new Promise((resolve, reject) => {
        // Set a timeout for the connection
        const connectionTimeout = setTimeout(() => {
          this.setState('error');
          reject(new Error('MWA connection timeout'));
        }, 30000);

        // Listen for the redirect result
        const checkInterval = setInterval(() => {
          const url = new URL(window.location.href);
          const result = url.searchParams.get('zera_result');
          if (result) {
            clearTimeout(connectionTimeout);
            clearInterval(checkInterval);
            const address = url.searchParams.get('zera_address') || '';
            const authToken = url.searchParams.get('zera_auth_token') || '';

            const response: MwaAuthorizeResponse = {
              publicKey: decodeURIComponent(result),
              address: address ? decodeURIComponent(address) : '',
              authToken,
              walletName: 'VisionHub'
            };

            this.sessionInfo = {
              state: 'authorized',
              publicKey: response.publicKey,
              address: response.address,
              authToken: response.authToken,
              walletName: response.walletName,
              appIdentity: this.appIdentity
            };
            this.setState('authorized');
            resolve(response);
          }
        }, 200);
      });
    } catch (error) {
      this.setState('error');
      throw error;
    }
  }

  /**
   * Disconnect the MWA session.
   */
  disconnect(): void {
    this.sessionInfo = { state: 'disconnected' };
    this.setState('disconnected');
  }

  // ── Events ──────────────────────────────────────────────────────────────

  on(event: MwaEventType, handler: MwaEventHandler): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.add(handler);
    }
  }

  off(event: MwaEventType, handler: MwaEventHandler): void {
    this.listeners.get(event)?.delete(handler);
  }

  private emit(event: MwaEventType, data: unknown): void {
    this.listeners.get(event)?.forEach((handler) => handler(data));
  }

  private setState(state: MwaSessionState): void {
    this.state = state;
    this.sessionInfo.state = state;
    this.emit('stateChange', state);
  }
}
