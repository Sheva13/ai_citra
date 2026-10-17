# MVP Scope Definition

Dokumen terkait: [PRD](01-PRD.md) · [Backlog](06-BACKLOG.md)

## 1. Definisi MVP

> Kamera HP → YOLO hasil fine-tuning → validasi kejadian → snapshot → PostgreSQL → dashboard Next.js + halaman log.

MVP dianggap berhasil jika alur di atas berjalan end-to-end pada satu kamera, tercatat konsisten tanpa duplikasi, dan hasil pengujiannya terukur.

## 2. Scope fitur

| Fitur | Keputusan | Catatan |
|---|---|---|
| Live monitoring single-focus (1 feed setengah layar + panel info setengah layar + selector kamera di body) | **In** | `/monitoring?camera=` |
| Lokasi kamera (`location`) tampil di monitoring + logs | **In** | Kolom `cameras.location` |
| Header hanya `Monitoring` + `Logs`; `/cameras` admin-only via menu user | **In** | Guard role di frontend + backend |
| Deteksi `helmet` / `no_helmet` | **In** | Model fine-tuned |
| Fine-tuning + evaluasi baseline vs fine-tuned | **In** | Test set terpisah |
| Snapshot otomatis (asli + beranotasi) | **In** | Storage privat |
| Timestamp + log kejadian | **In** | UTC di DB, WIB di UI |
| Status koneksi kamera dari worker | **In** | Bukan dari browser |
| Filter, pagination, detail kejadian | **In** | `/logs`, `/logs/[id]` |
| Review manusia (pending/confirmed/false_positive) | **In** | Tabel `event_reviews` |
| Tracking sederhana + cooldown anti-duplikasi | **In** | Implementasi sederhana + fallback IoU |
| Mode pengembangan tanpa model (`DETECTOR=fake`) | **In** | Worker E2E dapat diuji sebelum model jadi |
| Autentikasi dasar (login, role admin/operator) | **In** | Kamera+user admin-only, review operator+admin, snapshot terlindungi |
| Docker Compose | **In** | GPU opsional, pola 1 worker per kamera |
| Deteksi lokasi plat | Could | Hanya jika inti selesai awal |
| OCR plat (`plate_reads`) | Could | Setelah stabilitas lulus uji; tabel dibuat saat fitur dikerjakan (bukan di migrasi awal) |
| Multi-kamera serentak (UI single-focus, 2 HP sebagai stretch) | Could | Dirancang multi, diuji 1 kamera |
| Notifikasi WhatsApp/email | **Out** | |
| Pengenalan wajah/identitas | **Out** | Di luar ruang lingkup selamanya |
| Dashboard analitik kompleks | **Out** | |
| Redis, Kafka, Kubernetes | **Out** | Belum sebanding dengan kebutuhan |

## 3. Kriteria penerimaan MVP

Tandai hanya setelah pengujian benar-benar dilakukan.

| # | Kriteria | Target awal | Status |
|---|---|---|---|
| 1 | Precision & recall `no_helmet` pada test set terpisah | ≥ 85% | [ ] |
| 2 | Latensi p95 (frame diterima → hasil inferensi) | ≤ 500 ms | [ ] |
| 3 | FPS stabil satu kamera | ≥ 10 FPS | [ ] |
| 4 | Kejadian valid dengan snapshot tersimpan | ≥ 99% | [ ] |
| 5 | Log duplikat pada skenario uji | ≤ 5% | [ ] |
| 6 | Sesi 2 jam tanpa crash + pemulihan kamera terverifikasi | Lulus | [ ] |

Laporkan hasil aktual, jumlah sampel, dan confusion matrix. Sebutkan hardware, resolusi input, dan apakah waktu streaming/penyimpanan ikut dihitung pada latensi.

## 4. Skenario uji sistem

Kamera normal · kamera terputus (status offline) · kamera tersambung kembali · deteksi tanpa helm (snapshot + record) · kejadian berlangsung lama (tidak log per frame) · DB gagal (tidak tampil sukses) · snapshot gagal (status gagal eksplisit) · dashboard di-refresh (pilihan `?camera=` tidak reset) · ganti CAM-01 → CAM-02 tanpa reload penuh + WS unsubscribe benar · dashboard ditutup (worker tetap jalan) · operator buka `/cameras` → 403 + menu disembunyikan · akses snapshot tanpa izin ditolak · akses stream tanpa token ditolak · token kedaluwarsa saat menonton → redirect login · plat tidak terlihat (helm tetap berjalan) · worker mode `DETECTOR=fake` (E2E tanpa model) · kamera HP via hotspot (cek `curl` sebelum sesi).

## 5. Urutan pengerjaan (berlaku juga jika sendirian)

1. Validasi stream kamera HP (lulus: IP Webcam MJPEG) dan baseline model.
2. Dataset & fine-tuning di Colab (mulai paralel sejak minggu 1; model interim dari subset boleh lebih awal).
3. Backend + DB (FastAPI) — tanpa model.
4. Worker video + event processor + snapshot dengan `DETECTOR=fake` — E2E tanpa model.
5. Dashboard monitoring, lalu log/detail/review (wiring frontend).
6. Tukar `DETECTOR=yolo` dengan `best.pt` → uji metrik → pengujian deployment dan stabilisasi.

Jangan membangun UI penuh sebelum streaming terbukti (sudah lulus). Worker `DETECTOR=fake` membuktikan pipa E2E tanpa menunggu model — backend, worker, dan frontend tidak terblokir oleh anotasi dataset.

## 6. Timeline 8 minggu

| Minggu | Fokus | Output |
|---|---|---|
| 1 | Analisis & baseline | Definisi kelas, arsitektur, uji stream HP, baseline model |
| 2 | Dataset & fine-tuning | Anotasi, split, training awal, evaluasi baseline |
| 3 | Integrasi kamera | `CameraSource` HP, reconnect |
| 4 | Backend & DB | API, tabel, penyimpanan snapshot |
| 5 | Dashboard monitoring | Live feed, status worker, WebSocket |
| 6 | Log & review | Filter, detail, review, anti-duplikasi |
| 7 | Pengujian deployment | Model, performa, koneksi putus, keamanan, storage |
| 8 | Stabilisasi & demo | Bug fix, dokumentasi, laporan, demo |

Model tidak memblokir backend: training berjalan paralel sejak minggu 1–2 (Colab); minggu 3–6 (worker, backend, dashboard) dikerjakan dengan `DETECTOR=fake`, lalu ditukar ke model asli.

## 7. Definition of Done (per fitur)

- Kode ter-merge lewat PR dengan CI hijau.
- Ada test relevan (pytest / komponen frontend).
- Perilaku gagal (kamera putus, DB/snapshot gagal) tertangani dan tidak menampilkan sukses palsu.
- Dokumentasi/README terkait diperbarui.
