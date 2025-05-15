/**
 * Build Script for the Text Parser Component and TypeScript Transpilation
 * 
 * This script handles the transpilation of TypeScript files to JavaScript
 * and creates the standalone parser component.
 */

import esbuild from 'esbuild';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure the output directories exist
const outputDirs = [
  resolve(__dirname, 'public/js'),
  resolve(__dirname, 'dist'),
];

for (const dir of outputDirs) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Build the parser with esbuild
async function buildParser() {
  console.log('📦 Building parser component...');
  
  try {
    const result = await esbuild.build({
      entryPoints: [resolve(__dirname, 'client/src/parser-index.ts')],
      bundle: true,
      outfile: resolve(__dirname, 'public/js/parser.js'),
      format: 'esm',
      platform: 'browser',
      target: 'es2020',
      sourcemap: true,
      minify: true,
      metafile: true,
    });

    console.log('✅ Parser built successfully!');
    
    // Output information about the bundle
    const { outputs } = result.metafile;
    for (const [path, output] of Object.entries(outputs)) {
      console.log(`  ${path}: ${(output.bytes / 1024).toFixed(2)} KB`);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Parser build failed:', error);
    return false;
  }
}

// Run TypeScript compilation
function typeScriptCompile() {
  console.log('🔄 Running TypeScript compilation...');
  
  try {
    // Run tsc using the parser-specific tsconfig
    execSync('npx tsc -p parser.tsconfig.json', { stdio: 'inherit' });
    console.log('✅ TypeScript compilation successful!');
    return true;
  } catch (error) {
    console.error('❌ TypeScript compilation failed!');
    return false;
  }
}

// Run the full build process
async function runBuild() {
  console.log('🚀 Starting build process...');
  
  const parserResult = await buildParser();
  const tscResult = typeScriptCompile();
  
  if (parserResult && tscResult) {
    console.log('🎉 Build completed successfully!');
  } else {
    console.error('⚠️ Build completed with errors!');
    process.exit(1);
  }
}

runBuild();