/**
 * ZERA MWA Protocol Constants
 *
 * Defines the intent actions, URI schemes, and protocol version
 * for ZERA Mobile Wallet Adapter discovery and communication.
 */

/** Protocol version */
export const ZERA_MWA_VERSION = '1.0.0';

/** Android intent action for ZERA MWA wallet discovery */
export const ZERA_MWA_INTENT_ACTION = 'zera-wallet-adapter:v1';

/** URI scheme for ZERA MWA association */
export const ZERA_MWA_SCHEME = 'zera-wallet-mwa';

/** Default WebSocket port for local MWA sessions */
export const ZERA_MWA_DEFAULT_PORT = 8394;

/**
 * Supported ZERA MWA methods.
 * These are the JSON-RPC method names used over the WebSocket session.
 */
export const MWA_METHODS = {
  /** Request authorization from the wallet */
  AUTHORIZE: 'zera_authorize',
  /** Re-authorize with a previously issued auth token */
  REAUTHORIZE: 'zera_reauthorize',
  /** Deauthorize / disconnect */
  DEAUTHORIZE: 'zera_deauthorize',
  /** Sign a ZERA transaction */
  SIGN_TRANSACTION: 'zera_signTransaction',
  /** Sign an arbitrary message */
  SIGN_MESSAGE: 'zera_signMessage'
} as const;

/** Default cluster (network) */
export const DEFAULT_CLUSTER = 'mainnet';
