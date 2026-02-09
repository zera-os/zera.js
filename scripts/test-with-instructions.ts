#!/usr/bin/env tsx

import { execSync } from 'child_process';

import chalk from 'chalk';

/**
 * Enhanced test runner with module instructions
 * Shows helpful commands at the start and runs tests
 */

function showModuleInstructions(): void {
  console.log(chalk.blue('🚀 Starting ZERA JS SDK Test Suite...'));
  console.log(chalk.gray('='.repeat(80)));
  console.log(chalk.cyan('📋 Module-Specific Test Commands:'));
  console.log('');
  
  const modules = [
    {
      name: 'wallet-creation',
      description: 'Wallet creation, HD wallets, key generation',
      commands: [
        'npm run test:wallet-creation',
        'npm run test:wallet-creation:watch',
        'npm run test:wallet-creation:coverage'
      ]
    },
    {
      name: 'coin-txn',
      description: 'Coin transactions, fee calculation, validation',
      commands: [
        'npm run test:coin-txn',
        'npm run test:coin-txn:watch',
        'npm run test:coin-txn:coverage'
      ]
    },
    {
      name: 'grpc',
      description: 'gRPC clients, API services, network communication',
      commands: [
        'npm run test:grpc',
        'npm run test:grpc:watch',
        'npm run test:grpc:coverage'
      ]
    },
    {
      name: 'shared',
      description: 'Shared utilities, crypto functions, fee calculators',
      commands: [
        'npm run test:shared',
        'npm run test:shared:watch',
        'npm run test:shared:coverage'
      ]
    },
    {
      name: 'api',
      description: 'API services, nonce management, exchange rates',
      commands: [
        'npm run test:api',
        'npm run test:api:watch',
        'npm run test:api:coverage'
      ]
    }
  ];
  
  modules.forEach(module => {
    console.log(chalk.yellow(`🔧 ${module.name.toUpperCase()}`));
    console.log(chalk.gray(`   ${module.description}`));
    module.commands.forEach(cmd => {
      console.log(chalk.green(`   ${cmd}`));
    });
    console.log('');
  });
  
  console.log(chalk.cyan('🌐 Global Commands:'));
  console.log(chalk.green('   npm test              # Run all tests'));
  console.log(chalk.green('   npm run test:watch    # Watch mode'));
  console.log(chalk.green('   npm run test:ui       # Web UI'));
  console.log(chalk.green('   npm run test:coverage # Coverage report'));
  console.log('');
  console.log(chalk.gray('='.repeat(80)));
  console.log('');
}

function main(): void {
  try {
    showModuleInstructions();
    
    // Run the actual tests
    console.log(chalk.blue('🧪 Running tests...'));
    console.log('');
    
    execSync('vitest run', { 
      stdio: 'inherit',
      cwd: process.cwd()
    });
    
  } catch (error) {
    console.error(chalk.red('❌ Test execution failed:'), error);
    process.exit(1);
  }
}

// Run the script
main();
