# ML — Dataset, Training, Evaluasi

## Kelas

| Kelas | Definisi anotasi |
|---|---|
| `helmet` | Helm terlihat **terpasang di kepala** pengendara |
| `no_helmet` | Kepala pengendara terlihat tanpa helm |

Helm yang dipegang, digantung di motor, atau milik penumpang lain **tidak** dianotasi `helmet`. Tambahkan kelas `person`/`motorcycle` hanya jika ada tujuan jelas.

Kasus tepi yang harus diputuskan dan ditulis di sini sebelum anotasi massal: helm terbuka (half-face), topi/kupluk, pengendara dari belakang, kepala terpotong frame, pengendara sangat jauh (ambang ukuran minimum bbox).

## Dataset

- Catat sumber dan lisensi tiap dataset di `datasets/README.md`. Jangan anggap semua dataset bebas dipakai.
- Data uji sendiri hanya dari lokasi yang diizinkan, seminimal yang dibutuhkan.
- Rekam dataset dengan HP, orientasi, ketinggian, dan resolusi **sama dengan deployment** (jangan campur portrait/landscape tanpa alasan).
- Anotasi: pakai tools (Roboflow/CVAT) — jangan menggambar satu-satu manual. Auto-label bootstrap dari model publik boleh untuk pre-label **train set**; wajib direview manusia. Test set selalu anotasi bersih tanpa pre-label.
- Variasi: dengan/tanpa helm, jarak, sudut, cahaya, occlusion, blur, helm kecil/tertutup.
- **Split berdasarkan video/sumber**, bukan acak per frame, agar test set tidak bocor.

## Alur

1. Baseline: jalankan model pralatih tanpa fine-tuning pada video uji.
2. Evaluasi kesalahan, anotasi kasus gagal.
3. Fine-tuning dari checkpoint pralatih.
4. Evaluasi baseline vs fine-tuned pada **test set yang sama**.

Catatan model interim: fine-tune dengan subset (300–500 gambar) lebih awal agar pipeline backend bisa diintegrasikan; retrain dengan dataset lengkap sebelum evaluasi final.

```bash
yolo detect train model=yolo11n.pt data=ml/configs/dataset.yaml epochs=100 imgsz=640 batch=16 patience=20
python ml/evaluate.py --weights ml/models/best.pt --data ml/configs/dataset.yaml
```

Perintah di atas titik awal; turunkan `batch` jika VRAM kurang dan pastikan nama bobot/lisensi cocok dengan versi library.

## Training di Colab

1. Export dataset (format YOLO) → upload ke Colab/Drive (atau unduh dataset publik berlisensi).
2. Train `yolo11n` `imgsz=640` di GPU Colab.
3. Unduh `best.pt` → taruh di `ml/models/best.pt` (tidak di Git) → catat versi, dataset, konfigurasi, dan checksum di `ml/models/MODELS.md`.
4. Inference deployment berjalan di CPU: bila FPS kurang, turunkan `imgsz` ke 480 atau export OpenVINO (`yolo export model=best.pt format=openvino`).

## Laporan evaluasi minimal

- Precision, recall, mAP per kelas; prioritas utama `no_helmet`
- Confusion matrix dan jumlah sampel
- Metrik per kondisi (jarak, cahaya, occlusion)
- Latensi p95 dan FPS (sebutkan hardware, resolusi, apakah streaming/penyimpanan dihitung)
- Parameter kejadian yang diuji (`CONF_MIN`, N dari M, cooldown) vs duplikasi dan miss

Laporkan angka aktual; jangan menyesuaikan hasil agar mencapai target.

## Berkas yang diharapkan

```
ml/
├── datasets/README.md
├── configs/dataset.yaml
├── models/MODELS.md      # versi model, dataset, config, checksum (bobot tidak di Git)
├── train.py
├── evaluate.py
└── README.md
```
