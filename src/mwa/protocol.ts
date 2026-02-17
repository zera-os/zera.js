/**
 * ZERA MWA Protocol — Message Types
 *
 * Defines the request/response shapes for all ZERA MWA methods.
 * These are sent as JSON over a local WebSocket connection between
 * a dApp and the wallet.
 */

import { MWA_METHODS } from './constants';

// ── Identity ────────────────────────────────────────────────────────────────

/** dApp identity provided during authorization */
export interface MwaAppIdentity {
  name: string;
  uri?: string;
  icon?: string;
}

// ── Authorization ───────────────────────────────────────────────────────────

export interface MwaAuthorizeRequest {
  method: typeof MWA_METHODS.AUTHORIZE;
  params: {
    identity: MwaAppIdentity;
    cluster?: string;
  };
}

export interface MwaAuthorizeResponse {
  publicKey: string;   // base58 or hex public key
  address: string;     // human-readable address
  authToken: string;   // opaque session token
  walletName: string;  // e.g. "VisionHub"
}

// ── Reauthorization ─────────────────────────────────────────────────────────

export interface MwaReauthorizeRequest {
  method: typeof MWA_METHODS.REAUTHORIZE;
  params: {
    authToken: string;
  };
}

export interface MwaReauthorizeResponse {
  authToken: string;
}

// ── Deauthorization ─────────────────────────────────────────────────────────

export interface MwaDeauthorizeRequest {
  method: typeof MWA_METHODS.DEAUTHORIZE;
  params: {
    authToken: string;
  };
}

// ── Sign Transaction ────────────────────────────────────────────────────────

export interface MwaSignTransactionRequest {
  method: typeof MWA_METHODS.SIGN_TRANSACTION;
  params: {
    /** Base64-encoded serialized transaction bytes */
    payload: string;
    /** Optional: transaction type hint (e.g. 'CoinTxn', 'VoteTxn') */
    txnType?: string;
  };
}

export interface MwaSignTransactionResponse {
  /** Base64-encoded signature */
  signature: string;
  /** Base64-encoded signed transaction (optional — some wallets return full signed txn) */
  signedPayload?: string;
}

// ── Sign Message ────────────────────────────────────────────────────────────

export interface MwaSignMessageRequest {
  method: typeof MWA_METHODS.SIGN_MESSAGE;
  params: {
    /** Base64-encoded message bytes */
    message: string;
    /** Optional display text for the user */
    displayMessage?: string;
  };
}

export interface MwaSignMessageResponse {
  /** Base64-encoded signature */
  signature: string;
}

// ── Union Types ─────────────────────────────────────────────────────────────

export type MwaRequest =
  | MwaAuthorizeRequest
  | MwaReauthorizeRequest
  | MwaDeauthorizeRequest
  | MwaSignTransactionRequest
  | MwaSignMessageRequest;

export type MwaResponse =
  | MwaAuthorizeResponse
  | MwaReauthorizeResponse
  | MwaSignTransactionResponse
  | MwaSignMessageResponse;

// ── JSON-RPC Envelope ───────────────────────────────────────────────────────

export interface MwaJsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params: Record<string, unknown>;
}

export interface MwaJsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
  };
}

// ── Session State ───────────────────────────────────────────────────────────

export type MwaSessionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'authorized'
  | 'error';

export interface MwaSessionInfo {
  state: MwaSessionState;
  publicKey?: string;
  address?: string;
  authToken?: string;
  walletName?: string;
  appIdentity?: MwaAppIdentity;
}
