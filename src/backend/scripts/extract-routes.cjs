const fs = require('fs');
const path = require('path');

const files = [];
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (f.endsWith('.controller.ts') || f.endsWith('.routes.ts')) files.push(p);
  }
})('src');

const METH = ['Get', 'Post', 'Put', 'Patch', 'Delete', 'All', 'Head', 'Options'];
const out = [];

for (const f of files) {
  const src = fs.readFileSync(f, 'utf8').split('\n');
  let prefix = '';
  for (const l of src) {
    const m = l.match(/@Controller\(\s*['"`]([^'"`]*)['"`]/);
    if (m) { prefix = m[1]; break; }
  }
  for (let i = 0; i < src.length; i++) {
    const m = src[i].match(new RegExp('@(' + METH.join('|') + ')\\(\\s*[\'"`]([^\'"`]*)[\'"`]'));
    if (!m) continue;
    const meth = m[1].toUpperCase();
    const seg = m[2] || '';
    let full = prefix ? '/' + prefix : '';
    if (seg) full += '/' + seg.replace(/^\//, '');
    if (full === '') full = '/';
    let sum = '';
    for (let j = i; j < Math.min(i + 8, src.length); j++) {
      const s = src[j].match(/summary:\s*['"`]([^'"`]+)['"`]/);
      if (s) { sum = s[1]; break; }
    }
    out.push({ method: meth, path: full, summary: sum, file: f, line: i + 1 });
  }
}

out.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
for (const r of out) {
  console.log(r.method.padEnd(7) + r.path.padEnd(58) + '| ' + r.summary);
}
console.log('TOTAL ' + out.length);
