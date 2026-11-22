#!/usr/bin/env node
/**
 * So sánh route trong mã nguồn (controller) với hợp đồng API
 * (`docs/restructures/7_api_contracts_v8.md` — bảng §3.13).
 *
 * Dùng: node scripts/check-api-coverage.cjs
 */
const fs = require('fs');
const path = require('path');

// ── 1. Route từ mã nguồn ────────────────────────────────────────────────────
const files = [];
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (f.endsWith('.controller.ts')) files.push(p);
  }
})('src');

const METH = ['Get', 'Post', 'Put', 'Patch', 'Delete'];
const actual = new Set();
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8').split('\n');
  let prefix = '';
  for (const l of src) {
    const m = l.match(/@Controller\(\s*['"`]([^'"`]*)['"`]/);
    if (m) { prefix = m[1]; break; }
  }
  for (const l of src) {
    // `@Get()` (không path) hoặc `@Get('sub/path')`
    const m = l.match(
      new RegExp('@(' + METH.join('|') + ')\\(\\s*(?:[\'"`]([^\'"`]*)[\'"`])?\\s*\\)'),
    );
    if (!m) continue;
    const seg = m[2] || '';
    let full = prefix ? '/' + prefix : '';
    if (seg) full += '/' + seg.replace(/^\//, '');
    if (full === '') full = '/';
    actual.add(m[1].toUpperCase() + ' ' + full);
  }
}

// ── 2. Route từ hợp đồng (chỉ bảng §3.13) ──────────────────────────────────
const DOC = path.join('..', '..', 'docs', 'restructures', '7_api_contracts_v8.md');
const docLines = fs.readFileSync(DOC, 'utf8').split('\n');

const startIdx = docLines.findIndex((l) => l.startsWith('### 3.13.'));
const endIdx = docLines.findIndex(
  (l, i) => i > startIdx && /^### 3\.1[4-9]/.test(l),
);
const section = docLines.slice(startIdx, endIdx > startIdx ? endIdx : undefined);

const expected = new Set();
for (const line of section) {
  // | 20 | `WS-01` Tạo workspace | POST | `/workspaces` | WS-OWNER ... |
  // | 31 | **`WS-11` Tổng quan ...** *(v8, mới)* | GET | `/overview/workspaces` | đã đăng nhập |
  const m = line.match(
    /\|\s*[^|]*\|\s*(GET|POST|PUT|PATCH|DELETE)\s*\|\s*`(\/[^`]*)`\s*\|/,
  );
  if (m) expected.add(m[1].toUpperCase() + ' ' + m[2]);
}

// ── 3. Chuẩn hoá path param ────────────────────────────────────────────────
const norm = (s) =>
  s.replace(/\{[^}]+\}/g, ':x').replace(/:[A-Za-z0-9_]+/g, ':x').replace(/\/$/, '');

const actualN = new Map([...actual].map((r) => [norm(r), r]));
const expectedN = new Map([...expected].map((r) => [norm(r), r]));

const missing = [...expectedN.keys()].filter((k) => !actualN.has(k)).sort();
const extra = [...actualN.keys()].filter((k) => !expectedN.has(k)).sort();

// ── 4. Báo cáo ─────────────────────────────────────────────────────────────
console.log('=== THIẾU trong mã nguồn (có trong hợp đồng §3.13, chưa implement) ===');
if (missing.length === 0) console.log('  (không có)');
missing.forEach((k) => console.log('  ' + expectedN.get(k)));

console.log('\n=== THỪA trong mã nguồn (đã implement, không có trong hợp đồng §3.13) ===');
if (extra.length === 0) console.log('  (không có)');
extra.forEach((k) => console.log('  ' + actualN.get(k)));

console.log('\n=== TỔNG ===');
console.log('  Hợp đồng §3.13: ' + expectedN.size + ' | Mã nguồn: ' + actualN.size);
console.log('  Thiếu: ' + missing.length + ' | Thừa: ' + extra.length);
