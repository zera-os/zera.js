#!/usr/bin/env node

/**
 * TypeScript Build Script for ZERA JS SDK
 * 
 * This script handles the complete TypeScript build process including:
 * - Type checking
 * - Compilation to JavaScript
 * - Declaration file generation
 * - Source map generation
 * - ESM module generation
 */

import { execSync } from 'child_process';
import { existsSync, rmSync, mkdirSync, cpSync } from 'fs';
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

function execSilent(command: string, options: any = {}): string {
  try {
    return execSync(command, { 
      encoding: 'utf8' as const,
      cwd: projectRoot,
      stdio: 'pipe' as const,
      ...options 
    }).trim();
  } catch (error) {
    return '';
  }
}

function checkAndFixDependencies(): void {
  log('🔍 Checking build dependencies...', colors.cyan);
  
  let needsFix = false;
  
  // Check if protobuf plugins are available
  const protocGenEs = execSilent('protoc-gen-es --version');
  const protocGenConnectEs = execSilent('protoc-gen-connect-es --version');
  const buf = execSilent('buf --version');
  
  if (!protocGenEs || !protocGenConnectEs || !buf) {
    log('⚠️  Missing protobuf plugins detected', colors.yellow);
    log('🔧 Installing missing protobuf plugins globally...', colors.cyan);
    
    try {
      execSync('npm install -g @bufbuild/buf @bufbuild/protoc-gen-es @bufbuild/protoc-gen-connect-es', {
        stdio: 'inherit',
        cwd: projectRoot
      });
      log('✅ Protobuf plugins installed successfully', colors.green);
      needsFix = true;
    } catch (error) {
      log('❌ Failed to install protobuf plugins globally', colors.red);
      log('💡 You may need to run: npm install -g @bufbuild/buf @bufbuild/protoc-gen-es @bufbuild/protoc-gen-connect-es', colors.yellow);
    }
  }
  
  // Check if node_modules exists and has key dependencies
  const nodeModulesExists = existsSync(join(projectRoot, 'node_modules'));
  const eslintExists = existsSync(join(projectRoot, 'node_modules', 'eslint'));
  const typescriptExists = existsSync(join(projectRoot, 'node_modules', 'typescript'));
  
  if (!nodeModulesExists || !eslintExists || !typescriptExists) {
    log('⚠️  Missing or incomplete node_modules detected', colors.yellow);
    log('🔧 Installing/updating dependencies...', colors.cyan);
    
    try {
      // Try normal install first
      execSync('npm install', {
        stdio: 'inherit',
        cwd: projectRoot
      });
      log('✅ Dependencies installed successfully', colors.green);
      needsFix = true;
    } catch (error) {
      log('⚠️  Normal install failed, trying with legacy peer deps...', colors.yellow);
      try {
        execSync('npm install --legacy-peer-deps', {
          stdio: 'inherit',
          cwd: projectRoot
        });
        log('✅ Dependencies installed with legacy peer deps', colors.green);
        needsFix = true;
      } catch (legacyError) {
        log('❌ Failed to install dependencies', colors.red);
        log('💡 You may need to run: npm install --legacy-peer-deps', colors.yellow);
        throw legacyError;
      }
    }
  }
  
  // Check proto dependencies
  const protoNodeModules = existsSync(join(projectRoot, 'proto', 'node_modules'));
  if (!protoNodeModules) {
    log('⚠️  Missing proto dependencies detected', colors.yellow);
    log('🔧 Installing proto dependencies...', colors.cyan);
    
    try {
      execSync('npm install', {
        stdio: 'inherit',
        cwd: join(projectRoot, 'proto')
      });
      log('✅ Proto dependencies installed successfully', colors.green);
      needsFix = true;
    } catch (error) {
      log('⚠️  Proto install failed, trying with legacy peer deps...', colors.yellow);
      try {
        execSync('npm install --legacy-peer-deps', {
          stdio: 'inherit',
          cwd: join(projectRoot, 'proto')
        });
        log('✅ Proto dependencies installed with legacy peer deps', colors.green);
        needsFix = true;
      } catch (legacyError) {
        log('❌ Failed to install proto dependencies', colors.red);
        log('💡 You may need to run: cd proto && npm install --legacy-peer-deps', colors.yellow);
        throw legacyError;
      }
    }
  }
  
  if (needsFix) {
    log('✅ Dependency check and fix completed', colors.green);
  } else {
    log('✅ All dependencies are properly installed', colors.green);
  }
}

