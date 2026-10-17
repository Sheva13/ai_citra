# UI/UX Prototype & Wireframe

Dokumen terkait: [PRD](01-PRD.md) · [API & ERD](05-API-SPEC-ERD.md)

## 1. Prinsip desain

- Dashboard **terang** berkontras tinggi (token paper/ink); keterbacaan lebih penting daripada dekorasi. Catatan v3: implementasi aktual memakai tema terang — bagian ini diselaraskan dari draf sebelumnya yang menyebut tema gelap.
- Timestamp, status kamera, dan hasil deteksi paling menonjol.
- Status kamera berasal dari backend (worker), bukan dari kondisi browser.
- Waktu ditampilkan **WIB** (data UTC dikonversi di UI).

## 2. Design tokens (final — sesuai `globals.css`/`tailwind.config.ts`)

| Token | Nilai | Pemakaian |
|---|---|---|
| `--bg` | `#F6F7F9` | Latar halaman (alias Tailwind: `paper`) |
| `--surface` | `#FFFFFF` | Kartu, tabel |
| `--border` | `#E6EAF0` | Garis (alias: `hairline`) |
| `--text` | `#0F172A` | Teks utama (alias: `ink`) |
| `--muted` | `#64748B` | Teks sekunder (alias: `muted`) |
| `--ok` | `#059669` | Online, confirmed |
| `--warn` | `#D97706` | Pending, reconnecting |
| `--danger` | `#DC2626` | Offline, no_helmet, error |

Status tidak boleh hanya dibedakan warna: sertakan ikon/label teks. Font: sans-serif sistem/Inter (UI), monospace sistem/JetBrains Mono (ID, timestamp).

## 3. Peta navigasi dan roles

```
Header (semua role, hanya 2 item):
HelmetWatch   Monitoring | Logs        operator/admin ▾  WIB clock

/login                 Publik
/monitoring[?camera=]  operator + admin — 1 feed fokus + selector cam di body
/logs                  operator + admin — laporan penuh + filter
/logs/[id]             operator + admin — detail + review
/cameras               admin ONLY — via menu user (gear), TIDAK di header
```

Aturan keras (hasil diskusi):
- Header JANGAN berisi dropdown Cam1/Cam2. Pilihan kamera ada di dalam `/monitoring`.
- `operator` membuka `/cameras` → 403 + menu disembunyikan + redirect ke `/monitoring`.
- Refresh `/monitoring` tidak boleh mereset pilihan kamera (pakai `?camera=`).
- Ganti CAM-01 → CAM-02 tanpa reload penuh: unsubscribe WS lama, subscribe baru.

## 4. Wireframe

### 4.1 `/monitoring?camera=CAM-01` — setengah feed + setengah info

```
┌──────────────────────────────────────────────────────────────────┐
│ HelmetWatch   Monitoring | Logs               admin ▾  16:21 WIB │
├──────────────────────────────────────────────────────────────────┤
│ [CAM-01 Parkiran Depan ●] [CAM-02 Gerbang ○]  <- selector di body│
│ CAM-01 · Parkiran Depan ● ONLINE  RUNNING  12.4 FPS  p95 310ms   │
├───────────────────────────────────────────┬──────────────────────┤
│                                           │ Lokasi               │
│                                           │ Parkiran Depan       │
│          LIVE FEED (2/3 layar)            │ Status · last_seen   │
│          aspect-video + bbox              │ Hari ini: 7 (4/2/1)  │
│          [no_helmet 0.91]                 ├──────────────────────┤
│                                           │ Kejadian terbaru     │
│                                           │ 16:21:05 ⚠ [→ log]  │
│                                           │ 16:18:42 ⚠ [→ log]  │
├───────────────────────────────────────────┴──────────────────────┤
│ [Start] [Stop] (admin only)   ⚠ Banner: realtime terputus...     │
└──────────────────────────────────────────────────────────────────┘
```

Layout: `grid lg:grid-cols-3` — feed 2 kolom, info 1 kolom. Mobile menumpuk.
Elemen: selector cam (tab/card + badge), lokasi besar di panel, live feed + bbox, indikator online/offline/error/reconnecting, FPS/latensi dari worker, jam WIB live, ringkasan hari ini, toast `event.created`, banner WS.
Live feed memakai `<img>` dari `GET /api/stream/{camera_id}?token=` dengan `object-contain` (rasio stream HP 4:3 tidak dipaksa 16:9).

