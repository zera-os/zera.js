/**
 * Wallet Adapter - Unit Tests
 */

import { describe, it, expect } from 'vitest';

import { CoinTXN, GovernanceVote } from '../../../proto/generated/txn_pb.js';
import { ED25519_TEST_KEYS } from '../../test-utils/keys.test.js';

import { KeyPairSigner, type ZeraSigner } from '../signer.js';
import { serializeTransaction, deserializeTransaction, getRegisteredTypes } from '../serialization.js';

// ============================================================================
// Test Helpers
// ============================================================================

function getTestKeyPair() {
  const keys = ED25519_TEST_KEYS.alice;
  return {
    publicKey: keys.publicKey,
    privateKey: keys.privateKey
  };
}

// ============================================================================
// KeyPairSigner Tests
// ============================================================================

describe('KeyPairSigner', () => {
  it('should construct with valid public and private keys', () => {
    const { publicKey, privateKey } = getTestKeyPair();
    const signer = new KeyPairSigner(publicKey, privateKey);

    expect(signer.publicKey).toBe(publicKey);
  });

  it('should throw when publicKey is missing', () => {
    expect(() => new KeyPairSigner('', 'somePrivateKey')).toThrow('publicKey is required');
  });

  it('should throw when privateKey is missing', () => {
    expect(() => new KeyPairSigner('somePublicKey', '')).toThrow('privateKey is required');
  });

  it('should produce a valid signature', async () => {
    const { publicKey, privateKey } = getTestKeyPair();
    const signer = new KeyPairSigner(publicKey, privateKey);

    const data = new Uint8Array([1, 2, 3, 4, 5]);
    const signature = await signer.sign(data);

    // Ed25519 signatures are 64 bytes
    expect(signature).toBeInstanceOf(Uint8Array);
    expect(signature.length).toBe(64);
  });

  it('should produce deterministic signatures for the same data', async () => {
    const { publicKey, privateKey } = getTestKeyPair();
    const signer = new KeyPairSigner(publicKey, privateKey);

    const data = new Uint8Array([10, 20, 30]);
    const sig1 = await signer.sign(data);
    const sig2 = await signer.sign(data);

    expect(sig1).toEqual(sig2);
  });

  it('should produce different signatures for different data', async () => {
    const { publicKey, privateKey } = getTestKeyPair();
    const signer = new KeyPairSigner(publicKey, privateKey);

    const sig1 = await signer.sign(new Uint8Array([1, 2, 3]));
    const sig2 = await signer.sign(new Uint8Array([4, 5, 6]));

    expect(sig1).not.toEqual(sig2);
  });

  it('should implement ZeraSigner interface', () => {
    const { publicKey, privateKey } = getTestKeyPair();
    const signer: ZeraSigner = new KeyPairSigner(publicKey, privateKey);

    expect(signer.publicKey).toBe(publicKey);
    expect(typeof signer.sign).toBe('function');
  });
});

// ============================================================================
// Custom ZeraSigner Tests
// ============================================================================

describe('Custom ZeraSigner', () => {
  it('should accept a custom implementation', async () => {
    const mockSignature = new Uint8Array(64).fill(42);

    const customSigner: ZeraSigner = {
      publicKey: 'custom:mock-public-key',
      async sign(_data: Uint8Array): Promise<Uint8Array> {
        return mockSignature;
      }
    };

    const result = await customSigner.sign(new Uint8Array([1]));
    expect(result).toEqual(mockSignature);
    expect(customSigner.publicKey).toBe('custom:mock-public-key');
  });
});

// ============================================================================
// Serialization Tests (Universal Protobuf Registry)
// ============================================================================

describe('Serialization', () => {
  it('should serialize and deserialize a CoinTXN roundtrip', () => {
    const txn = new CoinTXN({
      contractId: '$ZRA+0000'
    });

    const envelope = serializeTransaction(txn);

    // Uses the fully-qualified protobuf type name
    expect(envelope.type).toBe('zera_txn.CoinTXN');
    expect(envelope.version).toBe(1);
    expect(typeof envelope.data).toBe('string');
    expect(envelope.data.length).toBeGreaterThan(0);

    const restored = deserializeTransaction(envelope) as CoinTXN;
    expect(restored).toBeInstanceOf(CoinTXN);
    expect(restored.contractId).toBe('$ZRA+0000');
  });

  it('should serialize and deserialize GovernanceVote (proving universality)', () => {
    const vote = new GovernanceVote({
      contractId: '$ZRA+0000'
    });

    const envelope = serializeTransaction(vote);
    expect(envelope.type).toBe('zera_txn.GovernanceVote');

    const restored = deserializeTransaction(envelope) as GovernanceVote;
    expect(restored).toBeInstanceOf(GovernanceVote);
    expect(restored.contractId).toBe('$ZRA+0000');
  });

  it('should deserialize from a JSON string', () => {
    const txn = new CoinTXN({
      contractId: '$TEST+0001'
    });

    const envelope = serializeTransaction(txn);
    const json = JSON.stringify(envelope);

    const restored = deserializeTransaction(json) as CoinTXN;
    expect(restored).toBeInstanceOf(CoinTXN);
    expect(restored.contractId).toBe('$TEST+0001');
  });

  it('should throw for invalid envelope', () => {
    expect(() => deserializeTransaction({ type: 'zera_txn.CoinTXN', data: '', version: 1 }))
      .toThrow('Invalid serialized transaction');
  });

  it('should throw for unsupported version', () => {
    expect(() => deserializeTransaction({ type: 'zera_txn.CoinTXN', data: 'abc', version: 99 as never }))
      .toThrow('Unsupported serialization version');
  });

  it('should throw for unknown type in deserialization', () => {
    expect(() => deserializeTransaction({ type: 'zera_txn.NonExistent', data: 'abc', version: 1 }))
      .toThrow('Unknown protobuf type');
  });
});

// ============================================================================
// Type Registry Tests
// ============================================================================

describe('Type Registry', () => {
  it('should auto-discover all protobuf types from txn_pb', () => {
    const types = getRegisteredTypes();

    // Should discover many types from the generated protobuf module
    expect(types.length).toBeGreaterThan(10);

    // Key transaction types should be present
    expect(types).toContain('zera_txn.CoinTXN');
    expect(types).toContain('zera_txn.GovernanceVote');
    expect(types).toContain('zera_txn.SmartContractExecuteTXN');
    expect(types).toContain('zera_txn.InstrumentContract');
    expect(types).toContain('zera_txn.ContractUpdateTXN');
    expect(types).toContain('zera_txn.MintTXN');
    expect(types).toContain('zera_txn.NFTTXN');
  });
});
