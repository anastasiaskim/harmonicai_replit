/**
 * Build Script for the Standalone Parser
 * 
 * This script handles the TypeScript transpilation for the parser module
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure dist directory exists
const distDir = path.resolve(__dirname, 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Run TypeScript compiler
function runTsc() {
  console.log('🔄 Running TypeScript compilation...');
  
  try {
    execSync('npx tsc', { stdio: 'inherit' });
    console.log('✅ TypeScript compilation successful!');
    return true;
  } catch (error) {
    console.error('❌ TypeScript compilation failed!');
    return false;
  }
}

// Copy files to public/dist if needed
function copyToPublic() {
  console.log('📋 Copying files to public/dist...');
  
  const publicDistDir = path.resolve(__dirname, 'public/dist');
  if (!fs.existsSync(publicDistDir)) {
    fs.mkdirSync(publicDistDir, { recursive: true });
  }
  
  try {
    // Copy JS files from dist to public/dist
    fs.copyFileSync(
      path.resolve(distDir, 'parser.js'),
      path.resolve(publicDistDir, 'parser.js')
    );
    
    // Copy map files if they exist
    if (fs.existsSync(path.resolve(distDir, 'parser.js.map'))) {
      fs.copyFileSync(
        path.resolve(distDir, 'parser.js.map'),
        path.resolve(publicDistDir, 'parser.js.map')
      );
    }
    
    console.log('✅ Files copied successfully!');
    return true;
  } catch (error) {
    console.error('❌ Error copying files:', error);
    return false;
  }
}

// Run the build process
async function runBuild() {
  console.log('🚀 Starting build process...');
  
  const tscResult = runTsc();
  
  if (tscResult) {
    const copyResult = copyToPublic();
    
    if (tscResult && copyResult) {
      console.log('🎉 Build completed successfully!');
    } else {
      console.error('⚠️ Build completed with errors!');
      process.exit(1);
    }
  } else {
    console.error('⚠️ Build failed!');
    process.exit(1);
  }
}

runBuild();