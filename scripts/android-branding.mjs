import { deflateSync } from 'node:zlib';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const table = Array.from({ length: 256 }, (_, n) => { for (let i = 0; i < 8; i++) n = n & 1 ? 0xedb88320 ^ n >>> 1 : n >>> 1; return n >>> 0; });
const crc = data => { let c = 0xffffffff; for (const byte of data) c = table[(c ^ byte) & 255] ^ c >>> 8; return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) { const header = Buffer.alloc(8), tail = Buffer.alloc(4); header.writeUInt32BE(data.length); header.write(type, 4); tail.writeUInt32BE(crc(Buffer.concat([Buffer.from(type), data]))); return Buffer.concat([header, data, tail]); }
function icon(size) {
  const rows = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const X = (x + .5) / size * 108, Y = (y + .5) / size * 108;
    let color = [16, 38, 33];
    if (Math.abs(X - 54) + Math.abs(Y - 54) < 38) color = [237, 193, 122];
    if (Y > 33 && Y < 77 && Math.abs(X - 54) < 7 + (Y - 33) * .19) color = [23, 60, 50];
    if (Y > 42 && Y < 70 && Math.abs(Math.abs((Y - 42) % 14 - 7) - Math.abs(X - 54)) < 1.4) color = [237, 193, 122];
    const at = y * (size * 4 + 1) + 1 + x * 4; rows[at] = color[0]; rows[at + 1] = color[1]; rows[at + 2] = color[2]; rows[at + 3] = 255;
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
}
for (const [density, size] of [['mdpi', 48], ['hdpi', 72], ['xhdpi', 96], ['xxhdpi', 144], ['xxxhdpi', 192]]) {
  const dir = join(root, 'mobile/android/app/src/main/res', `mipmap-${density}`); await mkdir(dir, { recursive: true });
  for (const name of ['ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png']) await writeFile(join(dir, name), icon(size));
}
for (const name of ['ic_launcher.xml', 'ic_launcher_round.xml']) {
  const dir = join(root, 'mobile/android/app/src/main/res/mipmap-anydpi-v26'); await mkdir(dir, { recursive: true });
  await writeFile(join(dir, name), '<?xml version="1.0" encoding="utf-8"?><adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android"><background android:drawable="@color/ic_launcher_background"/><foreground android:drawable="@drawable/ouro_mark"/></adaptive-icon>');
}
console.log('Ícones Android gerados localmente.');