function cleanDist(): void {
  log('🧹 Cleaning dist directory...', colors.yellow);
  const distPath = join(projectRoot, 'dist');
  
  if (existsSync(distPath)) {
    rmSync(distPath, { recursive: true, force: true });
  }
  
  mkdirSync(distPath, { recursive: true });
  log('✅ Dist directory cleaned', colors.green);
}

function lintCode(): void {
  log('🔧 Running ESLint auto-fix...', colors.cyan);
  try {
    exec('npm run lint:fix');
    log('✅ ESLint auto-fix completed', colors.green);
  } catch (error) {
    log('⚠️  ESLint auto-fix encountered issues, continuing...', colors.yellow);
  }

  log('🔍 Running ESLint check...', colors.blue);
  try {
    exec('npm run lint:check');
    log('✅ Linting passed', colors.green);
  } catch (error) {
    log('❌ Linting failed!', colors.red);
    log('Please fix remaining linting issues manually', colors.yellow);
    throw error;
  }
}

function typeCheck(): void {
  log('🔍 Running TypeScript type checking...', colors.blue);
  try {
    exec('npx tsc --noEmit --skipLibCheck');
    log('✅ Type checking passed', colors.green);
  } catch (error) {
    log('❌ Type checking failed!', colors.red);
    throw error;
  }
}

function compileTypeScript(): void {
  log('🔨 Compiling TypeScript to JavaScript...', colors.blue);
  try {
    exec('npx tsc');
    log('✅ TypeScript compilation completed', colors.green);
  } catch (error) {
    log('❌ TypeScript compilation failed!', colors.red);
    throw error;
  }
}

function generateESM(): void {
  log('📦 Generating ESM modules...', colors.blue);
  
  // Copy the main index.js to index.mjs for ESM
  const indexJsPath = join(projectRoot, 'dist', 'index.js');
  const indexMjsPath = join(projectRoot, 'dist', 'index.mjs');
  
  if (existsSync(indexJsPath)) {
    cpSync(indexJsPath, indexMjsPath);
    log('✅ ESM modules generated', colors.green);
  } else {
    log('⚠️  index.js not found, skipping ESM generation...', colors.yellow);
  }
}

function buildProtobuf(): void {
  log('📋 Building protobuf files with TypeScript...', colors.blue);
  
  try {
    // Build protobuf files using the TypeScript build script
    exec('cd proto && npm run build:typescript');
    log('✅ Protobuf files built with TypeScript support', colors.green);
  } catch (error) {
    log('⚠️  Protobuf build failed, trying fallback...', colors.yellow);
    try {
      // Fallback to regular build
      exec('cd proto && npm run build');
      log('✅ Protobuf files built with fallback method', colors.green);
    } catch (fallbackError) {
      log('❌ Protobuf build failed completely', colors.red);
      throw fallbackError;
    }
  }
}

function copyProtoFiles(): void {
  log('📋 Copying protobuf files...', colors.blue);
  const protoSource = join(projectRoot, 'proto', 'generated');
  const protoDest = join(projectRoot, 'dist', 'proto', 'generated');
  
  if (existsSync(protoSource)) {
    cpSync(protoSource, protoDest, { recursive: true });
    log('✅ Protobuf generated files copied', colors.green);
  } else {
    log('⚠️  Protobuf generated files not found, skipping...', colors.yellow);
  }
  
  // Also copy source .proto files
  const protoSourceDir = join(projectRoot, 'proto');
  const protoDestDir = join(projectRoot, 'dist', 'proto');
  
  if (existsSync(protoSourceDir)) {
    // Copy all .proto files
    const protoFiles = ['api.proto', 'txn.proto', 'validator.proto'];
    for (const file of protoFiles) {
      const sourceFile = join(protoSourceDir, file);
      const destFile = join(protoDestDir, file);
      if (existsSync(sourceFile)) {
        // Ensure destination directory exists
        mkdirSync(protoDestDir, { recursive: true });
        cpSync(sourceFile, destFile);
      }
    }
    log('✅ Protobuf source files copied', colors.green);
  }
}

function copyReadme(): void {
  log('📄 Copying README...', colors.blue);
  const readmeSource = join(projectRoot, 'README.md');
  const readmeDest = join(projectRoot, 'dist', 'README.md');
  
  if (existsSync(readmeSource)) {
    cpSync(readmeSource, readmeDest);
    log('✅ README copied', colors.green);
  }
}

