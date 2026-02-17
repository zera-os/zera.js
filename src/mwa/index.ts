/**
 * ZERA Mobile Wallet Adapter (MWA) Protocol
 *
 * Provides Android intent-based wallet discovery and session management
 * for ZERA dApps. This is the ZERA-native equivalent of Solana's MWA protocol.
 *
 * @module mwa
 */

// Protocol types
export type {
  MwaAppIdentity,
  MwaAuthorizeRequest,
  MwaAuthorizeResponse,
  MwaReauthorizeRequest,
  MwaReauthorizeResponse,
  MwaDeauthorizeRequest,
  MwaSignTransactionRequest,
  MwaSignTransactionResponse,
  MwaSignMessageRequest,
  MwaSignMessageResponse,
  MwaRequest,
  MwaResponse,
  MwaJsonRpcRequest,
  MwaJsonRpcResponse,
  MwaSessionState,
  MwaSessionInfo
} from './protocol';

// Client
export { ZeraMwaClient } from './client';
export type { ZeraMwaClientOptions, MwaEventType } from './client';

// Constants
export {
  ZERA_MWA_VERSION,
  ZERA_MWA_INTENT_ACTION,
  ZERA_MWA_SCHEME,
  MWA_METHODS,
  DEFAULT_CLUSTER
} from './constants';
