# Catatan Pengerjaan #1 — HelmetWatch

Tanggal catatan: 17 Oktober 2026
Status: MVP jalan end-to-end di lingkungan lokal (tanpa Docker)

---

## 1. Ringkasan

Alur lengkap sudah berjalan: **worker YOLO (kamera) → PostgreSQL → FastAPI → Next.js**, termasuk realtime (WebSocket + MJPEG), review kejadian, kelola kamera, dan fitur deteksi upload gambar/video. Semua komponen diuji E2E secara nyata (bukan mock).

## 2. Dataset

- Sumber: Roboflow (`helmet detection`, link download: `https://app.roboflow.com/ds/NRCEsOi46x?key=8HRZ2xxlhh`).
- Jumlah: **27 gambar** (hanya split train), kelas: `no_helmet` dan `helmet`.
- Distribusi instance: ± 38 helmet, 18 no_helmet.
- Data mentah Roboflow di `F:\HELEMAI\train\` (format YOLO: `images/`, `labels/`, `data.yaml`).
- Catatan: `F:\HELEMAI\result\data.yaml` adalah kopian lama Roboflow (names `['0','1']`, path `../`) — **jangan dipakai** untuk training ulang tanpa diperbaiki.

## 3. Training Model

- Platform: Google Colab (CPU/GPU Colab), arsitektur **YOLOv8n**.
- Konfigurasi: 100 epoch, `imgsz=640`.
- Hasil akhir (nilai dibulatkan):
  - mAP50 final ± **0.35** (best ± 0.38)
  - Precision ± **0.66**
  - Recall ± **0.48**
- Artefak:
  - `F:\HELEMAI\result\best.pt` + `last.pt` (hasil training)
  - `F:\HELEMAI\models\best.pt`
  - `F:\HELEMAI\ai_citra\ml\models\best.pt` (dipakai worker, ± 6.5 MB)
- Model version yang dipakai sistem: `helmet-v1` (env `MODEL_VERSION`).
- Evaluasi: akurasi masih rendah karena dataset kecil (27 gambar) — perlu dataset lebih besar untuk produksi.

## 4. Arsitektur yang Dibangun

Sesuai `docs/03-ARCHITECTURE.md` + `docs/05-API-SPEC-ERD.md`:

### 4.1 Vision worker (`services/vision/`)
Paket `vision/`:
- `config.py` — baca `.env`, path special-case (`/app/...` → repo-relative saat lokal).
- `db.py` — engine + model ORM (Camera, WorkerStatus, Event, Detection) untuk worker.
- `camera_source.py` — `PhoneStreamSource` (MJPEG HP), `WebcamSource` (index OpenCV), `RtspSource`; resolusi `stream_config_ref` → ENV.
- `detector.py` — `YoloDetector` (ultralytics) + `FakeDetector` (dev tanpa model).
- `tracker.py` — IoU tracker sederhana.
- `event_processor.py` — state machine IDLE/CANDIDATE/COOLDOWN, aturan N-of-M (default 3 dari 5), dedup IoU — **7/7 unit test lulus** (`tests/test_event_processor.py`).
- `annotate.py` — gambar bbox + label pada frame.
- `mjpeg.py` — FastAPI internal (port `8100`): `/stream`, `/frame.jpg`, `/health`, + endpoint deteksi upload.
- `main.py` — loop worker: reconnect kamera (backoff 1–30 dtk), heartbeat ke DB tiap 2 dtk, simpan snapshot (retry ≤ 3, tulis file dulu → INSERT), poll flag `cameras.enabled` tiap 5 dtk, mode `error/stopped/reconnecting/offline/running`.
- Lock inference (`infer_lock`) dipakai bersama oleh loop live dan deteksi upload supaya tidak bentrok.

### 4.2 API (`services/api/`)
- `app/main.py` — CORS, handler error format `{"error": {code, message, details}}`, WS `/ws`.
- `app/auth.py` — JWT HS256 + password pbkdf2_sha256; role `admin`/`operator`; token via `?token=` juga (untuk `<img>`/`<video>`).
- `app/ws.py` — broadcaster poll DB ≤ 1 dtk: `camera.status` + `event.created`.
- Router:
  - `/api/auth/login`, `/api/auth/me`
  - `/api/cameras` (+ start/stop = flag `enabled`), create admin-only
  - `/api/events` (filter kamera/status/tanggal + pagination), `/{id}`, `/{id}/snapshot?type=annotated|original`, `PATCH /{id}/review`
  - `/api/stream/{camera_id}` — proxy MJPEG dari worker
  - `/api/detect/image`, `/api/detect/video`, `/api/detect/video/{id}` — proxy deteksi upload
  - `/api/health`
- Alembic: `alembic upgrade head` (migrasi awal `1166620cdd28_initial_schema`).
- Scripts: `app/scripts/create_user.py`, `app/scripts/seed_demo.py`.

### 4.3 Web (`apps/web/`) — Next.js 14 + Tailwind
- `lib/api.ts` (client REST + URL stream/snapshot/deteksi dengan token), `lib/session.ts` (token di localStorage), `lib/format.ts` (WIB), `lib/types.ts`.
- `components/AuthGuard.tsx` — redirect ke `/login` bila tanpa sesi.
- `components/Header.tsx` — nav **Monitoring · Logs · Deteksi**, menu user (admin: Kelola kamera), jam WIB, logout.
- Halaman:
  - `/login` — form login asli (POST `/api/auth/login`).
  - `/monitoring` — selector kamera, live MJPEG, status WS realtime, FPS/p95, Start/Stop admin, kejadian terbaru, toast `event.created`.
  - `/logs` — tabel + filter kamera/status/tanggal + pagination.
  - `/logs/[id]` — snapshot (tab beranotasi/asli), metadata, deteksi, form review + riwayat.
  - `/cameras` — admin-only: tabel + start/stop + form tambah kamera (phone/rtsp/webcam).
  - `/detect` — **fitur baru**: upload gambar / video untuk deteksi.

### 4.4 Fitur deteksi upload (baru)
- Worker: `POST /detect/image` (jawab JSON + gambar anotasi base64), `POST /detect/video` (proses frame dengan stride, tulis video anotasi ke `storage/detections/{video_id}.mp4`, jawab statistik + timeline), `GET /detect/video/{id}`.
- API: proxy ketiganya + validasi tipe/ukuran (gambar ≤ 10 MB, video ≤ 150 MB) + auth.
- Web `/detect`: tab Gambar (hasil anotasi + tabel bbox/conf) dan tab Video (player hasil anotasi + statistik frame + timeline deteksi).
- Video panjang otomatis di-sample (maks 600 frame diproses, stride menyesuaikan).

## 5. Database & Seed

- PostgreSQL 18 lokal (instalasi di `F:\postgree`, service `postgresql-x64-18`).
- Database: `helmet_monitoring`; user `postgres` / password `123` (lokal dev).
- Tabel: `users`, `cameras`, `worker_status`, `events`, `detections`, `event_reviews`.
- User seed:
  - Admin: `admin@helmetwatch.local` / `admin123`
  - Operator: `operator@helmetwatch.local` / `operator123`
- Kamera seed: `CAM-01` (webcam laptop, `CAM01_STREAM=0`), `CAM-02` (HP IP Webcam, `CAM02_STREAM=http://192.168.43.101:8080/video`).

