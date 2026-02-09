/**
 * Contract Module
 * 
 * This module provides functionality for creating and updating contracts on the ZERA Network.
 * 
 * @example
 * ```typescript
 * import { createContract, updateContract } from '@zera/sdk/contract';
 * 
 * // Create a new contract
 * const contract = await createContract({
 *   contractVersion: BigInt(0),
 *   symbol: 'MYT',
 *   name: 'My Token',
 *   type: 0,
 *   contractId: '$MYT+0000',
 *   publicKeyBase58Identifier: '...',
 *   privateKeyBase58: '...'
 * });
 * 
 * // Update an existing contract
 * const update = await updateContract({
 *   contractId: '$MYT+0000',
 *   contractVersion: BigInt(1),
 *   publicKeyBase58Identifier: '...',
 *   privateKeyBase58: '...',
 *   name: 'Updated Name'
 * });
 * ```
 */

export * from './create/index.js';
export * from './update/index.js';
export * from './shared/index.js';

