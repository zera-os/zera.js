#!/usr/bin/env node

/**
 * TypeScript Test Runner for ZERA JS SDK
 * 
 * This script runs TypeScript tests with proper type checking and compilation.
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message: string, color: string = colors.reset): void {
  console.log(`${color}${message}${colors.reset}`);
}

function exec(command: string, options: any = {}): void {
  try {
    execSync(command, { 
      stdio: 'inherit', 
      cwd: projectRoot,
      ...options 
    });
  } catch (error) {
    log(`❌ Command failed: ${command}`, colors.red);
    throw error;
  }
}

function runTypeScriptTests(): void {
  log('🧪 Running TypeScript tests...', colors.blue);
  
  // Check if TypeScript tests exist
  const testFiles = [
    'src/wallet-creation/tests/test-wallet-simple.ts',
    'src/coin-txn/tests/test-coin-txn.ts',
    'src/shared/fee-calculators/test/test-unified-fee-calculation.ts'
  ];
  
  const existingTests = testFiles.filter(file => existsSync(join(projectRoot, file)));
  
  if (existingTests.length === 0) {
    log('⚠️  No TypeScript test files found, running JavaScript tests instead', colors.yellow);
    exec('node test-runner.js');
    return;
  }
  
  log(`Found ${existingTests.length} TypeScript test files:`, colors.cyan);
  existingTests.forEach(file => log(`  • ${file}`, colors.reset));
  
  // Run TypeScript tests using ts-node
  try {
    exec('npx ts-node --esm src/wallet-creation/tests/test-wallet-simple.ts');
    log('✅ TypeScript tests completed successfully', colors.green);
  } catch (error) {
    log('❌ TypeScript tests failed', colors.red);
    throw error;
  }
}

function runJavaScriptTests(): void {
  log('🧪 Running JavaScript tests...', colors.blue);
  exec('node test-runner.js');
  log('✅ JavaScript tests completed successfully', colors.green);
}

function runAllTests(): void {
  log('🚀 Starting comprehensive test suite...', colors.bright);
  log('', colors.reset);
  
  try {
    // First run TypeScript tests
    runTypeScriptTests();
    log('', colors.reset);
    
    // Then run JavaScript tests
    runJavaScriptTests();
    log('', colors.reset);
    
    log('🎉 All tests completed successfully!', colors.green);
    
  } catch (error) {
    log('', colors.reset);
    log('❌ Tests failed!', colors.red);
    log(`Error: ${(error as Error).message}`, colors.red);
    process.exit(1);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
case 'ts':
case 'typescript':
  runTypeScriptTests();
  break;
case 'js':
case 'javascript':
  runJavaScriptTests();
  break;
case 'all':
  runAllTests();
  break;
case 'help':
case '--help':
case '-h':
  log('ZERA JS SDK TypeScript Test Runner', colors.bright);
  log('', colors.reset);
  log('Usage: npm run test:ts [command]', colors.reset);
  log('', colors.reset);
  log('Commands:', colors.reset);
  log('  (no command)  - Run TypeScript tests only', colors.reset);
  log('  ts            - Run TypeScript tests only', colors.reset);
  log('  js            - Run JavaScript tests only', colors.reset);
  log('  all           - Run all tests (TypeScript + JavaScript)', colors.reset);
  log('  help          - Show this help message', colors.reset);
  break;
default:
  if (command) {
    log(`Unknown command: ${command}`, colors.red);
    log('Run "npm run test:ts help" for available commands', colors.yellow);
    process.exit(1);
  } else {
    runTypeScriptTests();
  }
  break;
}
