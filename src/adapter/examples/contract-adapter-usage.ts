/**
 * Adapter Example — Contract Create & Update
 *
 * Demonstrates building unsigned contract creation and update transactions
 * and signing them externally via the adapter module.
 */

import { sendCreateContract, sendUpdateContract } from '../../contract/index.js';
import { MAINNET_GRPC_CONFIG } from '../../shared/utils/testing-defaults/index.js';
import { ED25519_TEST_KEYS } from '../../test-utils/keys.test.js';
import {
  buildContractTXN,
  buildContractUpdateTXN,
  signAndFinalize,
  KeyPairSigner
} from '../index.js';

// ============================================================================
// Example 1: Create a new contract
// ============================================================================

export async function exampleCreateContract(): Promise<void> {
  console.log('📄 Example 1: Create Contract via Adapter');

  const alice = ED25519_TEST_KEYS.alice;
  const signer = new KeyPairSigner(alice.publicKey, alice.privateKey);

  // Build unsigned — identical fields to createContract(), minus privateKeyBase58
  const unsigned = await buildContractTXN({
    contractVersion: BigInt(1000000),
    symbol: 'MYT',
    name: 'My Token',
    type: 0, // TOKEN
    contractId: '$MYT+0000',
    publicKeyBase58Identifier: alice.publicKey,
    coinDenomination: {} as any, // would be a real CoinDenomination in production
    grpcConfig: MAINNET_GRPC_CONFIG,
    feeAmountParts: '1',
    nonce: '0'
  });
  console.log('  ✅ Unsigned contract creation built');

  // Sign
  const signed = await signAndFinalize(unsigned, signer);
  console.log('  ✅ Contract signed —', signed.base?.signature ? 'ok' : 'ERROR');

  // Send
  // const result = await sendCreateContract(signed, MAINNET_GRPC_CONFIG);
  // console.log('  🎉 Sent:', result);
}

// ============================================================================
// Example 2: Update an existing contract
// ============================================================================

export async function exampleUpdateContract(): Promise<void> {
  console.log('📄 Example 2: Update Contract via Adapter');

  const alice = ED25519_TEST_KEYS.alice;
  const signer = new KeyPairSigner(alice.publicKey, alice.privateKey);

  const unsigned = await buildContractUpdateTXN({
    contractId: '$MYT+0000',
    contractVersion: BigInt(1000001),
    publicKeyBase58Identifier: alice.publicKey,
    name: 'My Updated Token',
    grpcConfig: MAINNET_GRPC_CONFIG,
    feeAmountParts: '1',
    nonce: '1'
  });
  console.log('  ✅ Unsigned contract update built');

  const signed = await signAndFinalize(unsigned, signer);
  console.log('  ✅ Update signed —', signed.base?.signature ? 'ok' : 'ERROR');

  // const result = await sendUpdateContract(signed, MAINNET_GRPC_CONFIG);
  // console.log('  🎉 Sent:', result);
}
