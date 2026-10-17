# HelmetWatch — Sistem Monitoring Helm Berbasis YOLO

Sistem untuk mendeteksi indikasi pengendara sepeda motor tanpa helm dari video kamera, menampilkan hasilnya secara langsung, dan mencatat kejadian (snapshot + timestamp) untuk ditinjau manusia. Output sistem adalah **indikasi untuk ditinjau**, bukan keputusan otomatis.

Prototype memakai kamera HP; arsitektur memakai adaptor `CameraSource` agar CCTV kompatibel dapat dipakai tanpa mengubah logika deteksi.

## Dokumentasi

| Dokumen | Isi |
|---|---|
| [docs/01-PRD.md](docs/01-PRD.md) | Product requirements |
| [docs/02-MVP-SCOPE.md](docs/02-MVP-SCOPE.md) | Scope MVP, kriteria penerimaan, timeline |
| [docs/03-ARCHITECTURE.md](docs/03-ARCHITECTURE.md) | Arsitektur dan desain sistem |
| [docs/04-UIUX-WIREFRAME.md](docs/04-UIUX-WIREFRAME.md) | Wireframe dan panduan UI |
| [docs/05-API-SPEC-ERD.md](docs/05-API-SPEC-ERD.md) | Spesifikasi API dan ERD |
| [docs/06-BACKLOG.md](docs/06-BACKLOG.md) | Backlog dan user stories |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Aturan Git, branch, commit, PR |

## Stack

Next.js + TypeScript + Tailwind · FastAPI + SQLAlchemy + Alembic · Python + OpenCV + Ultralytics YOLO (inference CPU; training di Colab) · PostgreSQL · Docker Compose · WebSocket + MJPEG (proxy via API).

## Navigasi & roles (keputusan final)

- Header hanya 2: `Monitoring` + `Logs` (semua role).
- `/monitoring?camera=` — single-focus 1 feed (2/3 layar) + panel info lokasi/status/FPS (1/3), selector CAM di body.
- `/logs` — laporan penuh + filter kamera/tanggal/status.
- `/cameras` — admin-only via menu user, operator 403. Form wajib `location` (mis. Parkiran Depan).

## Struktur repository

```
projek/
├── apps/web/            # Next.js dashboard (kerangka sudah ada, Node 22)
├── services/
│   ├── api/             # FastAPI (REST + WebSocket + proxy MJPEG) + Alembic
│   └── vision/          # Video worker, YOLO, event processor (1 kamera = 1 worker)
├── ml/                  # Dataset, konfigurasi, train.py, evaluate.py
├── storage/             # Snapshot (privat, tidak di-commit)
├── tests/{integration,acceptance}/
├── docs/
├── .github/workflows/ci.yml
├── docker-compose.yml
├── .env.example
└── README.md
```

## Prasyarat

- Docker dan Docker Compose
- Node.js 22 untuk `apps/web` (repo ini diuji di Node 22. Jangan pakai Node 24 — `export PATH="$HOME/.nvm/versions/node/v22.23.3/bin:$PATH"` dulu).
- (Opsional) GPU NVIDIA + NVIDIA Container Toolkit untuk inferensi lebih cepat
- Python 3.11+ dan Node.js 20+ untuk pengembangan lokal tanpa Docker
- Bobot model fine-tuned di `ml/models/` (tidak disimpan di Git)

## Mulai cepat

```bash
cp .env.example .env
# isi nilai rahasia: POSTGRES_PASSWORD, JWT_SECRET, CAM01_STREAM, dll.

docker compose up --build
# web  : http://localhost:3000
# api  : http://localhost:8000/docs
```

Migrasi database:

```bash
docker compose exec api alembic upgrade head
```

Buat admin awal:

```bash
docker compose exec api python -m app.scripts.create_user --email admin@example.com --role admin
```

Seed data demo (opsional — agar frontend bisa dicoba tanpa worker):

```bash
docker compose exec api python -m app.scripts.seed_demo
```

Pengembangan tanpa model: set `DETECTOR=fake` di `.env` — worker berjalan dengan deteksi palsu sehingga seluruh alur E2E dapat diuji sebelum model dilatih.

