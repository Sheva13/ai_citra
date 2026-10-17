# PRD — Sistem Monitoring Helm Berbasis YOLO

| | |
|---|---|
| Status | v3 (revisi: stack final, integrasi via DB, MJPEG via API, keputusan terbuka selesai) |
| Tanggal | 2026-10-17 |
| Tim | 1–2 orang (tugas besar) |
| Dokumen terkait | [MVP Scope](02-MVP-SCOPE.md) · [Architecture](03-ARCHITECTURE.md) · [API & ERD](05-API-SPEC-ERD.md) · [Backlog](06-BACKLOG.md) |

## 1. Latar belakang

Pengendara sepeda motor tanpa helm meningkatkan risiko cedera berat saat kecelakaan. Pemantauan manual lewat CCTV tidak efisien karena operator harus menatap layar terus-menerus. Proyek ini membangun sistem yang mendeteksi indikasi pengendara tanpa helm dari video kamera, menampilkannya secara langsung, dan mencatat kejadian beserta snapshot dan timestamp untuk ditinjau manusia.

## 2. Tujuan

1. Mendeteksi pengendara yang terindikasi tidak memakai helm dari video kamera secara near-realtime.
2. Mencatat kejadian secara konsisten (snapshot, timestamp, kamera, versi model) tanpa log duplikat.
3. Menyediakan dashboard monitoring dan log kejadian yang bisa difilter dan ditinjau.
4. Membuktikan manfaat fine-tuning lewat evaluasi terukur (baseline vs fine-tuned).
5. Menyiapkan arsitektur yang bisa berpindah dari kamera HP ke CCTV tanpa menulis ulang logika deteksi.

### Non-goals

- Keputusan otomatis atau penilangan. Output hanya indikasi untuk ditinjau manusia.
- Pengenalan wajah atau identitas pengendara.
- Notifikasi WhatsApp/email, analitik kompleks, dan multi-tenant (di luar MVP).
- OCR plat sebagai syarat deteksi helm (opsional, tahap lanjutan).

## 3. Pengguna

| Persona | Role sistem | Kebutuhan | Aktivitas utama |
|---|---|---|---|
| Operator | `operator` (user biasa) | Melihat kondisi kamera dan kejadian baru secara langsung, verifikasi kejadian | Membuka `/monitoring`, `/logs`, `/logs/[id]`, menandai confirmed / false positive |
| Admin | `admin` | Semua hak operator + mengelola kamera dan akses | Registrasi kamera (+ lokasi), start/stop worker, kelola pengguna, buka `/cameras` |
| Dosen/penguji | — | Menilai kualitas sistem dan metodologi | Melihat demo, laporan evaluasi, metrik |

Aturan navigasi: header web hanya berisi 2 item — `Monitoring` dan `Logs` — untuk semua role.
Rute `/cameras` hanya untuk `admin`, diakses via menu user (ikon gear), tidak tampil di header dan tidak bisa dibuka `operator` (403 + sembunyikan menu).

## 4. Kebutuhan fungsional

| ID | Kebutuhan | Prioritas |
|---|---|---|
| FR-01 | Sistem menerima video dari kamera HP lewat antarmuka `CameraSource` (IP Webcam MJPEG HTTP — teruji; RTSP stub untuk CCTV) | Must |
| FR-02 | Sistem mendeteksi kelas `helmet` dan `no_helmet` dengan model YOLO hasil fine-tuning | Must |
| FR-03 | Dashboard `/monitoring` menampilkan 1 live feed fokus (setengah layar) + panel info (setengah layar: lokasi, status, FPS, latensi, jam WIB, ringkasan) dengan selector kamera di dalam halaman, bukan di header | Must |
| FR-04 | Event processor mengonfirmasi kejadian lewat validasi temporal (N dari M frame) dan tracking sederhana | Must |
| FR-05 | Setiap kejadian terkonfirmasi menyimpan snapshot asli dan beranotasi, timestamp UTC, kamera, dan versi model | Must |
| FR-06 | Sistem mencegah log duplikat lewat cooldown/rearm per track | Must |
| FR-07 | Halaman `/logs` adalah laporan penuh: filter tanggal, kamera (termasuk lokasi), status review, dan pagination | Must |
| FR-08 | Halaman detail menampilkan snapshot, metadata deteksi, dan kontrol review | Must |
| FR-09 | Status kamera berasal dari worker (bukan dari browser) dan pulih otomatis saat koneksi kembali | Must |
| FR-10 | Worker tetap berjalan walau dashboard ditutup | Must |
| FR-11 | Endpoint pengelolaan kamera (admin-only), review (operator+admin), dan snapshot dilindungi autentikasi; UI `/cameras` hanya untuk admin | Must |
| FR-12 | Setiap kamera memiliki `location` teks bebas (mis. "Parkiran Depan") yang ditampilkan di `/monitoring` dan `/logs` | Must |
| FR-13 | Deteksi lokasi plat dan OCR (`plate_reads`) | Could |
| FR-14 | Multi-kamera serentak (1 worker per kamera, single-focus di UI) | Could (dirancang multi, diuji 1 kamera; uji 2 HP sebagai stretch goal) |