function copyLicense(): void {
  log('📄 Copying LICENSE...', colors.blue);
  const licenseSource = join(projectRoot, 'LICENSE');
  const licenseDest = join(projectRoot, 'dist', 'LICENSE');
  
  if (existsSync(licenseSource)) {
    cpSync(licenseSource, licenseDest);
    log('✅ LICENSE copied', colors.green);
  }
}

function validateBuild(): void {
  log('🔍 Validating build output...', colors.blue);
  
  const distPath = join(projectRoot, 'dist');
  const requiredFiles = [
    'index.js',
    'index.d.ts',
    'index.mjs'
  ];
  
  for (const file of requiredFiles) {
    const filePath = join(distPath, file);
    if (!existsSync(filePath)) {
      throw new Error(`Required file missing: ${file}`);
    }
  }
  
  log('✅ Build validation passed', colors.green);
}

function showBuildInfo(): void {
  log('\n📊 Build Information:', colors.cyan);
  log(`  • Output directory: ${join(projectRoot, 'dist')}`, colors.reset);
  log('  • Main entry: dist/index.js', colors.reset);
  log('  • ESM entry: dist/index.mjs', colors.reset);
  log('  • Type definitions: dist/index.d.ts', colors.reset);
  log('  • Source maps: Generated', colors.reset);
  log('  • Declaration maps: Generated', colors.reset);
}

async function build(skipDependencyCheck: boolean = false): Promise<void> {
  const startTime = Date.now();
  
  log('🚀 Starting ZERA JS SDK TypeScript build...', colors.bright);
  log('', colors.reset);
  
  try {
    // Check and fix dependencies first (unless skipped)
    if (!skipDependencyCheck) {
      checkAndFixDependencies();
      log('', colors.reset);
    }
    
    cleanDist();
    buildProtobuf();
    lintCode();
    typeCheck();
    compileTypeScript();
    generateESM();
    copyProtoFiles();
    copyReadme();
    copyLicense();
    validateBuild();
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    log('', colors.reset);
    log('🎉 Build completed successfully!', colors.green);
    log(`⏱️  Build time: ${duration}s`, colors.cyan);
    
    showBuildInfo();
    
  } catch (error) {
    log('', colors.reset);
    log('❌ Build failed!', colors.red);
    log(`Error: ${(error as Error).message}`, colors.red);
    process.exit(1);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
const command = args[0];

// Filter out options from commands
const commands = args.filter(arg => !arg.startsWith('--'));
const options = args.filter(arg => arg.startsWith('--'));
const actualCommand = commands[0];

switch (actualCommand) {
case 'clean':
  cleanDist();
  break;
case 'lint':
  lintCode();
  break;
case 'type-check':
  typeCheck();
  break;
case 'compile':
  compileTypeScript();
  break;
case 'esm':
  generateESM();
  break;
case 'validate':
  validateBuild();
  break;
case 'help':
case '--help':
case '-h':
  log('ZERA JS SDK TypeScript Build Script', colors.bright);
  log('', colors.reset);
  log('Usage: npm run build [command] [options]', colors.reset);
  log('', colors.reset);
  log('Commands:', colors.reset);
  log('  (no command)  - Full build process with dependency check', colors.reset);
  log('  clean         - Clean dist directory', colors.reset);
  log('  type-check    - Run TypeScript type checking only', colors.reset);
  log('  compile       - Compile TypeScript to JavaScript only', colors.reset);
  log('  esm           - Generate ESM modules only', colors.reset);
  log('  validate      - Validate build output only', colors.reset);
  log('  help          - Show this help message', colors.reset);
  log('', colors.reset);
  log('Options:', colors.reset);
  log('  --skip-deps   - Skip dependency check and auto-fix (faster)', colors.reset);
  log('  --fast        - Alias for --skip-deps', colors.reset);
  break;
default:
  if (actualCommand) {
    log(`Unknown command: ${actualCommand}`, colors.red);
    log('Run "npm run build help" for available commands', colors.yellow);
    process.exit(1);
  } else {
    // Check for skip dependency check flag
    const skipDependencyCheck = options.includes('--skip-deps') || options.includes('--fast');
    await build(skipDependencyCheck);
  }
  break;
}