## 6. Environment Lokal

- Windows 10/11, PowerShell; Python 3.14.6; Node 24.18.0 (repo minta 22.x — warning saja, build web lolos).
- Dependensi penting: fastapi, uvicorn, sqlalchemy 2.x, psycopg[binary], alembic, pyjwt, **python-multipart**, httpx, ultralytics 8.4.x, torch CPU 2.14.x, opencv-python, python-dotenv, pytest.
- `.env` root sudah dikonfigurasi: DATABASE_URL lokal, `DETECTOR=yolo`, `MODEL_PATH=ml/models/best.pt`, `VISION_BASE_URL=http://127.0.0.1:8100`, `STORAGE_DIR=storage`.
- `apps/web/.env.local`: `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`, `NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws`.

## 7. Hasil Verifikasi E2E

- Login → token → akses endpoint terproteksi: OK.
- Worker webcam live: model loaded `helmet-v1`, fps ± 7, latency p95 ± 85–135 ms, heartbeat tidak stale.
- Stream MJPEG via API: 200, multipart, ± 865 KB / 5 dtk.
- WebSocket: `camera.status` realtime + `event.created` saat kejadian masuk.
- Event flow: event tersimpan → snapshot original+annotated tersimpan → tampil di `/api/events` → detail + deteksi → PATCH review `confirmed` + riwayat.
- Snapshot via API: 200 (image/jpeg).
- Deteksi gambar upload (contoh dataset): `helmet 0.71`, inferensi ± 199 ms, anotasi benar.
- Deteksi video upload (24 frame, stride 1): selesai ± 3.2 dtk, 20 frame berisi `helmet`, video hasil anotasi 1.39 MB dapat diputar/download.
- Build web (`npm run build`): sukses (lint + typecheck lolos), 9 route.

