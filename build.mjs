// Inlines src/styles.css and src/js/*.js into one self-contained dist/index.html,
// then packs it as dist/badlies-itch.zip (index.html at the zip root, as itch.io expects).
// No Node on hand? build.ps1 does the same thing in PowerShell.
import fs from 'node:fs';
import zlib from 'node:zlib';
const root = new URL('.', import.meta.url);
const read = p => fs.readFileSync(new URL(p, root), 'utf8');
const js = fs.readdirSync(new URL('src/js/', root)).filter(f => f.endsWith('.js')).sort().map(f => read('src/js/' + f)).join('\n');
const html = read('src/index.html').replace('/*CSS*/', () => read('src/styles.css')).replace('/*JS*/', () => js);
fs.mkdirSync(new URL('dist/', root), { recursive: true });
fs.writeFileSync(new URL('dist/index.html', root), html);
console.log(`dist/index.html  ${(html.length / 1024).toFixed(1)} kB`);

// Minimal single-file zip (deflate), no dependencies.
const CRC = Array.from({ length: 256 }, (_, n) => { for (let k = 0; k < 8; k++) n = n & 1 ? 0xEDB88320 ^ (n >>> 1) : n >>> 1; return n >>> 0; });
const crc32 = buf => { let c = ~0; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return ~c >>> 0; };
function zip(files) {
  const local = [], central = []; let off = 0;
  const d = new Date(), time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  for (const [name, data] of files) {
    const n = Buffer.from(name), z = zlib.deflateRawSync(data, { level: 9 }), crc = crc32(data);
    const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(8, 8);
    h.writeUInt16LE(time, 10); h.writeUInt16LE(date, 12); h.writeUInt32LE(crc, 14); h.writeUInt32LE(z.length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(n.length, 26);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(8, 10);
    c.writeUInt16LE(time, 12); c.writeUInt16LE(date, 14); c.writeUInt32LE(crc, 16); c.writeUInt32LE(z.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(n.length, 28); c.writeUInt32LE(off, 42);
    local.push(h, n, z); central.push(c, n); off += 30 + n.length + z.length;
  }
  const cd = Buffer.concat(central), e = Buffer.alloc(22);
  e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(files.length, 8); e.writeUInt16LE(files.length, 10); e.writeUInt32LE(cd.length, 12); e.writeUInt32LE(off, 16);
  return Buffer.concat([...local, cd, e]);
}
const z = zip([['index.html', Buffer.from(html, 'utf8')]]);
fs.writeFileSync(new URL('dist/badlies-itch.zip', root), z);
console.log(`dist/badlies-itch.zip  ${(z.length / 1024).toFixed(1)} kB  -> upload to itch.io as an HTML game`);
