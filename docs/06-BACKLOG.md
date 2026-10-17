# Task Backlog / User Stories

Dokumen terkait: [PRD](01-PRD.md) · [MVP Scope](02-MVP-SCOPE.md)

Estimasi: S ≤ 0,5 hari · M ≈ 1–2 hari · L ≈ 3–5 hari. Prioritas: **P0** wajib MVP, **P1** penting, **P2** opsional.
Owner: **A** = AI & video, **B** = backend & frontend (jika sendirian, kerjakan berurutan sesuai epic).

## Epic 1 — Fondasi dan baseline (Minggu 1)

| ID | User story | Kriteria penerimaan | P | Est | Owner |
|---|---|---|---|---|---|
| E1-01 | Sebagai tim, saya ingin repo dan struktur folder siap agar kerja terorganisir | Struktur sesuai README, CI jalan | P0 | S | B |
| E1-02 | Sebagai tim, saya ingin tahu apakah kamera HP bisa distream | Frame HP terbaca OpenCV; metode streaming terdokumentasi | P0 | M | A |
| E1-03 | Sebagai tim, saya ingin definisi kelas dan panduan anotasi tertulis | `ml/README.md` memuat definisi `helmet`/`no_helmet`, kasus tepi | P0 | S | A |
| E1-04 | Sebagai tim, saya ingin baseline model tanpa fine-tuning | Metrik baseline pada video uji tercatat | P0 | M | A |

## Epic 2 — Dataset dan fine-tuning (Minggu 2)

| ID | User story | Kriteria penerimaan | P | Est | Owner |
|---|---|---|---|---|---|
| E2-01 | Sebagai tim, saya ingin dataset berlisensi jelas | Daftar sumber + lisensi di `ml/datasets/README.md` | P0 | M | A |
| E2-02 | Sebagai tim, saya ingin data uji sendiri dari lokasi yang diizinkan | Rekaman terkumpul, jumlah dibatasi seperlunya | P0 | M | A |
| E2-03 | Sebagai tim, saya ingin anotasi konsisten | Pemeriksaan kualitas sampel; format YOLO | P0 | L | A |
| E2-04 | Sebagai tim, saya ingin split berdasarkan video/sumber | Tidak ada frame video sama lintas split | P0 | S | A |
| E2-05 | Sebagai tim, saya ingin model fine-tuned | `train.py`, konfigurasi, bobot terbaik, versi tercatat | P0 | L | A |
| E2-06 | Sebagai tim, saya ingin evaluasi baseline vs fine-tuned | `evaluate.py` menghasilkan precision, recall, mAP, confusion matrix | P0 | M | A |
| E2-07 | Sebagai tim, saya ingin evaluasi per kondisi | Metrik per jarak, cahaya, occlusion | P1 | M | A |

## Epic 3 — Video worker dan inferensi (Minggu 3)

| ID | User story | Kriteria penerimaan | P | Est | Owner |
|---|---|---|---|---|---|
| E3-01 | Sebagai sistem, saya ingin `CameraSource` abstrak | Antarmuka + `PhoneStreamSource`; `RtspSource` stub | P0 | M | A |
| E3-02 | Sebagai sistem, saya ingin reconnect otomatis | Kamera putus lalu tersambung kembali tanpa restart; test simulasi | P0 | M | A |
| E3-03 | Sebagai sistem, saya ingin hanya memproses frame terbaru | Antrean tidak menumpuk saat inferensi lambat | P0 | S | A |
| E3-04 | Sebagai sistem, saya ingin inferensi YOLO + tracking | Output kelas, bbox, confidence, track_id | P0 | M | A |
| E3-05 | Sebagai sistem, saya ingin mengukur FPS dan latensi | Metrik FPS dan p95 ditulis ke `worker_status` (DB) dan dibaca API | P0 | S | A |
| E3-06 | Sebagai tim, saya ingin worker berjalan tanpa model untuk uji E2E | Switch `DETECTOR=fake` (FakeDetector); state machine & snapshot teruji deterministik | P0 | S | A |
| E3-07 | Sebagai tim, saya ingin koneksi FFMPEG tidak menggantung saat jaringan putus | `rw_timeout` diset; loop baca menguras buffer; inferensi terjadwal `1/TARGET_FPS` | P0 | S | A |

