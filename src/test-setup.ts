import chalk from 'chalk';
import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { describe, it, expect } from 'vitest';

// Re-export vitest functions for convenience
export { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach };

// Test utilities
export class TestSuite {
  private static instance: TestSuite;
  private startTime: number = 0;
  private testCount: number = 0;
  private passedCount: number = 0;
  private failedCount: number = 0;
  private moduleStats: Map<string, { passed: number; failed: number; skipped: number; duration: number; tests: string[] }> = new Map();
  private currentModule: string | null = null;
  private moduleStartTime: number = 0;
  
  static getInstance(): TestSuite {
    if (!TestSuite.instance) {
      TestSuite.instance = new TestSuite();
    }
    return TestSuite.instance;
  }
  
  start(): void {
    this.startTime = Date.now();
    this.testCount = 0;
    this.passedCount = 0;
    this.failedCount = 0;
    this.moduleStats.clear();
    
    console.log(chalk.blue('🚀 Starting ZERA JS SDK Test Suite...'));
    console.log(chalk.gray('='.repeat(80)));
    
    // Show module-specific instructions
    this.showModuleInstructions();
    
    console.log(chalk.gray('='.repeat(80)));
  }
  
  end(): void {
    const duration = Date.now() - this.startTime;
    console.log(chalk.gray('='.repeat(80)));
    console.log(chalk.blue('📊 Test Suite Summary'));
    console.log(chalk.gray('='.repeat(80)));
    console.log(`${chalk.green('✅ Passed:')} ${this.passedCount}`);
    console.log(`${chalk.red('❌ Failed:')} ${this.failedCount}`);
    console.log(`${chalk.blue('⏱️  Total time:')} ${this.formatDuration(duration)}`);
    
    // Show module breakdowns
    this.showModuleBreakdowns();
    
    if (this.failedCount === 0) {
      console.log(chalk.green('\n🎉 All tests passed!'));
    } else {
      console.log(chalk.red('\n💥 Some tests failed!'));
    }
    console.log(chalk.gray('='.repeat(80)));
  }
  
  private showModuleInstructions(): void {
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
  }
  
  private showModuleBreakdowns(): void {
    if (this.moduleStats.size === 0) return;
    
    console.log(chalk.cyan('\n📊 Module Breakdown:'));
    console.log(chalk.gray('-'.repeat(80)));
    
    const modules = Array.from(this.moduleStats.entries()).sort((a, b) => {
      const aTotal = a[1].passed + a[1].failed + a[1].skipped;
      const bTotal = b[1].passed + b[1].failed + b[1].skipped;
      return bTotal - aTotal;
    });
    
    modules.forEach(([moduleName, stats]) => {
      const total = stats.passed + stats.failed + stats.skipped;
      const successRate = total > 0 ? ((stats.passed / total) * 100).toFixed(1) : '0.0';
      
      console.log(chalk.yellow(`🔧 ${moduleName.toUpperCase()}`));
      console.log(`   ${chalk.green('✅ Passed:')} ${stats.passed} ${chalk.gray('|')} ${chalk.red('❌ Failed:')} ${stats.failed} ${chalk.gray('|')} ${chalk.yellow('⏭️  Skipped:')} ${stats.skipped}`);
      console.log(`   ${chalk.blue('⏱️  Duration:')} ${this.formatDuration(stats.duration)} ${chalk.gray('|')} ${chalk.cyan('📈 Success Rate:')} ${successRate}%`);
      
      // Add module-specific insights
      this.showModuleInsights(moduleName, stats);
      console.log('');
    });
  }
  
