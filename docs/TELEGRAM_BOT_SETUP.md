# Bot Telegram DanaTrack — panduan pasang

Bot ini jadi "remote control" DanaTrack: pengingat bayar investor, pengingat uang
masuk, cek kantong, cek pendapatan, transfer/setor, dan tambah kontrak investor.

Web DanaTrack itu halaman statis, tidak punya server sendiri. Jadi otak bot-nya
tinggal di **n8n** (yang sudah kamu punya), dan semua hitungan uang tetap memakai
`treasury.js` supaya tidak pernah ada dua versi rumus.

---

## Yang sudah siap (tidak perlu kamu kerjakan)

| Bagian | Status |
|---|---|
| Aturan pencatatan (`opBayarBagiHasil`, `opKembalikanPokok`, `opReturnProyek`, `opTransfer`, `opSetorModal`, `opReversal`) | ✅ di `treasury.js`, 6 tes |
| Anti-dobel (id deterministik: `bh:<kontrak>:<YYYY-MM>`) | ✅ tap dua kali tidak akan tercatat dua kali |
| Penggabung aman (`mergeCloudOps`) supaya bot dan web tidak saling menimpa | ✅ 7 tes |
| Data pendapatan + pembagian (`incomeBreakdown`) untuk `/pendapatan` | ✅ 4 tes |
| Halaman laporan siap cetak (`laporan.html`) untuk PDF terjadwal | ✅ live |

`treasury.js` bisa dipakai langsung di n8n Code node:

```js
const res = await this.helpers.httpRequest({ url: 'https://datanetworkdigital.github.io/danaproyek/treasury.js' });
const module = { exports: {} };
new Function('module','exports','self', res)(module, module.exports, undefined);
const T = module.exports;   // sekarang T.opBayarBagiHasil(...) dst siap dipakai
```

---

## Yang harus kamu siapkan (butuh akunmu, tidak bisa aku buat)

### 1. Bot Telegram
Chat ke **@BotFather** → `/newbot` → simpan **token**-nya. Catat juga **chat id**
kamu (chat ke @userinfobot).

### 2. Akses tulis ke Firestore untuk n8n
Firebase console → Project settings → Service accounts → **Generate new private
key**. Simpan JSON-nya. Di n8n, tambah credential **Google Service Account**,
scope `https://www.googleapis.com/auth/datastore`. Beri role **Datastore User**
saja, jangan Owner.

### 3. (untuk PDF terjadwal) Gotenberg
Jalankan di sebelah n8n:

```bash
docker run -d --name gotenberg -p 3000:3000 gotenberg/gotenberg:8
```

---

## Aturan aman yang WAJIB dipakai di workflow

1. **Cek pengirim dua kali.** Trigger Telegram punya "Restrict to Chat IDs", tapi
   itu **tidak menyaring `callback_query`** (tombol). Tambahkan node IF sendiri
   yang mencocokkan `from.id` dengan chat id kamu, untuk pesan **dan** tombol.
2. **Tulis pakai penguncian.** Baca dokumen, ubah, lalu commit dengan precondition
   `currentDocument.updateTime`. Kalau gagal (ada yang menulis duluan), ulangi baca
   sampai 3x. Ini yang bikin bot tidak menimpa perubahanmu di web.
3. **Jangan pernah hitung uang di n8n.** Selalu lewat `T.op*` di atas. Node n8n
   hanya boleh: baca → panggil `T.op*` → `T.applyOp` → tulis.
4. **`answerCallbackQuery` dulu, baru menulis.** Kalau tidak, tombolnya loading terus.
5. **Balas dengan struk.** Setelah tercatat, `editMessageText` jadi ringkasan +
   tombol **Batalkan** yang memanggil `T.opReversal` (jangan hapus jurnal).
6. **Kantong 1040 (Investor Jatuh Tempo) terkunci.** `opTransfer` sudah menolaknya.

---

## Perintah yang direncanakan

| Perintah | Isi |
|---|---|
| `/kantong` | Saldo 5 kantong + dana bebas per kantong |
| `/jatuhtempo` | Semua kewajiban 30 hari ke depan |
| `/pendapatan` | Pendapatan bulan ini + pembagian: investor, Mas Hena, bersih Gde, RRPR |
| `/transfer` | Pilih asal → tujuan → jumlah (tombol, ketik hanya kalau perlu) |
| `/setor` | Setor modal ke kantong Gde/RRPR |
| `/kontrakbaru` | Kirim template siap salin, kamu edit, kirim balik |
| Pengingat bayar | H-3 dan hari-H tiap baris jadwal investor → tombol **Sudah bayar** / **Sesuaikan jumlah** |
| Pengingat uang masuk | Jatuh tempo return proyek → tombol **Sudah masuk** / **Kurang, sesuaikan** / **Belum masuk** |

### Template kontrak baru (pola bot Daniel)

Bot mengirim ini sebagai blok kode (tinggal tap untuk salin):

```
/kontrakbaru
Investor: Veda
Label: tahap 4
Pokok: 50
Rate: 2
Mulai: 2026-09-01
Tenor: 6
Struktur: bulanan
```

Parser membaca `Kunci: nilai` per baris, melaporkan **semua** kesalahan sekaligus,
lalu menampilkan jadwal yang terbentuk (3 baris pertama + total) untuk kamu
konfirmasi satu ketuk sebelum benar-benar dicatat.

---

## Laporan terjadwal

Semua laporan tinggal render halaman yang sudah jadi, lalu ubah ke PDF:

| Jadwal | URL | Hasil |
|---|---|---|
| Tiap tanggal 1, 06:00 | `laporan.html?p=<bulan lalu>&print=1` | 5 halaman: one-pager + 4 laporan |
| Tiap awal kuartal (H+1) | `laporan.html?p=<tahun>-Q<n>&print=1` | 4 halaman: rekap kuartal + 3 bulan |
| Tiap 1 Januari | `laporan.html?p=<tahun lalu>&print=1` | 5 halaman: rekap tahun + 4 kuartal |

Alur n8n: HTTP Request ambil URL → kirim HTML ke Gotenberg
`POST /forms/chromium/convert/html` (`printBackground=true`,
`preferCssPageSize=true`) → Telegram `sendDocument`.

Halaman sudah punya CSS `@page A4` dan `page-break-after`, jadi jumlah halamannya
persis seperti tabel di atas.

**Penting:** simpan hasil tiap bulan ke arsip (`danatrack_snapshots/<YYYY-MM>`)
dengan precondition `exists:false`. Rekap kuartalan harus memakai halaman bulanan
yang **sudah pernah dikirim**, bukan menghitung ulang, supaya angka di deck kuartal
tidak berubah kalau ada jurnal yang dimasukkan mundur.
