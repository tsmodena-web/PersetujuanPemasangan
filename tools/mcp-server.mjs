#!/usr/bin/env node
// MCP server (stdio) untuk mengubah konfigurasi Form Persetujuan Pemasangan.
// Setiap perubahan: validasi -> simpan config/*.json -> build ulang index.html.
// Tidak ada yang dipush ke GitHub kecuali tool `publish_git` dipanggil dengan confirm=true.
import { execFileSync } from 'node:child_process';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { FILES, OUTPUT, ROOT, build, loadConfig, saveConfig, validate } from './lib.mjs';

const server = new McpServer({ name: 'persetujuan-config', version: '1.0.0' });
const text = (obj) => ({ content: [{ type: 'text', text: typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2) }] });
const fail = (msg) => ({ isError: true, content: [{ type: 'text', text: msg }] });
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const safe = (fn) => async (args) => { try { return await fn(args); } catch (e) { return fail(String(e.message || e)); } };
const NAMES = Object.keys(FILES);

server.registerTool('overview', {
  title: 'Ringkasan konfigurasi',
  description: `File config yang bisa diubah (${NAMES.join(', ')}) beserta ukurannya, dan status git. Panggil ini dulu.`,
  inputSchema: {},
}, safe(() => {
  const c = loadConfig();
  let status = ''; try { status = git('status', '--short'); } catch { status = '(git tidak tersedia)'; }
  return text({ files: Object.fromEntries(NAMES.map((n) => [n, `${FILES[n]} (${Array.isArray(c[n]) ? c[n].length + ' item' : Object.keys(c[n]).length + ' field'})`])), git_status: status || 'bersih' });
}));

server.registerTool('get_config', {
  title: 'Lihat isi config',
  description: 'Isi lengkap satu file config sebagai JSON.',
  inputSchema: { name: z.enum(NAMES) },
}, safe(({ name }) => text(loadConfig()[name])));

server.registerTool('set_config', {
  title: 'Ganti isi config',
  description: 'Ganti seluruh isi satu file config. Ambil dulu dengan get_config, ubah bagian yang perlu, lalu kirim utuh. Divalidasi dulu; kalau gagal tidak ada yang tersimpan. index.html dibangun ulang otomatis.',
  inputSchema: { name: z.enum(NAMES), value: z.any().describe('Isi baru (JSON utuh)'), summary: z.string().optional() },
}, safe(({ name, value, summary }) => {
  const next = { ...loadConfig(), [name]: typeof value === 'string' ? JSON.parse(value) : value };
  const { errors, warnings } = validate(next);
  if (errors.length) return fail('Perubahan DITOLAK, tidak ada yang tersimpan:\n- ' + errors.join('\n- '));
  saveConfig(name, next[name]);
  const built = build();
  if (!built.ok) return fail('Build gagal:\n- ' + built.errors.join('\n- '));
  return text({ ok: true, summary: summary || `${name} diperbarui`, file: FILES[name], index_html: `${built.bytes} byte`, warnings });
}));

server.registerTool('validate', { title: 'Validasi config', description: 'Cek semua config tanpa menyimpan apa pun.', inputSchema: {} },
  safe(() => { const r = validate(loadConfig()); return text({ valid: r.errors.length === 0, ...r }); }));

server.registerTool('build', { title: 'Build index.html', description: 'Bangun ulang index.html dari config + template.', inputSchema: {} },
  safe(() => { const r = build(); return r.ok ? text(r) : fail(r.errors.join('\n')); }));

server.registerTool('git_diff', {
  title: 'Lihat perubahan git',
  description: 'Ringkasan perubahan yang belum di-commit.',
  inputSchema: { full: z.boolean().default(false).describe('true = tampilkan diff config/ lengkap') },
}, safe(({ full }) => {
  const stat = git('diff', '--stat', '--', 'config', 'src', 'tools', OUTPUT);
  const body = full ? git('diff', '--', 'config') : '';
  return text(`${stat || '(tidak ada perubahan)'}${body ? '\n\n' + body.slice(0, 12000) : ''}`);
}));

server.registerTool('publish_git', {
  title: 'Commit & push ke GitHub',
  description: 'Commit config/, src/, tools/, assets/, index.html lalu push. HARUS confirm=true. Push ke main berarti langsung live di GitHub Pages.',
  inputSchema: {
    message: z.string().min(5).describe('Pesan commit'),
    branch: z.string().optional().describe('Branch tujuan. Default: branch aktif'),
    confirm: z.boolean().describe('Harus true. Tanyakan ke user dulu sebelum mengisi true.'),
  },
}, safe(({ message, branch, confirm }) => {
  if (confirm !== true) return fail('Ditolak: confirm harus true setelah user menyetujui.');
  const current = git('rev-parse', '--abbrev-ref', 'HEAD'); const target = branch ?? current;
  if (target !== current) git('checkout', '-B', target);
  const check = build(); if (!check.ok) return fail('Build gagal, tidak dipush:\n' + check.errors.join('\n'));
  const paths = ['config', 'src', 'tools', 'assets', 'package.json', '.gitignore', OUTPUT];
  git('add', ...paths.filter(require_exists));
  if (!git('status', '--porcelain', '--', ...paths)) return text('Tidak ada perubahan untuk di-commit.');
  git('commit', '-m', message);
  const out = git('push', '-u', 'origin', target);
  return text({ pushed: true, branch: target, commit: git('rev-parse', '--short', 'HEAD'), output: out || 'ok' });
}));
function require_exists(p) { try { execFileSync('test', ['-e', p], { cwd: ROOT }); return true; } catch { return false; } }

await server.connect(new StdioServerTransport());
