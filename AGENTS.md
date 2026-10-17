# AGENTS.md — Konteks Proyek HelmetWatch

> File ini dibaca otomatis oleh opencode di setiap sesi baru. Baca juga `docs/catatan_training_*.md` sebelum menyentuh apa pun terkait model/ML.

## Apa ini

Sistem monitoring deteksi helm (indikasi untuk ditinjau manusia, bukan keputusan otomatis). Alur: **worker YOLO (kamera) → PostgreSQL → FastAPI → Next.js**. Spesifikasi lengkap di `docs/01-PRD.md` … `docs/06-BACKLOG.md` — **docs adalah sumber kebenaran**; beda pendapat → ikuti docs atau tanya user.

## Bahasa & gaya

- User berbahasa Indonesia santai. Balas bahasa Indonesia, singkat, langsung.
- Jangan commit tanpa diminta. Jangan print/commit isi `.env`.

## Cara menjalankan (lokal, TANPA Docker — Docker tidak terpasang di mesin ini)

```powershell
# API (port 8000)
cd F:\HELEMAI\ai_citra\services\api
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000

# Worker vision (internal 8100, kamera CAM-01 = webcam)
cd F:\HELEMAI\ai_citra\services\vision
python -m vision.main

# Web (port 3000)
cd F:\HELEMAI\ai_citra\apps\web
npm run dev
```

- **JANGAN `npm run build` saat `npm run dev` aktif** → folder `.next` korup (error `Cannot find module './xx.js'`). Fix: matikan dev, hapus `.next`, jalankan ulang.
- Saat menjalankan service dari sesi agent via shell: pakai `cmd /c start ... /min` (console terpisah) supaya tidak ikut terbunuh saat command timeout.
- Restart service setelah mengubah kodenya (uvicorn/worker tanpa `--reload`).

## Database & kredensial (dev lokal)

- PostgreSQL 18 di `F:\postgree\bin\psql.exe` (bukan path standar), service `postgresql-x64-18`.
- DB `helmet_monitoring`, user `postgres` / password `123`.
- SQLAlchemy URL: `postgresql+psycopg://postgres:123@localhost:5432/helmet_monitoring` (di `.env` root).
- Migrasi: `cd services/api && python -m alembic upgrade head` (env.py baca `.env` root otomatis).
- Login web: `admin@helmetwatch.local` / `admin123` (admin), `operator@helmetwatch.local` / `operator123`.
- Kamera seed: `CAM-01` webcam (`CAM01_STREAM=0`), `CAM-02` HP IP Webcam (`CAM02_STREAM=http://192.168.43.101:8080/video`).

## Model & retraining — PENTING

- Model aktif: `ml/models/best.pt`, version `helmet-v1`. **Akurasi masih rendah** (dataset cuma 27 gambar, mAP50 ± 0.35) — user berencana retraining.
- **Sebelum kerja apa pun soal training: baca `docs/catatan_training_1.md` (hasil training #1) dan `docs/catatan_training_2.md` (rencana retraining + checklist integrasi + gotcha).**
- Nama kelas model HARUS persis `no_helmet` dan `helmet` — dipakai di annotate, event processor, dan DB.
- `F:\HELEMAI\result\data.yaml` itu file STALE — jangan dipakai.
- Sumber training: Colab (bukan lokal; torch lokal = CPU build, GPU GTX 1650 tidak dipakai).

## Struktur kunci

- `services/vision/vision/` — worker: `main.py` (loop + lock inference + deteksi upload), `event_processor.py` (state machine N-of-M), `mjpeg.py` (server internal + endpoint `/detect/*`), `camera_source.py`, `tracker.py`.
- `services/api/app/` — `routers/{auth_routes,cameras,events,detect,stream,health}.py`, `auth.py` (JWT, token via `?token=` untuk img/video), `ws.py` (`camera.status`, `event.created`).
- `apps/web/src/` — `lib/api.ts` + `lib/session.ts` (token localStorage), halaman `monitoring`, `logs`, `logs/[id]`, `cameras`, `login`, `detect`, `components/AuthGuard.tsx`.
- `storage/` — snapshot privat (`snapshots/...`, `detections/*.mp4`). Error API format: `{"error": {code, message, details}}`.

## Konvensi penting

- Worker 1 kamera = 1 proses (`CAMERA_ID` env). Start/Stop kamera = flag `cameras.enabled` di DB (worker poll 5 dtk), bukan kill proses.
- Event: snapshot ditulis ke file dulu (retry ≤3) baru INSERT; dedup + cooldown di event processor.
- Frontend bicara HANYA ke API (worker internal, tidak diekspos).
- Test yang ada: `cd services/vision && pytest` (event processor). Web: verifikasi via `npm run build` (lint + typecheck) saat dev server MATI.