  private showModuleInsights(moduleName: string, _stats: { passed: number; failed: number; skipped: number; duration: number; tests: string[] }): void {
    const insights = {
      'wallet-creation': [
        '🔑 HD wallet derivation',
        '🔐 Key pair generation (Ed25519/Ed448)',
        '📝 Mnemonic phrase validation',
        '🏗️  Wallet factory operations'
      ],
      'coin-txn': [
        '💰 Transaction creation and validation',
        '💸 Fee calculation and optimization',
        '🔒 Transaction signing and verification',
        '📊 Input/output processing'
      ],
      'grpc': [
        '🌐 Network communication',
        '🔌 Client connection management',
        '📡 API service integration',
        '⚡ Performance optimization'
      ],
      'shared': [
        '🛠️  Utility functions',
        '🔢 Amount calculations',
        '📏 Size estimations',
        '🎯 Fee calculations'
      ],
      'api': [
        '🔢 Nonce management',
        '💱 Exchange rate services',
        '🌍 External API integration',
        '📊 Data caching'
      ]
    };
    
    const moduleInsights = insights[moduleName as keyof typeof insights];
    if (moduleInsights) {
      console.log(chalk.gray('   Features tested:'));
      moduleInsights.forEach(insight => {
        console.log(chalk.gray(`     ${insight}`));
      });
    }
  }
  
  // Module tracking methods
  startModule(moduleName: string): void {
    this.currentModule = moduleName;
    this.moduleStartTime = Date.now();
    
    if (!this.moduleStats.has(moduleName)) {
      this.moduleStats.set(moduleName, { passed: 0, failed: 0, skipped: 0, duration: 0, tests: [] });
    }
  }
  
  endModule(moduleName: string): void {
    if (this.currentModule === moduleName) {
      const duration = Date.now() - this.moduleStartTime;
      const stats = this.moduleStats.get(moduleName);
      if (stats) {
        stats.duration = duration;
      }
      this.currentModule = null;
    }
  }
  
  recordTestResult(moduleName: string, testName: string, passed: boolean, failed: boolean, skipped: boolean): void {
    const stats = this.moduleStats.get(moduleName);
    if (stats) {
      stats.tests.push(testName);
      if (passed) stats.passed++;
      if (failed) stats.failed++;
      if (skipped) stats.skipped++;
    }
    
    // Update global counts
    if (passed) this.passedCount++;
    if (failed) this.failedCount++;
    this.testCount++;
  }
  
  // Utility methods for getting module name from file path
  static getModuleFromPath(filePath: string): string {
    const pathParts = filePath.split('/');
    const srcIndex = pathParts.indexOf('src');
    if (srcIndex !== -1 && srcIndex + 1 < pathParts.length) {
      return pathParts[srcIndex + 1] || 'unknown';
    }
    return 'unknown';
  }
  
  log(message: string): void {
    console.log(chalk.blue(`📝 ${message}`));
  }
  
  warn(message: string): void {
    console.log(chalk.yellow(`⚠️  ${message}`));
  }
  
  error(message: string): void {
    console.log(chalk.red(`❌ ${message}`));
  }
  
  success(message: string): void {
    console.log(chalk.green(`✅ ${message}`));
  }
  
  info(message: string): void {
    console.log(chalk.cyan(`ℹ️  ${message}`));
  }
  
  incrementTestCount(): void {
    this.testCount++;
  }
  
  incrementPassedCount(): void {
    this.passedCount++;
  }
  
  incrementFailedCount(): void {
    this.failedCount++;
  }
  
  updateModuleStats(moduleName: string, passed: number, failed: number, skipped: number, duration: number): void {
    this.moduleStats.set(moduleName, { passed, failed, skipped, duration, tests: [] });
  }
  
