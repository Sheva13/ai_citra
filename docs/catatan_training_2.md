# Catatan Training #2 — Rencana Retraining (READ ME SEBELUM TRAINING ULANG)

Tanggal dibuat: 17 Oktober 2026
Status: **RENCANA** — belum dikerjakan. Deteksi model saat ini (`helmet-v1`) masih sering salah.

---

## Mengapa retraining

Training #1 hanya memakai **27 gambar** (tanpa split val/test) → mAP50 hanya ± 0.35.
Deteksi lapangan belum akurat. Target training #2: **mAP50 ≥ 0.6** dengan dataset yang jauh lebih besar.

## Baseline yang harus dikalahkan (training #1)

| Metrik | Nilai |
|---|---|
| Gambar | 27 (train saja) |
| mAP50 final | ± 0.35 |
| mAP50 best | ± 0.38 |
| Precision | ± 0.66 |
| Recall | ± 0.48 |
| Model version di sistem | `helmet-v1` |

## Rencana dataset training #2

- [ ] Target minimal **300–1000+ gambar** (semakin banyak semakin baik).
- [ ] **Wajib split train/val/test** (mis. 70/20/10) — training #1 tidak punya val/test sehingga evaluasi tidak valid.
- [ ] Seimbangkan kelas `helmet` vs `no_helmet` (jangan timpang).
- [ ] Variasi: sudut (depan/samping/belakang), jarak (dekat/jauh), cahaya (siang/malam/payung), lokasi berbeda, jenis helm (standar, proyek, tanpa helm, helm di tangan ≠ dipakai — kasus sulit).
- [ ] Tambah gambar "hard negative": orang tanpa motor, motor tanpa orang, helm di spion — supaya tidak false positive.
- [ ] Foto sendiri dari kamera yang akan dipakai demo (HP di posisi yang sama) + tambahan dari Roboflow.
- [ ] Review label: bbox hanya di kepala (bagian helm), konsisten. Label salah = model rusak.

## Langkah training (Colab)

```python
# 1) Ambil dataset (ganti dengan link/source dataset baru)
# 2) Pastikan data.yaml benar: path lokal Colab, names urut dan konsisten
#    WAJIB: kelas bernama persis "no_helmet" dan "helmet" (huruf kecil, underscore)
# 3) Train
!yolo detect train model=yolov8n.pt data=data.yaml epochs=100 imgsz=640 patience=20 batch=16
# 4) Evaluasi di val + test (jangan hanya lihat loss)
!yolo detect val model=runs/detect/train/weights/best.pt data=data.yaml split=val
!yolo detect val model=runs/detect/train/weights/best.pt data=data.yaml split=test
# 5) Download best.pt
```

Catatan: boleh coba model lebih besar (yolov8s / yolo11s) bila dataset sudah cukup — tapi **catat nama model & versi ultralytics** di catatan training #3.

## Checklist integrasi SETELAH training (jangan lupa!)

1. [ ] Backup model lama: rename `ml/models/best.pt` → `ml/models/best_v1.pt` (jangan dihapus).
2. [ ] Copy `best.pt` baru → `F:\HELEMAI\ai_citra\ml\models\best.pt`.
3. [ ] Bump `MODEL_VERSION` di `.env` root (mis. `helmet-v2`) — supaya event baru tercatat pakai versi model baru.
4. [ ] Restart worker (`python -m vision.main`) → cek `GET http://127.0.0.1:8000/api/health`: `model.loaded=true`, `version=helmet-v2`.
5. [ ] Uji cepat lewat halaman `/detect`:
   - Upload 3–5 gambar dataset (yang ada no_helmet) → cek bbox benar.
   - Upload video pendek → cek timeline.
6. [ ] Uji live: masuk frame webcam tanpa helm → event muncul di `/logs` (butuh 3 dari 5 frame, conf ≥ 0.5).
7. [ ] Update `docs/catatan_training_1.md` → tambah seksi "Hasil training #2" **atau** buat `catatan_training_3.md` dengan metrik baru.

## Gotcha (jangan diulang)

- `F:\HELEMAI\result\data.yaml` = **file lama/stale** (names `['0','1']`, path `../`). Jangan dipakai training ulang.
- Nama kelas di model HARUS persis `no_helmet` / `helmet` — `annotate.py`, event processor, dan kolom DB memakai string ini. Kalau nama beda, terjemahkan dulu.
- Inference sistem pakai `INFERENCE_IMGSZ=640` dan `DETECT_CONF=0.25`, `CONF_MIN=0.5` — kalau training pakai imgsz lain, tetap uji di 640.
- GPU mesin lokal: GTX 1650 4GB, tapi torch terpasang versi **CPU**. Training tetap di Colab.
- Path weights di `.env`: `MODEL_PATH=ml/models/best.pt` (relatif ke root repo).
- Setelah ganti model, **restart worker** — model hanya dimuat saat startup (retry tiap 30 dtk bila gagal).
- Dataset lama ada di `F:\HELEMAI\train\` (images/labels Roboflow 27 gambar) — boleh digabung sebagai tambahan, tapi tetap buat split baru.

## Data training #1 (arsip, biar nggak hilang)

- Link download Roboflow: `https://app.roboflow.com/ds/NRCEsOi46x?key=8HRZ2xxlhh`
- Dataset lokal: `F:\HELEMAI\train\` (images + labels + data.yaml)
- Weights: `F:\HELEMAI\result\best.pt`, `F:\HELEMAI\result\last.pt`, salinan di `F:\HELEMAI\models\best.pt`

## Verifikasi akhir (definition of done training #2)

- [ ] mAP50 val ≥ 0.6 (minimal lebih tinggi jelas dari 0.38)
- [ ] Uji 10 gambar random di `/detect` → mayoritas benar
- [ ] Live webcam: pakai helm terdeteksi `helmet`, tanpa helm terdeteksi `no_helmet`
- [ ] Event baru di `/logs` ber-`model_version` `helmet-v2` (atau versi baru)
