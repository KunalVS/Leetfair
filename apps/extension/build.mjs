/**
 * Build script for the LeetFair extension.
 *
 * Bundles three entry points with esbuild into dist/, copies static assets,
 * and (optionally) watches. Load `extension/dist` in chrome://extensions.
 */
import { build, context } from 'esbuild';
import { cpSync, mkdirSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const dist = resolve(root, 'dist');

const shared = {
  bundle: true,
  minify: true,
  sourcemap: false,
  target: ['chrome110'],
  logLevel: 'info',
};

async function main() {
  rmSync(dist, { recursive: true, force: true });
  mkdirSync(dist, { recursive: true });

  const options = {
    ...shared,
    entryPoints: {
      content: resolve(root, 'src/content/index.js'),
      background: resolve(root, 'src/background/index.js'),
      popup: resolve(root, 'src/popup/popup.js'),
    },
    outdir: dist,
  };

  if (process.argv.includes('--watch')) {
    const ctx = await context(options);
    await ctx.watch();
    console.log('[extension] watching…');
    return;
  }

  await build(options);

  // Copy static assets (manifest + popup html/css + icons).
  cpSync(resolve(root, 'manifest.json'), resolve(dist, 'manifest.json'));
  const popupHtml = readFileSync(resolve(root, 'static/popup/popup.html'), 'utf8');
  writeFileSync(resolve(dist, 'popup.html'), popupHtml);
  cpSync(resolve(root, 'static/popup/styles.css'), resolve(dist, 'styles.css'));
  if (existsSync(resolve(root, 'static/icons'))) {
    cpSync(resolve(root, 'static/icons'), resolve(dist, 'icons'), { recursive: true });
  }

  console.log('[extension] built →', dist);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
