import * as esbuild from 'esbuild';
import { glob } from 'glob';
import path from 'path';

// Find all TypeScript files
const entryPoints = await glob('src/**/*.ts');

await esbuild.build({
  entryPoints,
  outdir: 'dist',
  platform: 'node',
  target: 'node20',
  format: 'esm',
  sourcemap: true,
  bundle: false,
  outExtension: { '.js': '.js' },
  // Keep the same file structure
  preserveSymlinks: true,
});

console.log('Build complete!');


