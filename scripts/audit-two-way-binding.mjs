#!/usr/bin/env node
/**
 * Two-way binding audit for manual-entry components.
 * For each component, computes 3 sets of form keys:
 *   - htmlKeys:   formControlName/ngModel bindings in .html (what the UI shows)
 *   - toXmlKeys:  keys read by generateXml() (form -> XML direction)
 *   - fromXmlKeys: keys assigned in parseXmlToForm()'s patch object (XML -> form direction)
 * Reports, per field, which direction(s) are wired so gaps are explicit:
 *   - in HTML but not read by generateXml()       => typing does nothing (one user complaint)
 *   - in HTML but not written by parseXmlToForm()  => editing XML does nothing to that field (other complaint)
 * Run: node scripts/audit-two-way-binding.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MANUAL_ENTRY = path.join(__dirname, '../src/app/pages/manual-entry');
const SKIP = new Set(['bic-search-dialog', 'manual-entry']);

function stripTsComments(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}
function stripHtmlComments(s) { return s.replace(/<!--[\s\S]*?-->/g, ''); }

function braceMatchFrom(s, openIdx) {
  let depth = 0;
  for (let k = openIdx; k < s.length; k++) {
    if (s[k] === '{') depth++;
    else if (s[k] === '}') { depth--; if (depth === 0) return k; }
  }
  return -1;
}

function extractHtmlKeys(html) {
  html = stripHtmlComments(html);
  const keys = new Set();
  let m;
  const r1 = /formControlName="([^"]+)"/g;
  while ((m = r1.exec(html)) !== null) keys.add(m[1]);
  const r2 = /\[\(ngModel\)\]="([^"]+)"/g;
  while ((m = r2.exec(html)) !== null) if (m[1] !== 'generatedXml') keys.add(m[1]);
  // dynamic [formControlName]="prefix+'Suffix'" -> record suffix only, matched loosely later
  const r3 = /\[formControlName\]="[^"]*\+\s*'([A-Za-z_]\w*)'/g;
  while ((m = r3.exec(html)) !== null) keys.add(`*${m[1]}`); // '*' marks suffix-only match
  return keys;
}

// keys written into `patch` (or this.form.patchValue({...})) inside parseXmlToForm
function extractFromXmlKeys(ts) {
  ts = stripTsComments(ts);
  const keys = new Set();
  const fnIdx = ts.search(/\bparseXmlToForm\s*\([^)]*\)\s*\{/);
  if (fnIdx === -1) return keys;
  const braceIdx = ts.indexOf('{', fnIdx);
  const end = braceMatchFrom(ts, braceIdx);
  const body = end !== -1 ? ts.slice(braceIdx, end) : ts.slice(braceIdx);

  // patch.foo = ...
  const r1 = /\bpatch\.([A-Za-z_]\w*)\s*=/g;
  let m;
  while ((m = r1.exec(body)) !== null) keys.add(m[1]);
  // patch['foo'] = ...
  const r2 = /\bpatch\[\s*['"]([A-Za-z_]\w*)['"]\s*\]\s*=/g;
  while ((m = r2.exec(body)) !== null) keys.add(m[1]);
  // patch[p + 'Suffix'] = ...  (prefix loop, e.g. agent blocks) -> suffix-only marker
  const r3 = /\bpatch\[\s*[A-Za-z_]\w*\s*\+\s*['"]([A-Za-z_]\w*)['"]\s*\]\s*=/g;
  while ((m = r3.exec(body)) !== null) keys.add(`*${m[1]}`);
  // setVal('foo', ...) helper used by camt052/053/054/055/057, pacs8
  const r4 = /\bsetVal\(\s*['"]([A-Za-z_]\w*)['"]/g;
  while ((m = r4.exec(body)) !== null) keys.add(m[1]);
  const r5 = /\bsetVal\(\s*[A-Za-z_]\w*\s*\+\s*['"]([A-Za-z_]\w*)['"]/g;
  while ((m = r5.exec(body)) !== null) keys.add(`*${m[1]}`);
  // this.form.patchValue({ foo: ... })
  const pvIdx = body.search(/\.patchValue\s*\(\s*\{/);
  if (pvIdx !== -1) {
    const bi = body.indexOf('{', pvIdx);
    const be = braceMatchFrom(body, bi);
    if (be !== -1) {
      const inner = body.slice(bi + 1, be);
      const keyRe = /^\s*([A-Za-z_]\w*)\s*:/gm;
      let km;
      while ((km = keyRe.exec(inner)) !== null) keys.add(km[1]);
    }
  }
  return keys;
}

// keys read by generateXml() (form -> XML)
function extractToXmlKeys(ts) {
  ts = stripTsComments(ts);
  const idx = ts.search(/\bgenerateXml\s*\([^)]*\)\s*\{/);
  const body = idx === -1 ? ts : (() => {
    const bi = ts.indexOf('{', idx);
    const be = braceMatchFrom(ts, bi);
    return be !== -1 ? ts.slice(bi, be) : ts.slice(bi);
  })();
  const keys = new Set();
  const r1 = /\bv\.([A-Za-z_]\w*)/g;
  let m;
  while ((m = r1.exec(body)) !== null) keys.add(m[1]);
  const r2 = /\bv\[\s*['"]([A-Za-z_]\w*)['"]\s*\]/g;
  while ((m = r2.exec(body)) !== null) keys.add(m[1]);
  const r3 = /\bv\[\s*[A-Za-z_]\w*\s*\+\s*['"]([A-Za-z_]\w*)['"]\s*\]/g;
  while ((m = r3.exec(body)) !== null) keys.add(`*${m[1]}`);
  return keys;
}

function isCovered(key, set) {
  if (set.has(key)) return true;
  if (key.startsWith('*')) return [...set].some(s => s.startsWith('*') && s.slice(1) === key.slice(1));
  // a concrete html key like "fooBic" can be covered by a suffix marker "*Bic"
  return [...set].some(s => s.startsWith('*') && key.endsWith(s.slice(1)));
}

function audit(dir) {
  const name = path.basename(dir);
  const files = fs.readdirSync(dir);
  const htmlF = files.find(f => f.endsWith('.component.html'));
  const tsF = files.find(f => f.endsWith('.component.ts'));
  if (!htmlF || !tsF) return null;
  const html = fs.readFileSync(path.join(dir, htmlF), 'utf8');
  const ts = fs.readFileSync(path.join(dir, tsF), 'utf8');

  const htmlKeys = extractHtmlKeys(html);
  const toXmlKeys = extractToXmlKeys(ts);
  const fromXmlKeys = extractFromXmlKeys(ts);
  const hasParseFn = /\bparseXmlToForm\s*\(/.test(ts);

  const htmlList = [...htmlKeys].filter(k => !k.startsWith('*'));
  const noToXml = htmlList.filter(k => !isCovered(k, toXmlKeys));
  const noFromXml = htmlList.filter(k => !isCovered(k, fromXmlKeys));

  return {
    name,
    hasParseFn,
    htmlCount: htmlList.length,
    toXmlCount: toXmlKeys.size,
    fromXmlCount: fromXmlKeys.size,
    noToXml,
    noFromXml,
  };
}

const dirs = fs.readdirSync(MANUAL_ENTRY, { withFileTypes: true })
  .filter(d => d.isDirectory() && !SKIP.has(d.name))
  .flatMap(d => {
    const p = path.join(MANUAL_ENTRY, d.name);
    const sub = fs.readdirSync(p, { withFileTypes: true }).filter(s => s.isDirectory());
    return sub.length ? sub.map(s => path.join(p, s.name)) : [p];
  });

console.log('Two-Way Binding Audit (Form <-> XML), applies to SR2025 + SR2026 (same components, isSR2026-gated)\n' + '='.repeat(90));
const results = dirs.map(audit).filter(Boolean).sort((a, b) => (b.noToXml.length + b.noFromXml.length) - (a.noToXml.length + a.noFromXml.length));

for (const r of results) {
  console.log(`\n## ${r.name}`);
  if (!r.hasParseFn) {
    console.log('  🔴 NO parseXmlToForm() at all — XML edits NEVER reflect into the form (one-way only, form -> XML)');
    continue;
  }
  console.log(`  HTML fields: ${r.htmlCount} | generateXml reads: ${r.toXmlCount} | parseXmlToForm writes: ${r.fromXmlCount}`);
  if (r.noToXml.length) console.log(`  🟠 Typing does NOT reach XML (${r.noToXml.length}): ${r.noToXml.slice(0, 15).join(', ')}${r.noToXml.length > 15 ? ', ...' : ''}`);
  if (r.noFromXml.length) console.log(`  🟣 Editing XML does NOT reach form (${r.noFromXml.length}): ${r.noFromXml.slice(0, 15).join(', ')}${r.noFromXml.length > 15 ? ', ...' : ''}`);
  if (!r.noToXml.length && !r.noFromXml.length) console.log('  🟢 Fully two-way');
}

console.log('\n' + '='.repeat(90));
console.log(`Audited ${results.length} components. (Same component serves SR2025 & SR2026 — branching is internal via isSR2026, see manual-entry-messages.ts)`);