## Epic 4 — Event processor dan snapshot (Minggu 3–4)

| ID | User story | Kriteria penerimaan | P | Est | Owner |
|---|---|---|---|---|---|
| E4-01 | Sebagai sistem, saya ingin state machine kejadian | IDLE→CANDIDATE→CONFIRMED→SAVED→COOLDOWN, unit test | P0 | M | A |
| E4-02 | Sebagai sistem, saya ingin parameter (conf_min, N/M, cooldown) di konfigurasi | Dapat diubah via env tanpa ubah kode | P0 | S | A |
| E4-03 | Sebagai sistem, saya ingin snapshot asli dan beranotasi | Dua file tersimpan di path terstruktur | P0 | M | A |
| E4-04 | Sebagai sistem, saya ingin kegagalan snapshot/DB tidak tampak sukses | `snapshot_status=failed`, retry terbatas, test | P0 | M | A |
| E4-05 | Sebagai tim, saya ingin eksperimen ambang konfirmasi | Tabel perbandingan konfigurasi vs duplikasi/miss | P1 | M | A |

## Epic 5 — Backend dan database (Minggu 4)

| ID | User story | Kriteria penerimaan | P | Est | Owner |
|---|---|---|---|---|---|
| E5-01 | Sebagai dev, saya ingin skema DB + migrasi | Alembic membuat semua tabel termasuk `cameras.location`, `cameras.enabled`, `worker_status`; indeks sesuai | P0 | M | B |
| E5-02 | Sebagai pengguna, saya ingin login | JWT, role admin/operator, hash password, `/auth/me` balikin role | P0 | M | B |
| E5-03 | Sebagai admin, saya ingin API kamera | CRUD + location + start/stop (set `cameras.enabled`); operator → 403 | P0 | M | B |
| E5-04 | Sebagai operator, saya ingin API log | Filter camera_id + tanggal + status, pagination, detail sertakan location | P0 | M | B |
| E5-05 | Sebagai operator, saya ingin snapshot terotorisasi | Tanpa token → 401; operator boleh, tanpa hak → 403 | P0 | S | B |
| E5-06 | Sebagai operator, saya ingin menyimpan review | PATCH review operator+admin, riwayat tersimpan | P0 | S | B |
| E5-07 | Sebagai tim, saya ingin `/api/health` | Status DB, storage, workers[] per kamera, model | P0 | S | B |
| E5-08 | Sebagai tim, saya ingin tes API | pytest coverage endpoint utama + 403 operator ke kamera | P0 | M | B |
| E5-09 | Sebagai operator, saya ingin stream MJPEG lewat API | `GET /api/stream/{camera_id}` proxy ke worker; 503 rapi saat worker mati | P0 | S | B |
| E5-10 | Sebagai operator, saya ingin pembaruan realtime dari WebSocket | API poll DB ≤ 1 dtk; siarkan `camera.status` + `event.created` | P0 | M | B |
| E5-11 | Sebagai dev, saya ingin data contoh agar frontend bisa dikerjakan tanpa worker | Script `seed_demo` (dev-only) | P1 | S | B |

## Epic 6 — Dashboard monitoring (Minggu 5)

| ID | User story | Kriteria penerimaan | P | Est | Owner |
|---|---|---|---|---|---|
| E6-01 | Sebagai dev, saya ingin shell Next.js + auth | Login, guard role (operator vs admin), layout terang, header Monitoring+Logs untuk semua role; `/cameras` via dropdown user (bukan nav) | P0 | M | B |
| E6-02 | Sebagai operator, saya ingin live feed fokus + selector cam di body | Selector CAM-01/CAM-02 di body (bukan header), `?camera=` persist saat refresh, ganti cam tanpa reload penuh + WS resubscribe, placeholder saat offline; stream via `GET /api/stream/{camera_id}` | P0 | L | B |
| E6-03 | Sebagai operator, saya ingin status + info kamera | Badge online/offline/error/reconnecting dari backend + lokasi besar + FPS/latensi + jam WIB + last_seen | P0 | M | B |
| E6-04 | Sebagai operator, saya ingin pembaruan realtime | WebSocket filter per camera_id + reconnect + banner | P0 | M | B |
| E6-05 | Sebagai operator, saya ingin toast kejadian baru | Toast muncul saat `event.created` untuk cam aktif | P1 | S | B |
| E6-06 | Sebagai operator, saya ingin ringkasan hari ini | Hitungan per status review untuk cam aktif | P1 | S | B |