## Menambah kamera

1. Tambahkan URL stream rahasia di `.env` (contoh `CAM02_STREAM=http://192.168.43.101:8080/video`) lalu `docker compose up -d`.
2. Buka `/cameras` (admin, via dropdown user) → isi form: nama, lokasi, tipe (`phone`/`rtsp`), `stream_config_ref` (nama variabel, mis. `CAM02_STREAM`).
3. Tambahkan service worker baru di `docker-compose.yml` (duplikat blok `vision`, ganti `CAMERA_ID`) → `docker compose up -d vision-cam2`.

Jika salah satu langkah belum lengkap, status kamera menunjukkan `error` dengan pesan jelas (bukan gagal diam-diam). Start/Stop = pause/resume pemrosesan (flag `cameras.enabled`), bukan menyalakan proses.

## Checklist uji/demo dengan kamera HP (hotspot)

- HP: IP Webcam aktif (MJPEG, 640×480), wakelock aktif, battery optimization dimatikan, HP tetap dicas.
- HP sebagai hotspot; cek IP AP (Android umumnya `192.168.43.1`) lalu sesuaikan `CAM01_STREAM`.
- Verifikasi dari server sebelum demo: `curl -I http://192.168.43.1:8080/video`.
- Semua dependency sudah dibuild sebelumnya (`docker compose build`) — laptop di hotspot belum tentu punya internet.
- Uji sesi 2 jam pada setup yang sama dengan demo.

## Pengembangan lokal

Tanpa Docker (setup yang diuji di repo ini):

```bash
# 0) PostgreSQL lokal: buat database helmet_monitoring, isi DATABASE_URL di .env
# 1) API
cd services/api
pip install -r requirements.txt
python -m alembic upgrade head
python -m app.scripts.create_user --email admin@helmetwatch.local --role admin
python -m app.scripts.seed_demo                # opsional: CAM-01 (webcam) + CAM-02 (phone)
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000

# 2) Vision worker (kamera dari DB; CAMERA_ID menentukan row)
cd services/vision
pip install -r requirements.txt
python -m vision.main                          # DETECTOR=yolo + MODEL_PATH=ml/models/best.pt

# 3) Web
cd apps/web
npm install
npm run dev                                    # buat .env.local dengan NEXT_PUBLIC_API_BASE_URL
```

Untuk uji alur lengkap tanpa kamera/model: set `DETECTOR=fake`. Build web sudah diverifikasi di Node 24 (warning engines 22.x saja); Node 22 tetap rekomendasi resmi.

Tes:

```bash
cd services/vision && pytest    # unit test event processor
cd apps/web && npm run build    # sekaligus lint + typecheck
```

## Melatih dan mengevaluasi model

Lihat `ml/README.md`. Ringkas:

```bash
yolo detect train model=yolo11n.pt data=ml/configs/dataset.yaml epochs=100 imgsz=640 batch=16 patience=20
python ml/evaluate.py --weights ml/models/best.pt --data ml/configs/dataset.yaml
```

Perintah di atas titik awal; sesuaikan dengan hardware dan versi library. Bandingkan baseline vs fine-tuned pada test set yang sama.

## Keamanan dan privasi

- Kredensial kamera hanya di `.env`/secret server, tidak pernah ke browser atau Git.
- Snapshot disimpan privat dan diakses lewat API terotorisasi.
- Token untuk endpoint gambar (stream/snapshot) memakai query `?token=` karena keterbatasan `<img>`; hanya untuk demo lokal, bukan untuk internet publik tanpa HTTPS.
- Kebijakan retensi snapshot diatur lewat `SNAPSHOT_RETENTION_DAYS`.
- Gunakan hanya di lokasi yang diizinkan; jangan publikasikan snapshot mentah.

## Status

Tahap implementasi — spesifikasi v3 final (lihat `docs`). Backend/worker/frontend dikerjakan dengan `DETECTOR=fake` tanpa menunggu model; training berjalan paralel di Colab. Lihat [MVP Scope](docs/02-MVP-SCOPE.md) untuk kriteria penerimaan dan [Backlog](docs/06-BACKLOG.md) untuk tugas.
