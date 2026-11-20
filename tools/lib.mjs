// Helper Node: baca/simpan config dan build index.html. Logika validasi & render ada di core.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FILES, TEMPLATE, OUTPUT, validate as validateCore, render } from './core.mjs';

export { FILES, TEMPLATE, OUTPUT };
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const abs = (rel, root = ROOT) => path.join(root, rel);

// JSON rapi: baris pendek tetap satu baris supaya diff git per item.
function hasObject(v) { if (Array.isArray(v)) return v.some(hasObject); return v !== null && typeof v === 'object'; }
export function fmt(v, ind = 0) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  const pad = '  '.repeat(ind);
  if (Array.isArray(v)) {
    if (!v.length) return '[]';
    const flat = JSON.stringify(v);
    if (!hasObject(v) && flat.length <= 200) return flat;
    return '[\n' + v.map((x) => pad + '  ' + fmt(x, ind + 1)).join(',\n') + '\n' + pad + ']';
  }
  const keys = Object.keys(v);
  if (!keys.length) return '{}';
  const flat = JSON.stringify(v);
  if (flat.length <= 160 && !Object.values(v).some((x) => x !== null && typeof x === 'object' && !Array.isArray(x))) return flat.replace(/":/g, '": ').replace(/,"/g, ', "');
  return '{\n' + keys.map((k) => pad + '  ' + JSON.stringify(k) + ': ' + fmt(v[k], ind + 1)).join(',\n') + '\n' + pad + '}';
}

export function loadConfig(root = ROOT) {
  const cfg = {};
  for (const [name, rel] of Object.entries(FILES)) cfg[name] = JSON.parse(fs.readFileSync(abs(rel, root), 'utf8'));
  return cfg;
}
export function saveConfig(name, value, root = ROOT) {
  if (!FILES[name]) throw new Error(`Config "${name}" tidak dikenal. Pilihan: ${Object.keys(FILES).join(', ')}`);
  fs.writeFileSync(abs(FILES[name], root), fmt(value) + '\n');
}
export function validate(cfg, root = ROOT) {
  const r = validateCore(cfg);
  if (!fs.existsSync(abs(TEMPLATE, root))) r.errors.push(`${TEMPLATE} tidak ditemukan`);
  return r;
}
export function build(root = ROOT) {
  const cfg = loadConfig(root);
  const { errors, warnings } = validate(cfg, root);
  if (errors.length) return { ok: false, errors, warnings };
  const html = render(cfg, fs.readFileSync(abs(TEMPLATE, root), 'utf8'));
  const prev = fs.existsSync(abs(OUTPUT, root)) ? fs.readFileSync(abs(OUTPUT, root), 'utf8') : '';
  fs.writeFileSync(abs(OUTPUT, root), html);
  return { ok: true, errors, warnings, changed: prev !== html, bytes: Buffer.byteLength(html) };
}