### 4.2 `/logs` — laporan penuh

```
┌──────────────────────────────────────────────────────────────────┐
│ Filter: [Tanggal] [Kamera: Semua/CAM-01/CAM-02 ▾] [Status ▾] [Reset]│
├──────────┬────────────────────┬──────────────────┬────────┬───────┤
│ ID       │ Waktu (WIB)        │ Kamera · Lokasi  │ Status │ Conf  │
├──────────┼────────────────────┼──────────────────┼────────┼───────┤
│ 3f9a…    │ 16 Okt 16:21:05    │ CAM-01 · Parkiran│ ◔ pend │ 0.91  │
│ b21c…    │ 16 Okt 16:18:42    │ CAM-02 · Gerbang │ ✔ conf │ 0.88  │
├──────────┴────────────────────┴──────────────────┴────────┴───────┤
│                    ‹ 1 2 3 … ›   20 / halaman                    │
└──────────────────────────────────────────────────────────────────┘
```

`/logs` independen dari pilihan kamera di `/monitoring` (default Semua). Baris diklik membuka detail. Thumbnail via endpoint terotorisasi.

### 4.3 `/logs/[id]`

```
┌──────────────────────────────────────────────────────────────────┐
│ ← Kembali   Kejadian 3f9a…           Status: ◔ pending           │
├───────────────────────────────┬──────────────────────────────────┤
│ [Asli | Beranotasi] tab       │ Waktu     16 Okt 2026 16:21:05 WIB│
│                               │ Kamera    CAM-01 · Parkiran Depan │
│     SNAPSHOT                  │ Kelas     no_helmet               │
│                               │ Confidence 0.91   Track #12       │
│                               │ Model     helmet-v1.2             │
│                               ├──────────────────────────────────┤
│                               │ Review (operator+admin)           │
│                               │ (•) Confirmed  ( ) False positive │
│                               │ Catatan: [____________]  [Simpan] │
│                               │ OCR plat: (jika diaktifkan)       │
└───────────────────────────────┴──────────────────────────────────┘
```

### 4.4 `/cameras` (admin ONLY, tidak di header)

Tabel kamera (nama, lokasi, tipe sumber, status, last seen) + form registrasi (nama, lokasi teks bebas, tipe phone/rtsp, stream_config_ref). URL/kredensial tidak ditampilkan. Tombol Start/Stop admin-only. Operator: menu disembunyikan + guard 403.

## 5. Status dan komponen

| Komponen | Varian | Status |
|---|---|---|
| `CameraStatusBadge` | online (hijau) · offline/error (merah) · reconnecting (kuning) | Sudah ada |
| `ReviewPill` (ReviewStatusBadge) | pending · confirmed · false_positive | Sudah ada |
| `LiveFeed` | loading, playing, no-signal, error | Kerangka ada; wiring stream menyusul |
| `CameraSelector` | tab kartu + badge | Sudah ada |
| `Header` + `SlidingNav` | 2 item (Monitoring, Logs); `/cameras` via dropdown user, bukan nav | Ada — perbaikan kecil saat wiring |
| `EventToast` | muncul saat event WebSocket baru | Rencana (E6-05) |
| `ConnectionBanner` | realtime terputus / pulih | Rencana (E6-04) |

## 6. Kondisi khusus

- **Kamera offline:** feed diganti placeholder "Tidak ada sinyal" + waktu `last_seen_at`.
- **Worker error / model gagal:** panel status merah dengan pesan dari `/api/health`.
- **Kosong:** log tanpa data → "Belum ada kejadian".
- **Akses ditolak (401/403):** arahkan ke login atau tampilkan pesan.
- **Snapshot tidak tersedia:** placeholder + status kegagalan penyimpanan.
- **Token kedaluwarsa saat menonton:** endpoint gambar/WS mengembalikan 401 → redirect ke login dengan pesan "Sesi berakhir, silakan masuk lagi."

## 7. Aksesibilitas

Kontras teks minimal WCAG AA, status disertai teks/ikon, navigasi keyboard pada tabel dan form, label form eksplisit, ukuran target sentuh memadai untuk tablet.

## 8. Prototype

Wireframe ASCII di atas adalah acuan. Prototype interaktif bisa dibuat di Figma dengan token pada §2; ganti tautan ini dengan URL Figma setelah dibuat: _TBD_.