## 5. Kebutuhan non-fungsional

| ID | Kebutuhan | Target awal |
|---|---|---|
| NFR-01 | Precision dan recall `no_helmet` pada test set terpisah | ≥ 85% (revisi sesuai hasil pilot) |
| NFR-02 | Latensi frame diterima sampai hasil inferensi, p95 | ≤ 500 ms pada perangkat deployment, diukur dari frame diterima worker (tidak termasuk latensi jaringan kamera) |
| NFR-03 | FPS pemrosesan stabil, satu kamera | ≥ 10 FPS |
| NFR-04 | Kejadian valid yang punya snapshot tersimpan | ≥ 99% |
| NFR-05 | Log duplikat pada skenario uji | ≤ 5% |
| NFR-06 | Ketahanan: sesi uji 2 jam tanpa crash, pemulihan koneksi terverifikasi | Lulus |
| NFR-07 | Timestamp disimpan UTC, ditampilkan WIB | Wajib |
| NFR-08 | Kredensial kamera tidak pernah dikirim ke browser | Wajib |
| NFR-09 | Snapshot tidak berada di folder publik; akses lewat otorisasi | Wajib |

Angka di atas adalah sasaran rekayasa, bukan klaim performa. Laporkan hasil aktual beserta jumlah sampel dan confusion matrix; jangan menyesuaikan angka hasil agar sesuai target.

## 6. Metrik keberhasilan

- Precision/recall `no_helmet` (utama), mAP (pendukung), dilaporkan per kondisi: jarak, pencahayaan, occlusion.
- Perbandingan model baseline vs fine-tuned pada test set yang sama.
- Persentase duplikasi log, tingkat keberhasilan snapshot, FPS, latensi p95.
- Hasil uji ketahanan (kamera terputus/tersambung, sesi panjang).

## 7. Asumsi dan dependensi

- Kamera HP menyiarkan MJPEG HTTP via IP Webcam (sudah teruji dibaca OpenCV); RTSP disiapkan sebagai stub.
- Satu komputer server di jaringan lokal; inference di CPU (GPU opsional); training model di Google Colab.
- Jaringan demo memakai hotspot HP (IP AP Android umumnya `192.168.43.1`), tidak bergantung Wi-Fi kampus.
- Dataset publik berlisensi sesuai ditambah data uji sendiri di lokasi yang diizinkan.

## 8. Risiko

Lihat daftar lengkap di [Architecture §9](03-ARCHITECTURE.md#9-risiko-dan-mitigasi). Risiko terbesar: definisi helm "dipakai" vs "terlihat", kualitas stream HP, kamera terlalu jauh/miring, performa CPU, duplikasi log, dan client isolation Wi-Fi kampus bila tidak memakai hotspot HP.

## 9. Etika dan privasi

Sistem memproses gambar orang di ruang publik. Gunakan lokasi pengujian yang diizinkan, batasi akses snapshot lewat autentikasi, tetapkan kebijakan retensi (default 30 hari, bisa diubah di `.env`), jangan publikasikan snapshot mentah, dan kumpulkan data uji seminimal yang dibutuhkan.

## 10. Keputusan final (sebelumnya pertanyaan terbuka)

1. Server inferensi **CPU**; training model di Google Colab.
2. Kamera HP memakai **IP Webcam MJPEG HTTP** (bukan RTSP); RTSP hanya stub.
3. Stack tetap **Next.js + FastAPI** (tidak pindah ke Django; tidak ada syarat stack dari dosen — lihat [Architecture §13](03-ARCHITECTURE.md#13-decision-log-final)).
4. Urutan kerja: backend + worker (`DETECTOR=fake`) dan wiring frontend lebih dulu; model asli menyusul tanpa memblokir (training paralel).
