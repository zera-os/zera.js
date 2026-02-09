#!/usr/bin/env tsx

import { execSync } from 'child_process';
import { readFileSync } from 'fs';

import chalk from 'chalk';

/**
 * Custom test runner with clean output
 * Shows module instructions at top and breakdown at bottom
 */

interface TestResult {
  module: string;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
}

interface FailedTest {
  module: string;
  testName: string;
  error: string;
  filePath: string;
  lineNumber?: number;
}

function showModuleInstructions(): void {
  console.log(chalk.blue('🚀 Starting ZERA JS SDK Test Suite...'));
  console.log(chalk.gray('='.repeat(80)));
  console.log(chalk.cyan('📋 Module-Specific Test Commands:'));
  console.log('');
  
  // Show modules that have /test or /tests folders
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

function parseTestResults(jsonOutput: string): { results: TestResult[], failedTests: FailedTest[] } {
  try {
    const results = JSON.parse(jsonOutput);
    
    const moduleStats = new Map<string, TestResult>();
    const failedTests: FailedTest[] = [];
    
    // Process test results
    results.testResults?.forEach((file: any) => {
      const moduleName = getModuleFromPath(file.name);
      const stats = moduleStats.get(moduleName) || {
        module: moduleName,
        passed: 0,
        failed: 0,
        skipped: 0,
        duration: 0
      };
      
      file.assertionResults?.forEach((test: any) => {
        if (test.status === 'passed') {
          stats.passed++;
        } else if (test.status === 'failed') {
          stats.failed++;
          // Capture failed test details with file path and line number
          const errorMessage = test.failureMessages?.[0] || 'Unknown error';
          const filePath = file.name.replace(/\\/g, '/'); // Normalize path separators
          
          // Extract line number from error message if available
          const lineMatch = errorMessage.match(/at.*\((.+):(\d+):\d+\)/);
          const lineNumber = lineMatch ? parseInt(lineMatch[2]) : undefined;
          
          failedTests.push({
            module: moduleName,
            testName: test.title,
            error: errorMessage,
            filePath: filePath,
            lineNumber: lineNumber
          });
        } else if (test.status === 'skipped') {
          stats.skipped++;
        }
      });
      
      stats.duration += file.endTime - file.startTime;
      moduleStats.set(moduleName, stats);
    });
    
    const sortedResults = Array.from(moduleStats.values()).sort((a, b) => {
      const aTotal = a.passed + a.failed + a.skipped;
      const bTotal = b.passed + b.failed + b.skipped;
      return bTotal - aTotal;
    });
    
    return { results: sortedResults, failedTests };
    
  } catch (error) {
    console.log(chalk.yellow('⚠️  Could not parse test results, showing basic summary'));
    return { results: [], failedTests: [] };
  }
}

function getModuleFromPath(filePath: string): string {
  const pathParts = filePath.split('/');
  const srcIndex = pathParts.indexOf('src');
  if (srcIndex !== -1 && srcIndex + 1 < pathParts.length) {
    // Check if this is a test file in a /test or /tests folder
    const isTestFile = filePath.includes('/test/') || filePath.includes('/tests/');
    if (isTestFile) {
      // Find the module name (the folder that contains the test folder)
      for (let i = srcIndex + 1; i < pathParts.length; i++) {
        if (pathParts[i] === 'test' || pathParts[i] === 'tests') {
          // The module is the folder before the test folder
          if (i > srcIndex + 1) {
            return pathParts[i - 1];
          }
        }
      }
    }
    
    // Fallback to first level module
    return pathParts[srcIndex + 1];
  }
  return 'unknown';
}

function showFailedTests(failedTests: FailedTest[]): void {
  if (failedTests.length === 0) {
    return;
  }
  
  console.log(chalk.red('❌ Failed Tests:'));
  console.log(chalk.gray('-'.repeat(80)));
  
  failedTests.forEach((test, index) => {
    console.log(chalk.red(`${index + 1}. ${test.module.toUpperCase()}: ${test.testName}`));
    
    // Show file path and line number for easy navigation
    if (test.lineNumber) {
      console.log(chalk.yellow(`   📍 File: ${test.filePath}:${test.lineNumber}`));
    } else {
      console.log(chalk.yellow(`   📍 File: ${test.filePath}`));
    }
    
    // Show more detailed error information
    const errorLines = test.error.split('\n');
    const firstErrorLine = errorLines[0];
    console.log(chalk.gray(`   Error: ${firstErrorLine}`));
    
    // Show additional context if available
    if (errorLines.length > 1) {
      const secondLine = errorLines[1]?.trim();
      if (secondLine && secondLine.length > 0) {
        console.log(chalk.gray(`   Context: ${secondLine}`));
      }
    }
    
    console.log('');
  });
  
  console.log(chalk.gray('-'.repeat(80)));
  console.log('');
}

function showModuleBreakdown(results: TestResult[], failedTests: FailedTest[]): void {
  console.log(chalk.gray('='.repeat(80)));
  console.log(chalk.blue('📊 Module Breakdown'));
  console.log(chalk.gray('='.repeat(80)));
  
  let totalPassed = 0;
  let totalFailed = 0;
  let totalSkipped = 0;
  let totalDuration = 0;
  
  results.forEach(result => {
    totalPassed += result.passed;
    totalFailed += result.failed;
    totalSkipped += result.skipped;
    totalDuration += result.duration;
    
    const total = result.passed + result.failed + result.skipped;
    const successRate = total > 0 ? ((result.passed / total) * 100).toFixed(1) : '0.0';
    
    console.log(chalk.yellow(`🔧 ${result.module.toUpperCase()}`));
    console.log(`   ${chalk.green('✅ Passed:')} ${result.passed} ${chalk.gray('|')} ${chalk.red('❌ Failed:')} ${result.failed} ${chalk.gray('|')} ${chalk.yellow('⏭️  Skipped:')} ${result.skipped}`);
    console.log(`   ${chalk.blue('⏱️  Duration:')} ${formatDuration(result.duration)} ${chalk.gray('|')} ${chalk.cyan('📈 Success Rate:')} ${successRate}%`);
    
    // Show failures for this module if any
    const moduleFailures = failedTests.filter(test => test.module === result.module);
    if (moduleFailures.length > 0) {
      console.log(chalk.red('   ❌ Failed Tests:'));
      moduleFailures.forEach((test, index) => {
        console.log(chalk.red(`      ${index + 1}. ${test.testName}`));
        
        // Show file path and line number for easy navigation
        if (test.lineNumber) {
          console.log(chalk.yellow(`         📍 File: ${test.filePath}:${test.lineNumber}`));
        } else {
          console.log(chalk.yellow(`         📍 File: ${test.filePath}`));
        }
        
        // Show first line of error message
        const firstErrorLine = test.error.split('\n')[0];
        console.log(chalk.gray(`         Error: ${firstErrorLine}`));
        
      });
    }
    
    console.log('');
  });
  
  // Overall summary
  console.log(chalk.cyan('📊 Overall Summary:'));
  console.log(`${chalk.green('✅ Total Passed:')} ${totalPassed}`);
  console.log(`${chalk.red('❌ Total Failed:')} ${totalFailed}`);
  console.log(`${chalk.yellow('⏭️  Total Skipped:')} ${totalSkipped}`);
  console.log(`${chalk.blue('⏱️  Total Duration:')} ${formatDuration(totalDuration)}`);
  
  const overallSuccessRate = (totalPassed + totalFailed + totalSkipped) > 0 
    ? ((totalPassed / (totalPassed + totalFailed + totalSkipped)) * 100).toFixed(1) 
    : '0.0';
  console.log(`${chalk.cyan('📈 Overall Success Rate:')} ${overallSuccessRate}%`);
  
  if (totalFailed === 0) {
    console.log(chalk.green('\n🎉 All tests passed!'));
  } else {
    console.log(chalk.red('\n💥 Some tests failed!'));
  }
  
  console.log(chalk.gray('='.repeat(80)));
}

import { formatDuration } from '../src/shared/utils/formatting.js';

function main(): void {
  try {
    // Show module instructions
    showModuleInstructions();
    
    // Run tests with minimal output
    console.log(chalk.blue('🧪 Running tests...'));
    console.log('');
    
    const output = execSync('vitest run --reporter=json', { 
      stdio: 'pipe',
      cwd: process.cwd(),
      encoding: 'utf8'
    });
    
    // Parse and show results
    console.log(chalk.blue('📊 Analyzing results...'));
    console.log('');
    
    const { results, failedTests } = parseTestResults(output);
    
    // Show module breakdown with failures integrated
    showModuleBreakdown(results, failedTests);
    
  } catch (error: any) {
    console.log(chalk.blue('📊 Analyzing results...'));
    console.log('');
    
    // Try to show results even if tests failed
    // Check if the error has output that we can parse
    if (error.stdout) {
      try {
        const { results, failedTests } = parseTestResults(error.stdout);
        if (results.length > 0) {
          showModuleBreakdown(results, failedTests);
          
          // Calculate total failures to determine exit code
          const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);
          if (totalFailed > 0) {
            process.exit(1);
          }
          // All tests passed - exit successfully
          process.exit(0);
        } else {
          console.log(chalk.red('❌ Test execution failed and no results available'));
          console.log(chalk.gray('='.repeat(80)));
        }
      } catch (parseError) {
        console.log(chalk.red('❌ Test execution failed and no results available'));
        console.log(chalk.gray('='.repeat(80)));
      }
    } else {
      console.log(chalk.red('❌ Test execution failed and no results available'));
      console.log(chalk.gray('='.repeat(80)));
    }
    
    process.exit(1);
  }
}

// Run the script
main();
