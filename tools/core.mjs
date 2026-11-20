// Inti tanpa akses file: validasi config dan render index.html dari template.
// Dipakai oleh build (Node) dan oleh Checklist Config Manager (browser), jadi hasilnya selalu sama.

export const FILES = {
  form: 'config/form.json',
  products: 'config/products.json',
  areas: 'config/areas.json',
  decisions: 'config/decisions.json',
  reference: 'config/reference.json',
};
export const TEMPLATE = 'src/index.template.html';
export const OUTPUT = 'index.html';
// Ikon yang tersedia di kode (const ICONS di template).
export const ICONS = ["zap","droplet","flame","wall","wind","move","dots","alert","check","x","pen","file","left","right","camera","shield","info","clip","grid","trash","download","printer","image","play","book","users","user","help","tool","ear"];
export const LEVELS = { c: 'Berisiko (sesuai template)', e: 'Waspada (temuan tambahan)', s: 'STOP (berhenti kerja)' };
export const PRIORITY = { t: 'Tinggi', s: 'Sedang' };

const ID_RE = /^[a-z][a-z0-9_]*$/;
const SUB_RE = /^[a-z][a-z0-9_]*$/;
const isStr = (s) => typeof s === 'string' && s.trim().length > 0;
const strList = (v, min = 1) => Array.isArray(v) && v.length >= min && v.every(isStr);

export function validate(cfg) {
  const errors = [];
  const warnings = [];
  const { form, products, areas, decisions, reference } = cfg;

  if (!form || !isStr(form.title) || !isStr(form.guide) || !isStr(form.consent)) errors.push('form: title, guide, dan consent wajib diisi');

  const areaIds = new Set();
  const subIds = new Set();
  if (!Array.isArray(areas) || !areas.length) errors.push('areas: harus array, minimal 1');
  else {
    const free = areas.filter((a) => a && a.free);
    if (free.length !== 1) errors.push(`areas: harus ada tepat 1 area "Lainnya" (free: true), sekarang ${free.length}`);
    else if (free[0].id !== 'lainnya') errors.push('areas: area bebas harus ber-id "lainnya" (dirujuk kode)');
    areas.forEach((a, ai) => {
      const w = `areas[${ai}]` + (a && a.name ? ` "${a.name}"` : '');
      if (!a || !ID_RE.test(a.id || '')) { errors.push(`${w}.id harus huruf kecil/angka/underscore`); return; }
      if (areaIds.has(a.id)) errors.push(`${w}.id "${a.id}" duplikat`); areaIds.add(a.id);
      if (!isStr(a.name)) errors.push(`${w}.name kosong`);
      if (!ICONS.includes(a.icon)) errors.push(`${w}.icon "${a.icon}" tidak dikenal. Pilihan: ${ICONS.join(', ')}`);
      if (!a.free) for (const k of ['indikasi', 'risiko']) if (!isStr(a[k])) errors.push(`${w}.${k} kosong`);
      for (const k of ['cek', 'caution', 'mitigasi']) if (!strList(a[k])) errors.push(`${w}.${k}: harus daftar teks, minimal 1`);
      if (a.free) {
        if (!strList(a.quick)) errors.push(`${w}.quick: daftar contoh cepat, minimal 1`);
        if (Array.isArray(a.subs) && a.subs.length) errors.push(`${w}: area Lainnya tidak memakai subs`);
        return;
      }
      if (!isStr(a.stopAction)) errors.push(`${w}.stopAction kosong`);
      if (!a.edu || !isStr(a.edu.apa) || !strList(a.edu.risiko) || !strList(a.edu.opsi)) errors.push(`${w}.edu: butuh apa (teks), risiko (daftar), opsi (daftar)`);
      for (const k of ['gejala', 'khusus']) if (a[k] !== undefined && !strList(a[k])) errors.push(`${w}.${k}: harus daftar teks`);
      if (!Array.isArray(a.subs) || !a.subs.length) { errors.push(`${w}.subs minimal 1 indikasi`); return; }
      a.subs.forEach((s, si) => {
        const ws = `${w}.subs[${si}]`;
        if (!s || !SUB_RE.test(s.id || '')) errors.push(`${ws}.id harus huruf kecil/angka/underscore`);
        else if (subIds.has(s.id)) errors.push(`${ws}.id "${s.id}" duplikat (id indikasi harus unik di semua area)`);
        else subIds.add(s.id);
        if (!isStr(s && s.text)) errors.push(`${ws}.text kosong`);
        if (!LEVELS[s && s.level]) errors.push(`${ws}.level harus c (Berisiko), e (Waspada), atau s (STOP)`);
        if (!isStr(s && s.impact)) errors.push(`${ws}.impact (dampak) kosong`);
      });
      if (!a.subs.some((s) => s && s.level === 'c')) warnings.push(`${w}: tidak ada indikasi level "c", baris template form akan kosong`);
    });
    const nonFree = areas.filter((a) => a && !a.free).length;
    if (nonFree > 6) warnings.push(`areas: ${nonFree} area (asli 6). Cek tampilan output 1:1 karena ruangnya terbatas.`);
  }

  if (!Array.isArray(products) || !products.length) errors.push('products: harus array, minimal 1');
  else {
    const pids = new Set();
    products.forEach((p, i) => {
      const w = `products[${i}]` + (p && p.label ? ` "${p.label}"` : '');
      if (!p || !ID_RE.test(p.id || '')) { errors.push(`${w}.id tidak valid`); return; }
      if (pids.has(p.id)) errors.push(`${w}.id "${p.id}" duplikat`); pids.add(p.id);
      if (!isStr(p.label)) errors.push(`${w}.label kosong`);
      if (!p.priority || typeof p.priority !== 'object' || Array.isArray(p.priority)) errors.push(`${w}.priority harus object {idArea: "t"|"s"}`);
      else for (const [aid, lv] of Object.entries(p.priority)) {
        if (!areaIds.has(aid)) errors.push(`${w}.priority: area "${aid}" tidak ada`);
        else if (areas.find((a) => a.id === aid).free) errors.push(`${w}.priority: area Lainnya tidak diprioritaskan`);
        if (!PRIORITY[lv]) errors.push(`${w}.priority.${aid} harus "t" (tinggi) atau "s" (sedang)`);
      }
    });
    if (!pids.has('other')) warnings.push('products: tidak ada "other" (Produk lainnya)');
  }

  if (!Array.isArray(decisions) || !decisions.length) errors.push('decisions: harus array, minimal 1');
  else {
    const ids = new Set();
    decisions.forEach((d, i) => {
      if (!d || !ID_RE.test(d.id || '')) errors.push(`decisions[${i}].id tidak valid`);
      else if (ids.has(d.id)) errors.push(`decisions[${i}].id duplikat`); else ids.add(d.id);
      if (!isStr(d && d.label)) errors.push(`decisions[${i}].label kosong`);
      if (typeof (d && d.consent) !== 'boolean') errors.push(`decisions[${i}].consent harus true/false`);
    });
    if (!decisions.some((d) => d && d.consent)) errors.push('decisions: minimal 1 keputusan dengan consent: true');
    if (!ids.has('lanjut')) warnings.push('decisions: id "lanjut" tidak ada; cek alur persetujuan');
  }

  if (!reference || typeof reference !== 'object') errors.push('reference: harus object');
  else {
    if (!strList(reference.tools)) errors.push('reference.tools: daftar alat, minimal 1');
    if (!strList(reference.signerRoles)) errors.push('reference.signerRoles: daftar peran penanda tangan, minimal 1');
    for (const [k, f] of [['terms', ['term', 'desc']], ['buildings', ['type', 'note']]]) {
      if (!Array.isArray(reference[k])) errors.push(`reference.${k} harus array`);
      else reference[k].forEach((x, i) => { for (const ff of f) if (!isStr(x && x[ff])) errors.push(`reference.${k}[${i}].${ff} kosong`); });
    }
  }
  return { errors, warnings };
}

