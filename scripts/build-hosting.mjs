import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = join(root, 'public');
await rm(output, { recursive: true, force: true });
await mkdir(join(output, 'scripts'), { recursive: true });
for (const name of ['index.html', 'favicon.svg', 'assets', 'styles']) {
  await cp(join(root, name), join(output, name), { recursive: true });
}
for (const name of await readdir(join(root, 'scripts'))) {
  if (name.endsWith('.js')) {
    await cp(join(root, 'scripts', name), join(output, 'scripts', name));
  }
}
console.log('Firebase Hosting files prepared in public/');
