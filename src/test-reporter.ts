import chalk from 'chalk';
import type { Reporter, File, _Task, TaskResultPack, TaskEventPack } from 'vitest';

class ZeraTestReporter implements Reporter {
  private startTime: number = 0;
  private moduleStats: Map<string, { passed: number; failed: number; skipped: number; duration: number }> = new Map();
  private hasShownInstructions = false;

  onInit() {
    this.startTime = Date.now();
    this.showModuleInstructions();
  }

  onFinished(files: File[]) {
    this.showModuleBreakdowns(files);
  }

  onTaskUpdate(packs: TaskResultPack[], _events: TaskEventPack[]) {
    // Track test results as they happen
    packs.forEach(task => {
      if (task.type === 'test' && task.result) {
        const moduleName = this.getModuleFromPath(task.file?.filepath || '');
        const stats = this.moduleStats.get(moduleName) || { passed: 0, failed: 0, skipped: 0, duration: 0 };
        
        if (task.result.state === 'pass') {
          stats.passed++;
        } else if (task.result.state === 'fail') {
          stats.failed++;
        } else if (task.result.state === 'skip') {
          stats.skipped++;
        }
        
        stats.duration += task.result.duration || 0;
        this.moduleStats.set(moduleName, stats);
      }
    });
  }

  private showModuleInstructions() {
    if (this.hasShownInstructions) return;
    this.hasShownInstructions = true;

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
  }

  private showModuleBreakdowns(_files: File[]) {
    const duration = Date.now() - this.startTime;
    let totalPassed = 0;
    let totalFailed = 0;
    let totalSkipped = 0;

    // Calculate totals from tracked stats
    this.moduleStats.forEach(stats => {
      totalPassed += stats.passed;
      totalFailed += stats.failed;
      totalSkipped += stats.skipped;
    });

    console.log(chalk.gray('='.repeat(80)));
    console.log(chalk.blue('📊 Test Suite Summary'));
    console.log(chalk.gray('='.repeat(80)));
    console.log(`${chalk.green('✅ Passed:')} ${totalPassed}`);
    console.log(`${chalk.red('❌ Failed:')} ${totalFailed}`);
    console.log(`${chalk.yellow('⏭️  Skipped:')} ${totalSkipped}`);
    console.log(`${chalk.blue('⏱️  Total time:')} ${this.formatDuration(duration)}`);
    
    // Show module breakdowns
    if (this.moduleStats.size > 0) {
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
    
    if (totalFailed === 0) {
      console.log(chalk.green('\n🎉 All tests passed!'));
    } else {
      console.log(chalk.red('\n💥 Some tests failed!'));
    }
    console.log(chalk.gray('='.repeat(80)));
  }

  private showModuleInsights(moduleName: string, _stats: { passed: number; failed: number; skipped: number; duration: number }) {
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

  private getModuleFromPath(filePath: string): string {
    const pathParts = filePath.split('/');
    const srcIndex = pathParts.indexOf('src');
    if (srcIndex !== -1 && srcIndex + 1 < pathParts.length) {
      return pathParts[srcIndex + 1] || 'unknown';
    }
    return 'unknown';
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

export default ZeraTestReporter;
