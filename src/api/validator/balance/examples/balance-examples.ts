/**
 * Validator Balance Service Examples
 * 
 * This provides examples for the validator balance service.
 */

import { MAINNET_GRPC_CONFIG } from '../../../../shared/utils/testing-defaults/index.js';
import { TEST_WALLET_ADDRESSES } from '../../../../test-utils/index.js';
import { getBalance, getBalances } from '../service.js';

/**
 * Example 1: Basic Usage - Get balance for a single address
 */
async function basicUsageExample(): Promise<void> {
  console.log('Getting balance for Alice\'s address...');
  
  const address = TEST_WALLET_ADDRESSES.alice;
  const contractId = '$ZRA+0000'; // ZERA native token
  
  const balance = await getBalance(address, contractId, MAINNET_GRPC_CONFIG);
  
  console.log(`Address: ${address}`);
  console.log(`Contract ID: ${contractId}`);
  console.log(`Balance (raw): ${balance.balance}`);
  console.log(`Balance Nice: ${balance.balanceNice}`);
  console.log(`Denomination: ${balance.denomination}`);
  console.log(`Rate (raw): ${balance.rate}`);
  console.log(`Rate Nice: ${balance.rateNice}`);
  
  if (!balance.balance) {
    throw new Error('No balance returned');
  }
}

/**
 * Example 2: Get balance for multiple addresses
 */
async function multipleBalancesExample(): Promise<void> {
  console.log('Getting balances for multiple test addresses...');
  
  const addresses = [
    TEST_WALLET_ADDRESSES.alice,
    TEST_WALLET_ADDRESSES.bob,
    TEST_WALLET_ADDRESSES.charlie
  ];
  const contractId = '$ZRA+0000';
  
  const balances = await getBalances(addresses, contractId);
  
  console.log(`Addresses: ${addresses.length}`);
  console.log(`Balances: ${balances.length}`);
  
  for (let i = 0; i < addresses.length; i++) {
    const balance = balances[i];
    console.log(`  ${addresses[i]}:`);
    console.log(`    Balance Nice: ${balance.balanceNice}`);
    console.log(`    Balance (raw): ${balance.balance}`);
    console.log(`    Denomination: ${balance.denomination}`);
    console.log(`    Rate Nice: ${balance.rateNice}`);
    console.log(`    Rate (raw): ${balance.rate}`);
  }
  
  if (balances.length !== addresses.length) {
    throw new Error('Balance count mismatch');
  }
}

/**
 * Example 3: Get balance for different contract IDs
 */
async function multipleContractsExample(): Promise<void> {
  console.log('Getting balances for different contract IDs...');
  
  const address = TEST_WALLET_ADDRESSES.alice;
  const contractIds = ['$ZRA+0000', '$IIT+0000'];
  
  for (const contractId of contractIds) {
    try {
      const balance = await getBalance(address, contractId);
      console.log(`Contract ID: ${contractId}`);
      console.log(`  Balance Nice: ${balance.balanceNice}`);
      console.log(`  Balance (raw): ${balance.balance}`);
      console.log(`  Denomination: ${balance.denomination}`);
      console.log(`  Rate Nice: ${balance.rateNice}`);
      console.log(`  Rate (raw): ${balance.rate}`);
    } catch (error) {
      console.log(`  Error fetching balance for ${contractId}: ${(error as Error).message}`);
    }
  }
}