const jsLit = (v) => JSON.stringify(v).replace(/<\//g, '<\\/').split(String.fromCharCode(0x2028)).join('\\u2028').split(String.fromCharCode(0x2029)).join('\\u2029');

// Ubah config kembali ke konstanta yang dipakai kode aplikasi.
export function constants(cfg) {
  const areas = cfg.areas.map((a) => {
    const { gejala, khusus, ...rest } = a;
    const o = { ...rest };
    o.subs = (a.subs || []).map((s) => [s.id, s.text, s.level]);
    return o;
  });
  const extra = {};
  for (const a of cfg.areas) if (a.gejala || a.khusus) extra[a.id] = { gejala: a.gejala || [], khusus: a.khusus || [] };
  const impl = {};
  for (const a of cfg.areas) for (const s of a.subs || []) impl[s.id] = s.impact;
  return {
    GUIDE_TEXT: cfg.form.guide,
    CONSENT_TEXT: cfg.form.consent,
    FORM_TITLE: cfg.form.title,
    PRODUCTS: cfg.products.map((p) => [p.id, p.label]),
    REL: Object.fromEntries(cfg.products.map((p) => [p.id, p.priority || {}])),
    AREAS: areas,
    DECISIONS: cfg.decisions,
    TOOLS: cfg.reference.tools,
    SIGNER_ROLES: cfg.reference.signerRoles,
    TERMS: cfg.reference.terms.map((t) => [t.term, t.desc]),
    AREA_EXTRA: extra,
    BUILDING: cfg.reference.buildings.map((b) => [b.type, b.note]),
    IMPL: impl,
  };
}

export function render(cfg, template) {
  let out = template;
  for (const [name, value] of Object.entries(constants(cfg))) {
    const key = `/*@@${name}@@*/`;
    if (!out.includes(key)) throw new Error(`Placeholder ${key} tidak ada di template`);
    out = out.split(key).join(jsLit(value));
  }
  return out;
}
