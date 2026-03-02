#!/usr/bin/env node
/**
 * UAB Package Build Script
 *
 * 1. Builds the UAB project (tsc)
 * 2. Copies compiled UAB output into packages/uab/dist/
 * 3. Result is a standalone npm-publishable package
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(PKG_ROOT, '../..');
const SRC_DIST = path.join(REPO_ROOT, 'dist', 'uab');
const DST_DIST = path.join(PKG_ROOT, 'dist');

function copyRecursive(src, dst) {
  if (!fs.existsSync(src)) {
    throw new Error(`Source directory not found: ${src}`);
  }

  if (fs.existsSync(dst)) {
    fs.rmSync(dst, { recursive: true });
  }
  fs.mkdirSync(dst, { recursive: true });

  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const dstPath = path.join(dst, entry.name);

    if (entry.isDirectory()) {
      copyRecursive(srcPath, dstPath);
    } else {
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}

console.log('📦 Building Universal App Bridge package...\n');

// Step 1: Compile TypeScript from repo root
console.log('🔨 Step 1: Compiling TypeScript...');
try {
  execSync('npx tsc', { cwd: REPO_ROOT, stdio: 'inherit' });
  console.log('   ✅ TypeScript compiled successfully\n');
} catch {
  console.error('   ❌ TypeScript compilation failed');
  process.exit(1);
}

// Step 2: Copy dist/uab/ → packages/uab/dist/
console.log('📁 Step 2: Copying compiled output...');
try {
  copyRecursive(SRC_DIST, DST_DIST);

  // Count files
  let fileCount = 0;
  function countFiles(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) countFiles(path.join(dir, entry.name));
      else fileCount++;
    }
  }
  countFiles(DST_DIST);

  console.log(`   ✅ Copied ${fileCount} files to packages/uab/dist/\n`);
} catch (err) {
  console.error(`   ❌ Copy failed: ${err.message}`);
  process.exit(1);
}

// Step 3: Verify key files exist
console.log('🔍 Step 3: Verifying package...');
const requiredFiles = [
  'dist/index.js',
  'dist/index.d.ts',
  'dist/cli.js',
  'dist/service.js',
  'dist/types.js',
  'dist/detector.js',
  'dist/router.js',
  'dist/cache.js',
  'dist/permissions.js',
  'dist/logger.js',
  'dist/plugins/base.js',
  'dist/plugins/chrome-ext/index.js',
  'dist/plugins/chrome-ext/ws-server.js',
  'dist/plugins/chrome-ext/installer.js',
  'dist/plugins/browser/index.js',
  'dist/plugins/electron/index.js',
  'dist/plugins/win-uia/index.js',
];

let allPresent = true;
for (const file of requiredFiles) {
  const fullPath = path.join(PKG_ROOT, file);
  if (fs.existsSync(fullPath)) {
    console.log(`   ✅ ${file}`);
  } else {
    console.log(`   ❌ MISSING: ${file}`);
    allPresent = false;
  }
}

if (!allPresent) {
  console.error('\n❌ Package verification failed — missing files');
  process.exit(1);
}

// Step 4: Show package info
const pkg = JSON.parse(fs.readFileSync(path.join(PKG_ROOT, 'package.json'), 'utf8'));
console.log(`\n🎉 ${pkg.name}@${pkg.version} built successfully!`);
console.log(`   📂 Output: ${DST_DIST}`);
console.log(`   🚀 Ready to publish: cd packages/uab && npm publish`);