## Epic 7 — Log dan review (Minggu 6)

| ID | User story | Kriteria penerimaan | P | Est | Owner |
|---|---|---|---|---|---|
| E7-01 | Sebagai operator, saya ingin tabel log penuh | Kolom ID, waktu WIB, kamera + lokasi, status, confidence | P0 | M | B |
| E7-02 | Sebagai operator, saya ingin filter dan pagination | Tanggal, kamera (Semua/CAM-01/...), status; independen dari pilihan monitoring | P0 | M | B |
| E7-03 | Sebagai operator, saya ingin halaman detail | Snapshot asli/anotasi, metadata + lokasi + model | P0 | M | B |
| E7-04 | Sebagai operator, saya ingin kontrol review | Confirmed/false positive + catatan (operator+admin) | P0 | S | B |
| E7-05 | Sebagai admin, saya ingin halaman kamera tersembunyi | `/cameras` via menu user, tidak di header; daftar + form (nama, lokasi, tipe, ref) + start/stop; operator 403 + menu hidden | P1 | M | B |

## Epic 8 — Pengujian, hardening, demo (Minggu 7–8)

| ID | User story | Kriteria penerimaan | P | Est | Owner |
|---|---|---|---|---|---|
| E8-01 | Sebagai tim, saya ingin uji model akhir | Lapor precision/recall, N sampel, confusion matrix | P0 | M | A |
| E8-02 | Sebagai tim, saya ingin ukur performa di perangkat target | FPS dan p95 dengan hardware dan resolusi tercatat | P0 | M | A |
| E8-03 | Sebagai tim, saya ingin uji kamera putus/tersambung | Skenario lulus, hasil terdokumentasi | P0 | M | A |
| E8-04 | Sebagai tim, saya ingin uji duplikasi dan snapshot | ≤ 5% duplikat, ≥ 99% snapshot pada skenario | P0 | M | A |
| E8-05 | Sebagai tim, saya ingin sesi uji 2 jam | Tanpa crash | P0 | M | B |
| E8-06 | Sebagai tim, saya ingin uji keamanan akses | Snapshot/endpoint admin tertutup tanpa izin | P0 | S | B |
| E8-07 | Sebagai tim, saya ingin kebijakan retensi snapshot | Job penghapusan terjadwal + dokumentasi | P1 | M | B |
| E8-08 | Sebagai dosen, saya ingin dokumentasi dan laporan | README instalasi, laporan evaluasi, skrip demo | P0 | M | B |
| E8-09 | Sebagai tim, saya ingin checklist ops demo kamera HP | Hotspot HP, IP Webcam (wakelock, battery optimization), dependency sudah dibuild, cek `curl` stream sebelum demo | P0 | S | B |

## Epic 9 — Opsional

| ID | User story | Kriteria penerimaan | P | Est | Owner |
|---|---|---|---|---|---|
| E9-01 | Studi kelayakan deteksi plat dari sudut kamera yang ada | Laporan kelayakan | P2 | M | A |
| E9-02 | OCR plat (`plate_reads`) | Terpisah dari logika helm; akurasi diukur sendiri | P2 | L | A |
| E9-03 | Adaptor RTSP CCTV | `RtspSource` teruji pada perangkat nyata | P1 | M | A |
| E9-04 | Multi-kamera 2 HP (stretch) | 2 worker (1 per kamera) jalan 15 mnt, FPS/latensi tercatat, UI single-focus ganti cam mulus | P1 | L | A |

## Keputusan yang sudah final (sebelumnya terbuka)

1. Server inferensi: **CPU** (GPU opsional); training model di Google Colab.
2. Jalur video ke browser: **MJPEG via proxy API** (`GET /api/stream/{camera_id}`); WebRTC hanya bila latensi terbukti tidak memadai.
3. Kamera HP: **IP Webcam MJPEG HTTP** (sudah teruji); RTSP hanya stub untuk CCTV.
4. Stack: **Next.js + FastAPI** — migrasi ke Django ditolak (lihat docs/03 §13).