  private formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${ms}ms`;
    }
    
    const seconds = ms / 1000;
    if (seconds < 60) {
      return `${seconds.toFixed(2)}s`;
    }
    
    const minutes = seconds / 60;
    if (minutes < 60) {
      const remainingSeconds = Math.floor(seconds % 60);
      return `${Math.floor(minutes)}m ${remainingSeconds}s`;
    }
    
    const hours = minutes / 60;
    if (hours < 24) {
      const remainingMinutes = Math.floor(minutes % 60);
      return `${Math.floor(hours)}h ${remainingMinutes}m`;
    }
    
    const days = hours / 24;
    const remainingHours = Math.floor(hours % 24);
    return `${Math.floor(days)}d ${remainingHours}h`;
  }
}

// Global test setup is now handled in vitest.setup.ts

// Test data generators
export const TestData = {
  generateRandomString(length: number = 10): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  },
  
  generateRandomNumber(min: number = 0, max: number = 100): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },
  
  generateRandomArray<T>(generator: () => T, length: number = 5): T[] {
    return Array.from({ length }, generator);
  },
  
  generateTestWallet(): Record<string, string> {
    return {
      address: `test-address-${this.generateRandomString(8)}`,
      privateKey: `test-private-key-${this.generateRandomString(16)}`,
      publicKey: `test-public-key-${this.generateRandomString(16)}`,
      type: 'test'
    };
  }
};

// Assertion helpers
export const Assert = {
  isWallet(wallet: unknown): void {
    expect(wallet).toBeDefined();
    const walletObj = wallet as Record<string, unknown>;
    expect(walletObj.address).toBeDefined();
    expect(walletObj.privateKey).toBeDefined();
    expect(walletObj.publicKey).toBeDefined();
    expect(walletObj.type).toBeDefined();
  },
  
  isValidAddress(address: string): void {
    expect(address).toBeDefined();
    expect(typeof address).toBe('string');
    expect(address.length).toBeGreaterThan(0);
  },
  
  isValidPrivateKey(privateKey: string): void {
    expect(privateKey).toBeDefined();
    expect(typeof privateKey).toBe('string');
    expect(privateKey.length).toBeGreaterThan(0);
  },
  
  isValidPublicKey(publicKey: string): void {
    expect(publicKey).toBeDefined();
    expect(typeof publicKey).toBe('string');
    expect(publicKey.length).toBeGreaterThan(0);
  },
  
  isValidMnemonic(mnemonic: string): void {
    expect(mnemonic).toBeDefined();
    expect(typeof mnemonic).toBe('string');
    const words = mnemonic.split(' ');
    expect(words.length).toBeGreaterThanOrEqual(12);
    expect(words.length).toBeLessThanOrEqual(24);
  }
};

// Performance testing utilities
export const Performance = {
  async measureTime<T>(fn: () => Promise<T> | T): Promise<{ result: T; duration: number }> {
    const start = Date.now();
    const result = await fn();
    const duration = Date.now() - start;
    return { result, duration };
  },
  
  expectFast(duration: number, maxMs: number = 1000): void {
    expect(duration).toBeLessThan(maxMs);
  },
  
  expectVeryFast(duration: number, maxMs: number = 100): void {
    expect(duration).toBeLessThan(maxMs);
  }
};

// Mock utilities
export const Mock = {
  createMockWallet(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
    return {
      address: 'mock-address-123',
      privateKey: 'mock-private-key-456',
      publicKey: 'mock-public-key-789',
      type: 'mock',
      derivationPath: "m/44'/1110'/0'/0/0",
      coinType: 1110,
      symbol: 'ZRA',
      ...overrides
    };
  },
  
  createMockTransaction(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
    return {
      id: 'mock-tx-123',
      from: 'mock-from-address',
      to: 'mock-to-address',
      amount: '100',
      fee: '1',
      timestamp: Date.now(),
      ...overrides
    };
  }
};

// Test environment setup
export const TestEnv = {
  isNode: typeof process !== 'undefined' && process.versions?.node,
  isBrowser: typeof window !== 'undefined',
  isTest: process.env.NODE_ENV === 'test' || process.env.VITEST === 'true',
  
  setup(): void {
    if (this.isNode) {
      // Node.js specific setup
      process.env.NODE_ENV = 'test';
    }
  }
};

// Initialize test environment
TestEnv.setup();
