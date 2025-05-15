/**
 * Build Script for the Text Parser Component
 * 
 * This script builds the standalone text parser module without requiring
 * changes to package.json.
 */

import esbuild from 'esbuild';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure the output directory exists
const outputDir = resolve(__dirname, 'public/js');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Build the parser with esbuild
async function buildParser() {
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
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

buildParser();