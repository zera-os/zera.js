/**
 * Wallet Adapter - Transaction Serialization
 *
 * Universal, protobuf-driven encoding/decoding for ZERA transactions.
 * Instead of hardcoding supported types, this module auto-discovers all
 * protobuf message classes from the generated `txn_pb` module at runtime.
 *
 * Any new protobuf message type added to `txn_pb.ts` is automatically
 * supported — no code changes needed here.
 *
 * @module adapter/serialization
 */

import { Message } from '@bufbuild/protobuf';

import * as txn_pb from '../../proto/generated/txn_pb.js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * A serialized transaction envelope containing the protobuf type name
 * and the base64-encoded binary data.
 */
export interface SerializedTransaction {
  /** Fully-qualified protobuf type name (e.g., "zera_txn.CoinTXN") */
  type: string;
  /** Base64-encoded protobuf bytes */
  data: string;
  /** Serialization format version (for forward compatibility) */
  version: 1;
}

// ============================================================================
// PROTOBUF TYPE REGISTRY (auto-populated from generated code)
// ============================================================================

/**
 * Interface for a protobuf message constructor (class) that we can call
 * `fromBinary` on to reconstruct the message.
 */
interface MessageConstructor {
  readonly typeName: string;
  fromBinary(bytes: Uint8Array): Message;
}

/**
 * Auto-discovered registry: maps protobuf type names to their constructors.
 *
 * At module load time, we iterate over all exports from `txn_pb` and register
 * any class that has `typeName` and `fromBinary` — i.e., any generated
 * protobuf message class.
 */
const typeRegistry = new Map<string, MessageConstructor>();

// Populate the registry from all txn_pb exports
for (const [, exported] of Object.entries(txn_pb)) {
  if (
    typeof exported === 'function' &&
    'typeName' in exported &&
    typeof (exported as MessageConstructor).typeName === 'string' &&
    'fromBinary' in exported &&
    typeof (exported as MessageConstructor).fromBinary === 'function'
  ) {
    const constructor = exported as MessageConstructor;
    typeRegistry.set(constructor.typeName, constructor);
  }
}

// ============================================================================
// BASE64 (Works in Node, browsers, and React Native)
// ============================================================================

function toBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i] as number);
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
// PUBLIC API
// ============================================================================

/**
 * Serialize any protobuf transaction into a portable string envelope.
 *
 * Uses the protobuf's built-in `typeName` (e.g., `"zera_txn.CoinTXN"`)
 * as the type discriminator, so **every** generated protobuf message type
 * is supported automatically — no manual mapping needed.
 *
 * @param txn - Any protobuf `Message` instance (CoinTXN, GovernanceVote, etc.)
 * @returns A `SerializedTransaction` envelope
 *
 * @example
 * ```typescript
 * const envelope = serializeTransaction(coinTxn);
 * // envelope.type === "zera_txn.CoinTXN"
 * const json = JSON.stringify(envelope); // send over the wire
 * ```
 */
export function serializeTransaction(txn: Message): SerializedTransaction {
  const typeName = txn.getType().typeName;

  if (!typeRegistry.has(typeName)) {
    throw new Error(`Unknown protobuf type "${typeName}" — not found in txn_pb registry`);
  }

  return {
    type: typeName,
    data: toBase64(txn.toBinary()),
    version: 1
  };
}

/**
 * Deserialize a `SerializedTransaction` envelope back into a protobuf object.
 *
 * Looks up the type name in the auto-populated registry and calls `fromBinary`
 * on the corresponding class.
 *
 * @param envelope - The serialized envelope (or its JSON string representation)
 * @returns The reconstructed protobuf `Message` instance
 *
 * @example
 * ```typescript
 * const txn = deserializeTransaction(envelope);
 * if (txn instanceof CoinTXN) { ... }
 * ```
 */
export function deserializeTransaction(envelope: SerializedTransaction | string): Message {
  const parsed: SerializedTransaction = typeof envelope === 'string'
    ? JSON.parse(envelope) as SerializedTransaction
    : envelope;

  if (!parsed.type || !parsed.data) {
    throw new Error('Invalid serialized transaction: missing type or data');
  }
  if (parsed.version !== 1) {
    throw new Error(`Unsupported serialization version: ${parsed.version}`);
  }

  const constructor = typeRegistry.get(parsed.type);
  if (!constructor) {
    throw new Error(
      `Unknown protobuf type "${parsed.type}" — not found in registry. ` +
      `Available types: ${[...typeRegistry.keys()].join(', ')}`
    );
  }

  const bytes = fromBase64(parsed.data);
  return constructor.fromBinary(bytes);
}

/**
 * Get all registered protobuf type names.
 * Useful for debugging or discovering available types.
 *
 * @returns Array of fully-qualified protobuf type names
 */
export function getRegisteredTypes(): string[] {
  return [...typeRegistry.keys()];
}
