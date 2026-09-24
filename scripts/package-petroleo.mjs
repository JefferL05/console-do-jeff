import { readFile, writeFile, mkdir, readdir, rm, copyFile, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { deflateRawSync } from 'node:zlib';

const output = resolve('artifacts/ouro-playables');
await rm(output, { recursive: true, force: true });
await mkdir(join(output, 'modules'), { recursive: true });
let html = await readFile('dist/jogos/petroleo/index.html', 'utf8');
html = html.replace('<html ', '<html data-platform="youtube" ')
  .replace('<head>', '<head><script src="https://www.youtube.com/game_api/v1"></script>')
  .replace(/(href|src)="[^"]*\/jogos\/petroleo\/([^"]+)"/g, '$1="./$2"');
if (!html.includes('./boot.js') || /(?:href|src)="\//.test(html)) throw new Error('Bundle must use relative asset references.');
await writeFile(join(output, 'index.html'), html);
for (const file of ['boot.js', 'game.js', 'style.css']) await copyFile(join('public/jogos/petroleo', file), join(output, file));
for (const file of await readdir('public/jogos/petroleo/modules')) if (file.endsWith('.js')) await copyFile(join('public/jogos/petroleo/modules', file), join(output, 'modules', file));

// Small deterministic ZIP writer using standard DEFLATE, no packaging dependency.
const table = Array.from({ length: 256 }, (_, value) => {
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
function crc32(buffer) { let crc = 0xffffffff; for (const byte of buffer) crc = table[(crc ^ byte) & 255] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0; }
const entries = [];
async function collect(directory, prefix = '') {
  for (const name of (await readdir(directory)).sort()) {
    if (!/^[A-Za-z0-9_.-]+$/.test(name)) throw new Error(`Invalid bundle filename: ${name}`);
    const path = join(directory, name);
    if ((await stat(path)).isDirectory()) await collect(path, `${prefix}${name}/`);
    else entries.push({ name: `${prefix}${name}`, data: await readFile(path) });
  }
}
await collect(output);
const local = [], central = []; let offset = 0, bytes = 0;
for (const entry of entries) {
  bytes += entry.data.length;
  if (entry.data.length >= 30 * 1024 * 1024) throw new Error('File exceeds the 30 MiB limit.');
  const name = Buffer.from(entry.name), compressed = deflateRawSync(entry.data), crc = crc32(entry.data);
  const header = Buffer.alloc(30); header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20, 4); header.writeUInt16LE(8, 8); header.writeUInt16LE(33, 12);
  header.writeUInt32LE(crc, 14); header.writeUInt32LE(compressed.length, 18); header.writeUInt32LE(entry.data.length, 22); header.writeUInt16LE(name.length, 26);
  local.push(header, name, compressed);
  const record = Buffer.alloc(46); record.writeUInt32LE(0x02014b50); record.writeUInt16LE(20, 4); record.writeUInt16LE(20, 6); record.writeUInt16LE(8, 10); record.writeUInt16LE(33, 14);
  record.writeUInt32LE(crc, 16); record.writeUInt32LE(compressed.length, 20); record.writeUInt32LE(entry.data.length, 24); record.writeUInt16LE(name.length, 28); record.writeUInt32LE(offset, 42);
  central.push(record, name); offset += header.length + name.length + compressed.length;
}
if (entries.length > 8000 || bytes >= 250 * 1024 * 1024) throw new Error('Bundle exceeds publication size limits.');
const directory = Buffer.concat(central), end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
const zip = Buffer.concat([...local, directory, end]);
await writeFile('artifacts/ouro-playables.zip', zip);
await writeFile('artifacts/ouro-playables-manifest.json', JSON.stringify({ sdk: 'https://www.youtube.com/game_api/v1', files: entries.map(e => ({ name: e.name, bytes: e.data.length })), bytes, zipBytes: zip.length, status: 'development-candidate-not-certified' }, null, 2));
console.log(`Playables candidate: ${entries.length} files, ${(bytes / 1024).toFixed(1)} KiB raw / ${(zip.length / 1024).toFixed(1)} KiB ZIP.\n${output}\nartifacts/ouro-playables.zip\nStatus: local candidate; official certification is still required.`);
