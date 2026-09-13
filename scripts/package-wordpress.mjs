import { build } from 'vite';
import JSZip from 'jszip';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const slug = 'umbrella-meeting-scheduler';
const pluginDir = path.join(root, 'wordpress', slug);
const pluginPhp = await readFile(path.join(pluginDir, `${slug}.php`), 'utf8');
const version = pluginPhp.match(/\* Version: ([\d.]+)/)?.[1];
if (!version) throw new Error('Plugin version is missing.');

await build({ root, base: './', build: { outDir: path.join(pluginDir, 'app'), emptyOutDir: true } });
const zip = new JSZip();
async function addDirectory(directory, relative = '') {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const next = path.join(directory, entry.name);
    const zipPath = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) await addDirectory(next, zipPath);
    else if (entry.isFile()) zip.file(`${slug}/${zipPath}`, await readFile(next));
  }
}
await addDirectory(pluginDir);
const bytes = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
const check = await JSZip.loadAsync(bytes);
for (const required of [`${slug}.php`, 'app/index.html', 'app/sunopa-header.png', 'app/umbrella-parade-logo.png', 'assets/embed.js', 'templates/fullwidth.php']) {
  if (!check.file(`${slug}/${required}`)) throw new Error(`Missing plugin file: ${required}`);
}
const releases = path.join(root, 'releases');
await mkdir(releases, { recursive: true });
let output = path.join(releases, `${slug}-${version}.zip`);
try {
  await stat(output);
  output = path.join(releases, `${slug}-${version}-${Date.now()}.zip`);
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
await writeFile(output, bytes, { flag: 'wx' });
const saved = await stat(output);
console.log(`Plugin ZIP saved: ${output}\nSize: ${saved.size} bytes\nUpdated: ${saved.mtime.toISOString()}`);
