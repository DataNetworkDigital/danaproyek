# DanaTrack Fase 2 — Treasury & Akuntansi Roxanne Capital

Status: approved-direction (2026-08-01). Built on ONE double-entry ledger foundation.
Owner: Gde. App: single-file `index.html`, Firebase Firestore `danatrack/main_data`.

## Prinsip inti
Setiap rupiah masuk/keluar = 1 jurnal double-entry (debit=kredit) ke akun. Semua
fitur lain (kantong, laporan, likuiditas) adalah turunan/derivasi dari buku besar.
Tidak ada angka yang "dihitung ulang dari udara" lagi — semua dari jurnal tercatat.

## Keputusan yang dikunci
- **Investor = rate tetap 2%/bulan**, kita ambil selisih (spread) return proyek − 2%. Bukan pass-through.
- **Kantong = 2 lapis:**
  - Fisik (harus sama persis Bank Jago): **Utama** (bayar/transfer, transient, tak pernah nyimpen), **Gde** (nabung), **RRPR** (nabung). Boleh tambah kantong nabung nanti.
  - Semua transfer WAJIB lewat Utama (kantong nabung tak bisa transfer langsung).
  - **Tidak ada Kantong Return terpisah** (akan jadi kantong ke-4 yang tak ada di Bank Jago → merusak pencocokan). Return bersih mengendap di Gde. "Berapa fund menghasilkan" dilihat di Laba Rugi + Laba Ditahan, bukan kantong.
- **Basis: akrual.** Return investor diakui bertahap tiap bulan.
- **Prioritas likuiditas:** Gde dulu, RRPR benteng terakhir.
- **Buffer:** inflow return proyek diasumsikan telat H+7 (worst case internal); pembayaran ke investor direncanakan di hari H.
- **Porsi laba owner:** default pro-rata ke modal tiap owner (bisa diubah).
- **Konteks penting:** Roxanne baru saja reset (tarik semua dana, mulai invest lagi), jadi data legacy tipis → migrasi ringan, banyak diisi lewat UI baru.

## Bagan Akun (Chart of Accounts) — (normal balance)
Aset (D): `1000 Kantong Utama`, `1010 Kantong Gde`, `1020 Kantong RRPR`, `1100 Dana di Proyek`
Liabilitas (K): `2000 Utang Pokok Investor`, `2010 Bagi Hasil Terutang`, `2100 Utang Pinjaman`
Ekuitas (K): `3000 Modal Gde`, `3010 Modal RRPR`, `3900 Laba Ditahan`
Pendapatan (K): `4000 Pendapatan Imbal Hasil Proyek`
Beban (D): `5000 Beban Bagi Hasil Investor`, `5010 Beban Bunga Pinjaman`, `5020 Beban Fee Admin`, `5030 Beban Operasional`

Kantong = akun aset 10xx yang bertipe pocket (bayar/nabung). Saldo kantong = saldo buku besar akun itu → cocok Bank Jago by construction.

## Aturan Posting (event → jurnal)
1. **Setoran modal owner** (sisihan gaji Gde masuk kantong Gde): Dr Kantong Gde / Cr Modal Gde.
2. **Terima pokok investor**: Dr Kantong Utama / Cr Utang Pokok Investor. (lalu disebar via transfer)
3. **Transfer antar kantong** (via Utama): Dr <tujuan> / Cr Kantong Utama (atau 2 kaki lewat Utama).
4. **Deploy ke proyek**: Dr Dana di Proyek / Cr Kantong Utama.
5. **Return proyek bulanan (profit)**: Dr Kantong Utama / Cr Pendapatan Imbal Hasil Proyek.
6. **Pokok proyek balik (akhir)**: Dr Kantong Utama / Cr Dana di Proyek.
7. **Akrual bagi hasil investor (tiap bln, 2%×pokok)**: Dr Beban Bagi Hasil Investor / Cr Bagi Hasil Terutang.
8. **Bayar bagi hasil investor**: Dr Bagi Hasil Terutang / Cr Kantong Utama.
9. **Kembalikan pokok investor (jatuh tempo)**: Dr Utang Pokok Investor / Cr Kantong Utama.
10. **Bunga pinjaman (akrual/bayar)**: Dr Beban Bunga Pinjaman / Cr Utang Pinjaman; bayar: Dr Utang Pinjaman / Cr Kantong Utama.
11. **Fee admin**: Dr Beban Fee Admin / Cr Kantong Utama (atau terutang).
12. **Tarik/pindah laba ke kantong nabung**: hanya pindah lokasi kas (Dr Kantong Gde / Cr Kantong Utama). Ekuitas Laba Ditahan tetap; hanya lokasi kas berubah.

## Investor Contract (liabilitas berjadwal)
Field: `id, nama, pokok, tanggalMulai, tenorBulan, ratePct(=2), struktur('bunga_bulanan'|'bunga_saja'|'jatuh_tempo'), status`. Alokasi dana ke proyek diatur internal (tidak mengikat kontrak). Menghasilkan jadwal kewajiban: bagi hasil bulanan + pokok saat jatuh tempo. 3 struktur = sama seperti pinjaman.

## Mesin Likuiditas
Timeline kewajiban ke depan (keluar): bagi hasil investor (hari H), pokok investor (jatuh tempo), cicilan/bunga pinjaman. Proyeksi masuk: return proyek (diasumsikan H+7). Cek cash-ready tiap tanggal pakai saldo kantong + prioritas Gde→RRPR. Metrik: ROE (laba / ekuitas owner), rasio leverage (dana investor / modal owner), hari-runway.

## 5 Laporan (format perusahaan terbuka)
Jurnal · Neraca Saldo (trial balance, harus balance) · Laba Rugi (Pendapatan − Beban) · Neraca (Aset = Liabilitas + Ekuitas) · Arus Kas (operasi/investasi/pendanaan).

## Data model (tambahan ke S, non-destruktif via migrateSchema)
- `S.accounts`: {code,name,type,normal} (chart of accounts, di-seed idempoten)
- `S.pockets`: [{id, code, nama, tipe:'bayar'|'nabung', urutanLikuiditas}]
- `S.ledger`: [{id, tanggal, memo, ref, lines:[{account, debit, credit}]}]
- `S.investorContracts`: [{...}]
- `S.orgConfig`: {ownerSplit, ...}
Fields lama (projects, external) DIPERTAHANKAN. Migrasi mengonversi investor lama → kontrak (additif), tidak menghapus.

## Milestone build (deploy tiap milestone)
1. **Fondasi**: data model + chart of accounts + pockets + posting engine + derivasi saldo + migrasi. (non-UI, uji via console)
2. **Kantong UI**: lihat saldo, transfer via Utama, setor modal, rekonsiliasi Bank Jago (input saldo aktual + selisih).
3. **Investor contracts UI**: buat/edit kontrak, jadwal, tandai bayar; auto-posting akrual + bayar.
4. **Auto-posting wiring**: event proyek/investor/pinjaman existing → jurnal otomatis.
5. **5 Laporan**.
6. **Likuiditas dashboard**.
7. **Integrasi nav** (tab/section "Keuangan": Kantong · Likuiditas · Laporan).

## Keamanan migrasi
Backup `dt_v3` ke key bertanggal sebelum migrasi. Migrasi additif + idempoten. Guard `isProdOrigin` tetap (tak ada tulis produksi dari localhost). Guard data-loss (cloud<local projects) tetap.
