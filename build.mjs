// Inlines src/styles.css and src/js/*.js into one self-contained dist/index.html.
import fs from 'node:fs';
const root = new URL('.', import.meta.url);
const read = p => fs.readFileSync(new URL(p, root), 'utf8');
const js = fs.readdirSync(new URL('src/js/', root)).filter(f => f.endsWith('.js')).sort().map(f => read('src/js/' + f)).join('\n');
const html = read('src/index.html').replace('/*CSS*/', () => read('src/styles.css')).replace('/*JS*/', () => js);
fs.mkdirSync(new URL('dist/', root), { recursive: true });
fs.writeFileSync(new URL('dist/index.html', root), html);
console.log(`dist/index.html  ${(html.length / 1024).toFixed(1)} kB`);
