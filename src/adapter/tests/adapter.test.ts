/**
 * Wallet Adapter - Unit Tests
 */

import { create } from '@bufbuild/protobuf';
import { describe, it, expect } from 'vitest';


import {
  CoinTXNSchema,
  GovernanceVoteSchema,
  BaseTXNSchema,
  SmartContractExecuteTXNSchema,
  InstrumentContractSchema,
  ContractUpdateTXNSchema
} from '../../../proto/generated/txn_pb.js';
import type {
  CoinTXN,
  GovernanceVote,
  BaseTXN,
  SmartContractExecuteTXN,
  InstrumentContract,
  ContractUpdateTXN
} from '../../../proto/generated/txn_pb.js';
import { buildContractTXN } from '../../contract/create/transaction.js';
import { buildContractUpdateTXN } from '../../contract/update/transaction.js';
import { signAndFinalize } from '../../sign/finalize.js';
import { KeyPairSigner, type ZeraSigner } from '../../sign/signer.js';
import { buildSmartContractExecuteTXN } from '../../smart-contracts/execute/transaction.js';
import { ED25519_TEST_KEYS } from '../../test-utils/keys.test.js';
import { buildVoteTXN, type BuildVoteTXNOptions } from '../../vote/transaction.js';
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
    const txn = create(CoinTXNSchema, {
      contractId: '$ZRA+0000'
    });

    const envelope = serializeTransaction(txn);

    // Uses the fully-qualified protobuf type name
    expect(envelope.type).toBe('zera_txn.CoinTXN');
    expect(envelope.version).toBe(1);
    expect(typeof envelope.data).toBe('string');
    expect(envelope.data.length).toBeGreaterThan(0);

    const restored = deserializeTransaction(envelope) as CoinTXN;
    expect((restored as any).$typeName).toBe('zera_txn.CoinTXN');
    expect(restored.contractId).toBe('$ZRA+0000');
  });

  it('should serialize and deserialize GovernanceVote (proving universality)', () => {
    const vote = create(GovernanceVoteSchema, {
      contractId: '$ZRA+0000'
    });

    const envelope = serializeTransaction(vote);
    expect(envelope.type).toBe('zera_txn.GovernanceVote');

    const restored = deserializeTransaction(envelope) as GovernanceVote;
    expect((restored as any).$typeName).toBe('zera_txn.GovernanceVote');
    expect(restored.contractId).toBe('$ZRA+0000');
  });

  it('should deserialize from a JSON string', () => {
    const txn = create(CoinTXNSchema, {
      contractId: '$TEST+0001'
    });

    const envelope = serializeTransaction(txn);
    const json = JSON.stringify(envelope);

    const restored = deserializeTransaction(json) as CoinTXN;
    expect((restored as any).$typeName).toBe('zera_txn.CoinTXN');
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

// ============================================================================
// Unsigned Builder Validation Tests
// ============================================================================


describe('buildVoteTXN — validation', () => {
  it('should throw if contractId is missing', async () => {
    await expect(
      buildVoteTXN('', 'aabb', 'pk', { support: true })
    ).rejects.toThrow('contractId is required');
  });

  it('should throw if proposalId is missing', async () => {
    await expect(
      buildVoteTXN('$ZRA+0000', '', 'pk', { support: true })
    ).rejects.toThrow('proposalId (hex) is required');
  });

  it('should throw if publicKey is missing', async () => {
    await expect(
      buildVoteTXN('$ZRA+0000', 'aabb', '', { support: true })
    ).rejects.toThrow('publicKey identifier is required');
  });

  it('should throw if both support and supportOption are set', async () => {
    await expect(
      buildVoteTXN('$ZRA+0000', 'aabb', 'pk', { support: true, supportOption: 2 })
    ).rejects.toThrow('Specify exactly one of');
  });

  it('should throw if neither support nor supportOption is set', async () => {
    await expect(
      buildVoteTXN('$ZRA+0000', 'aabb', 'pk', {})
    ).rejects.toThrow('Specify exactly one of');
  });

  it('should throw if proposalId is not valid hex', async () => {
    await expect(
      buildVoteTXN('$ZRA+0000', 'xyz', 'pk', { support: true })
    ).rejects.toThrow('Invalid proposalId');
  });
});

describe('buildContractTXN — validation', () => {
  it('should throw if contractId is invalid', async () => {
    await expect(
      buildContractTXN({
        contractId: 'bad', symbol: 'T', name: 'Test',
        contractVersion: BigInt(0), type: 0,
        publicKeyBase58Identifier: 'pk',
        coinDenomination: {} as any
      })
    ).rejects.toThrow('ContractId must be provided');
  });

  it('should throw if symbol is empty', async () => {
    await expect(
      buildContractTXN({
        contractId: '$TST+0000', symbol: '', name: 'Test',
        contractVersion: BigInt(0), type: 0,
        publicKeyBase58Identifier: 'pk',
        coinDenomination: {} as any
      })
    ).rejects.toThrow('Symbol must be provided');
  });

  it('should throw if publicKey is missing', async () => {
    await expect(
      buildContractTXN({
        contractId: '$TST+0000', symbol: 'TST', name: 'Test',
        contractVersion: BigInt(0), type: 0,
        publicKeyBase58Identifier: '',
        coinDenomination: {} as any
      })
    ).rejects.toThrow('Public key identifier is required');
  });
});

describe('buildContractUpdateTXN — validation', () => {
  it('should throw if contractId is invalid', async () => {
    await expect(
      buildContractUpdateTXN({
        contractId: 'bad', contractVersion: BigInt(1),
        publicKeyBase58Identifier: 'pk'
      })
    ).rejects.toThrow('ContractId must be provided');
  });

  it('should throw if version is less than 1', async () => {
    await expect(
      buildContractUpdateTXN({
        contractId: '$TST+0000', contractVersion: BigInt(0),
        publicKeyBase58Identifier: 'pk'
      })
    ).rejects.toThrow('version must be at least 1');
  });

  it('should throw if publicKey is missing', async () => {
    await expect(
      buildContractUpdateTXN({
        contractId: '$TST+0000', contractVersion: BigInt(1),
        publicKeyBase58Identifier: ''
      })
    ).rejects.toThrow('Public key identifier is required');
  });
});

describe('buildSmartContractExecuteTXN — validation', () => {
  it('should throw if smartContractName is missing', async () => {
    await expect(
      buildSmartContractExecuteTXN('', 0, 'fn', [], 'pk')
    ).rejects.toThrow('smartContractName is required');
  });

  it('should throw if functionName is missing', async () => {
    await expect(
      buildSmartContractExecuteTXN('sc', 0, '', [], 'pk')
    ).rejects.toThrow('functionName is required');
  });

  it('should throw if publicKeyBase58Identifier is missing', async () => {
    await expect(
      buildSmartContractExecuteTXN('sc', 0, 'fn', [], '')
    ).rejects.toThrow('publicKeyBase58Identifier is required');
  });
});

// ============================================================================
// signAndFinalize Roundtrip Test
// ============================================================================

describe('signAndFinalize — roundtrip', () => {
  it('should sign a GovernanceVote and populate signature + hash', async () => {
    const { publicKey, privateKey } = getTestKeyPair();
    const signer = new KeyPairSigner(publicKey, privateKey);

    // Construct a minimal GovernanceVote with a base
    const base = create(BaseTXNSchema, { feeAmount: '1', feeId: '$ZRA+0000' });
    const vote = create(GovernanceVoteSchema, { base, contractId: '$ZRA+0000', support: true });

    // Before signing: no signature, no hash
    expect(vote.base?.signature).toBeUndefined();
    expect(vote.base?.hash).toBeUndefined();

    const signed = await signAndFinalize(vote, signer);

    // After signing: both populated
    expect(signed.base?.signature).toBeInstanceOf(Uint8Array);
    expect(signed.base!.signature!.length).toBe(64);
    expect(signed.base?.hash).toBeInstanceOf(Uint8Array);
    expect(signed.base!.hash!.length).toBeGreaterThan(0);
  });

  it('should sign a SmartContractExecuteTXN and populate signature + hash', async () => {
    const { publicKey, privateKey } = getTestKeyPair();
    const signer = new KeyPairSigner(publicKey, privateKey);

    const base = create(BaseTXNSchema, { feeAmount: '1', feeId: '$ZRA+0000' });
    const exec = create(SmartContractExecuteTXNSchema, {
      base, smartContractName: 'test', function: 'call', instance: 0
    });

    const signed = await signAndFinalize(exec, signer);

    expect(signed.base?.signature).toBeInstanceOf(Uint8Array);
    expect(signed.base!.signature!.length).toBe(64);
    expect(signed.base?.hash).toBeInstanceOf(Uint8Array);
    expect(signed.base!.hash!.length).toBeGreaterThan(0);
  });

  it('should sign an InstrumentContract and populate signature + hash', async () => {
    const { publicKey, privateKey } = getTestKeyPair();
    const signer = new KeyPairSigner(publicKey, privateKey);

    const base = create(BaseTXNSchema, { feeAmount: '1', feeId: '$ZRA+0000' });
    const contract = create(InstrumentContractSchema, {
      base, symbol: 'TST', name: 'Test', contractId: '$TST+0000'
    });

    const signed = await signAndFinalize(contract, signer);

    expect(signed.base?.signature).toBeInstanceOf(Uint8Array);
    expect(signed.base!.signature!.length).toBe(64);
    expect(signed.base?.hash).toBeInstanceOf(Uint8Array);
  });

  it('should sign a ContractUpdateTXN and populate signature + hash', async () => {
    const { publicKey, privateKey } = getTestKeyPair();
    const signer = new KeyPairSigner(publicKey, privateKey);

    const base = create(BaseTXNSchema, { feeAmount: '1', feeId: '$ZRA+0000' });
    const update = create(ContractUpdateTXNSchema, {
      base, contractId: '$TST+0000', contractVersion: BigInt(1)
    });

    const signed = await signAndFinalize(update, signer);

    expect(signed.base?.signature).toBeInstanceOf(Uint8Array);
    expect(signed.base!.signature!.length).toBe(64);
    expect(signed.base?.hash).toBeInstanceOf(Uint8Array);
  });
});