## 8. Cara Menjalankan (lokal, tanpa Docker)

```powershell
# 1) API (terminal 1)
cd F:\HELEMAI\ai_citra\services\api
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000

# 2) Worker (terminal 2) — kamera ditentukan CAMERA_ID (default CAM-01)
cd F:\HELEMAI\ai_citra\services\vision
python -m vision.main

# 3) Web (terminal 3)
cd F:\HELEMAI\ai_citra\apps\web
npm run dev
```

Buka `http://localhost:3000` → login `admin@helmetwatch.local` / `admin123`.

Catatan: **jangan** jalankan `npm run build` saat `npm run dev` aktif (keliru menulis folder `.next` yang sama → error chunk `Cannot find module './xx.js'`; solusi: matikan dev, hapus folder `.next`, jalankan ulang).

## 9. Bug yang Ditemukan & Solusi (selama E2E)

| Masalah | Penyebab | Solusi |
|---|---|---|
| FK violation saat simpan event | Detection di-INSERT sebelum Event (tanpa urutan FK) | `session.flush()` setelah add Event (`vision/main.py`) |
| Stream proxy 500 | `httpx.Timeout(connect=.., read=..)` tidak lengkap di httpx baru | Set default `httpx.Timeout(3.0)` / 4 parameter eksplisit |
| Login 422 | `EmailStr` pydantic menolak domain `.local` | Field `email` di login pakai `str` biasa |
| Runtime error startup | `python-multipart` belum terpasang | `pip install python-multipart` (+ masuk requirements) |
| Chunk dev korup `.next` | `npm run build` jalan bersamaan `npm run dev` | Hapus `.next`, hindari build saat dev aktif |
| Worker mati (Ctrl+C) | Command shell timeout membunuh process group | Jalankan service via `start` (console terpisah) |

## 10. Limitasi / Catatan Penting

- Akurasi model masih rendah (dataset 27 gambar; mAP50 ± 0.35) — event asli bisa jarang/lambat muncul (butuh 3 dari 5 frame `no_helmet` conf ≥ 0.5).
- Video upload diproses di CPU worker yang sama dengan live feed — saat memproses video, fps live sedikit turun (serialisasi inference).
- Token via `?token=` pada URL gambar/video hanya untuk demo lokal — jangan dipublikasikan tanpa HTTPS.
- `Docker Compose` belum bisa diuji (Docker tidak terpasang di mesin ini); versi lokal memakai Postgres langsung.
- Snapshot disimpan di `storage/` (privat, tidak di-commit). Satu event simulasi masih ada di tabel `events` (hasil uji pipeline) — bisa dihapus manual bila ingin bersih.

## 11. Rencana Selanjutnya

1. Perbesar dataset + retraining (target mAP50 ≥ 0.6), evaluasi ulang di test set.
2. Tuning `CONF_MIN` / `CONFIRM_N` / `CONFIRM_M` dengan data lapangan.
3. Uji kamera HP (IP Webcam + hotspot) sesuai checklist README.
4. Retention cleanup snapshot (`SNAPSHOT_RETENTION_DAYS`) — belum ada job.
5. Siapkan Docker Compose untuk deployment (belum diverifikasi lokal).
6. Uji sesi panjang (≥ 2 jam) untuk stabilitas worker + memori.
