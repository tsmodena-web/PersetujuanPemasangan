# Form Persetujuan Pemasangan pada Kondisi Berisiko

Form web statis untuk MODENA Technical Support. Dipakai teknisi saat cek lokasi menemukan kondisi berisiko sebelum pemasangan.

## Isi
- Form 3 langkah: Informasi, Pemeriksaan, Konfirmasi
- Edukasi konsumen, decision tree risiko, glosarium, dan flowchart keputusan
- Tanda tangan teknisi dan konsumen di layar
- Output 1:1 (JPG dan PDF), mengikuti template form

## Config
Halaman `index.html` **dibangun** dari config JSON, jadi isi bisa diubah tanpa menyentuh kode.

```
config/
  form.json        judul form, teks panduan, teks persetujuan konsumen
  products.json    produk + prioritas area per produk (t = tinggi, s = sedang)
  areas.json       area risiko: indikasi (level c/e/s + dampak), cek, larangan, mitigasi, edukasi, gejala
  decisions.json   pilihan keputusan akhir (consent: true = butuh tanda tangan konsumen)
  reference.json   alat, peran penanda tangan, glosarium, jenis bangunan
src/index.template.html   kode aplikasi (jarang diubah)
tools/core.mjs            validasi + render (dipakai build dan Checklist Config Manager)
index.html                HASIL build — jangan diedit manual
```

Level indikasi: `c` = Berisiko (baris template form), `e` = Waspada (temuan tambahan), `s` = STOP (memblokir persetujuan). Id indikasi (`l1`, `a3`, ...) dipakai di draft, jadi jangan diganti; teksnya boleh.

Yang terkunci oleh kode: area bebas `lainnya` wajib ada; ikon area harus salah satu dari daftar di `tools/core.mjs`.

## Cara pakai
1. Edit `config/` (atau lewat Checklist Config Manager / MCP).
2. `npm run build` (tidak butuh `npm install`).
3. Buka `index.html`, cek, commit & push.

MCP (butuh `npm install` sekali): `claude mcp add persetujuan-config -- node /path/ke/repo/tools/mcp-server.mjs`.

## Catatan
- Tidak ada server dan database. Draft hanya tersimpan di tab browser. Unduh hasilnya sebelum menutup tab.
- Unduh JPG/PDF memakai html2canvas dan jsPDF dari cdn.jsdelivr.net.
- Kebijakan STOP (kondisi yang memblokir persetujuan konsumen) adalah usulan dan perlu divalidasi Technical Support.
