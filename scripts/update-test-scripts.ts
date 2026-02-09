#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { dirname, relative, join } from 'path';
import { fileURLToPath } from 'url';

import chalk from 'chalk';
import { glob } from 'glob';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

/**
 * Discover all modules in the project
 */
async function discoverModules(): Promise<string[]> {
  console.log(chalk.blue('🔍 Discovering modules...'));
  
  try {
    // Find all module directories
    const patterns = [
      'src/*/',           // src/module-name/
      'proto/'            // proto/ (special case)
    ];
    
    const allModules: string[] = [];
    
    for (const pattern of patterns) {
      const dirs = await glob(pattern, {
        cwd: projectRoot,
        ignore: [
          '**/node_modules/**',
          '**/dist/**',
          '**/build/**',
          '**/coverage/**',
          '**/.git/**'
        ],
        onlyDirectories: true
      });
      
      allModules.push(...dirs);
    }
    
    // Process module names
    const modules = allModules.map(dir => {
      if (dir === 'proto') {
        return 'proto';
      } else {
        // Extract module name from src\module-name (Windows) or src/module-name (Unix)
        const parts = dir.split(/[/\\]/);
        return parts[1] || 'unknown'; // Get the module name part
      }
    });
    
    // Remove duplicates and sort
    const uniqueModules = [...new Set(modules)].sort();
    
    console.log(chalk.green(`✅ Found ${uniqueModules.length} modules:`));
    uniqueModules.forEach(module => {
      console.log(chalk.cyan(`  📁 ${module}`));
    });
    
    return uniqueModules;
  } catch (error) {
    console.error(chalk.red('Error discovering modules:'), error);
    return [];
  }
}

/**
 * Read current package.json
 */
function readPackageJson(): any {
  try {
    const packagePath = join(projectRoot, 'package.json');
    const content = readFileSync(packagePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(chalk.red('Error reading package.json:'), error);
    return null;
  }
}

/**
 * Update package.json with new test scripts
 */
function updatePackageJson(packageJson: any, modules: string[]): any {
  console.log(chalk.blue('\n📝 Updating package.json...'));
  
  // Keep existing non-test scripts
  const existingScripts = { ...packageJson.scripts };
  
  // Remove old test:* scripts
  Object.keys(existingScripts).forEach(key => {
    if (key.startsWith('test:') && key !== 'test' && key !== 'test:watch' && key !== 'test:coverage' && key !== 'test:verbose' && key !== 'test:unit' && key !== 'test:integration' && key !== 'test:clean') {
      delete existingScripts[key];
      console.log(chalk.yellow(`  🗑️  Removed old script: ${key}`));
    }
  });
  
  // Add new test scripts for each module
  modules.forEach(module => {
    const scriptName = `test:${module}`;
    existingScripts[scriptName] = `node test-runner.js --module=${module}`;
    console.log(chalk.green(`  ✨ Added script: ${scriptName}`));
  });
  
  // Update package.json
  packageJson.scripts = existingScripts;
  
  return packageJson;
}

/**
 * Write updated package.json
 */
function writePackageJson(packageJson: any): boolean {
  try {
    const packagePath = join(projectRoot, 'package.json');
    const content = JSON.stringify(packageJson, null, 2);
    writeFileSync(packagePath, content, 'utf8');
    console.log(chalk.green('\n✅ package.json updated successfully!'));
    return true;
  } catch (error) {
    console.error(chalk.red('Error writing package.json:'), error);
    return false;
  }
}

/**
 * Show final npm scripts
 */
function showFinalScripts(packageJson: any): void {
  console.log(chalk.bold.blue('\n📋 Final Test Scripts:'));
  
  Object.keys(packageJson.scripts)
    .filter(key => key.startsWith('test:'))
    .sort()
    .forEach(script => {
      console.log(chalk.cyan(`  ${script}: ${packageJson.scripts[script]}`));
    });
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  console.log(chalk.bold.blue('\n🚀 Test Script Auto-Updater\n'));
  console.log(chalk.cyan(`Project: ${projectRoot}\n`));
  
  // Discover modules
  const modules = await discoverModules();
  
  if (modules.length === 0) {
    console.log(chalk.yellow('⚠️  No modules found'));
    return;
  }
  
  // Read current package.json
  const packageJson = readPackageJson();
  if (!packageJson) {
    return;
  }
  
  // Update package.json
  const updatedPackage = updatePackageJson(packageJson, modules);
  
  // Write updated package.json
  if (writePackageJson(updatedPackage)) {
    showFinalScripts(updatedPackage);
    
    console.log(chalk.bold.green('\n🎉 Test scripts updated successfully!'));
    console.log(chalk.blue('\n💡 You can now run:'));
    modules.forEach(module => {
      console.log(chalk.cyan(`  npm run test:${module}`));
    });
  }
}

// Run the updater
main().catch(error => {
  console.error(chalk.red('\n💥 Script failed:'), error);
  process.exit(1);
});
