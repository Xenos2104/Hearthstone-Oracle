// Cross-platform post-build step: copy non-TS assets into dist/ and mark the
// entry point executable on POSIX. Replaces the old `cp ... && chmod +x ...`
// shell pipeline, which does not work on Windows.

import { chmodSync, copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

const assets = [['src/data/schema.sql', 'dist/data/schema.sql']];

for (const [from, to] of assets) {
  const target = join(root, to);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(join(root, from), target);
  console.log(`copied ${from} -> ${to}`);
}

if (process.platform !== 'win32') {
  chmodSync(join(root, 'dist/server.js'), 0o755);
}
