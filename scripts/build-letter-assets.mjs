import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
let fonts = '';
for (const [name, styles] of [['be-vietnam-pro', ['400', '500', '600', '700']], ['charm', ['400', '700']], ['playfair-display', ['400', '500', '600', '400-italic', '500-italic']]]) {
  const destination = new URL(`../assets/fonts/${name}/`, import.meta.url);
  await mkdir(destination, { recursive: true });
  await cp(new URL(`../node_modules/@fontsource/${name}/files/`, import.meta.url), new URL('files/', destination), { recursive: true });
  await cp(new URL(`../node_modules/@fontsource/${name}/LICENSE`, import.meta.url), new URL('LICENSE.txt', destination));
  for (const style of styles) fonts += (await readFile(new URL(`../node_modules/@fontsource/${name}/${style}.css`, import.meta.url), 'utf8')).replaceAll('./files/', `../assets/fonts/${name}/files/`) + '\n';
}
await writeFile(new URL('../styles/letter-fonts.css', import.meta.url), fonts);
const assets = [
  ['node_modules/canvas-confetti/dist/confetti.browser.js', 'scripts/vendor-confetti.js'],
  ['node_modules/lucide/dist/umd/lucide.min.js', 'scripts/vendor-lucide.js'],
  ['node_modules/qrcode-generator/dist/qrcode.js', 'scripts/vendor-qr.js'],
];
await mkdir(new URL('../assets/licenses/', import.meta.url), { recursive: true });
for (const [source, target] of assets) await cp(new URL('../' + source, import.meta.url), new URL('../' + target, import.meta.url));
// QR generator retains its MIT license notice in the copied source header.
for (const [name, license] of [['canvas-confetti', 'LICENSE'], ['lucide', 'LICENSE']]) {
  await cp(new URL(`../node_modules/${name}/${license}`, import.meta.url), new URL(`../assets/licenses/${name}.txt`, import.meta.url));
}
const result = spawnSync(process.execPath, ['node_modules/@tailwindcss/cli/dist/index.mjs', '-i', 'styles/tailwind-input.css', '-o', 'styles/tailwind.css', '--minify'], { cwd: root, stdio: 'inherit' });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);
console.log('Letter libraries and Tailwind CSS prepared locally.');
