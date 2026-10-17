# Contributing & Git Rules

## Branch

| Branch | Fungsi |
|---|---|
| `main` | Stabil, selalu bisa didemokan. Hanya menerima merge dari PR. |
| `develop` | Integrasi harian. |
| `feat/<epic>-<singkat>` | Fitur, mis. `feat/e4-state-machine` |
| `fix/<singkat>` | Perbaikan bug |
| `docs/<singkat>` | Dokumentasi |
| `exp/<singkat>` | Eksperimen ML (tidak wajib di-merge) |

Jika sendirian, alur tetap sama (branch → PR ke `develop`) agar CI memeriksa setiap perubahan.

## Commit (Conventional Commits)

```
<type>(<scope>): <ringkasan imperatif, maks ~72 karakter>
```

Type: `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `chore`, `ci`, `ml`.
Scope: `web`, `api`, `vision`, `ml`, `db`, `infra`, `docs`.

Contoh: `feat(vision): tambah state machine kejadian`, `fix(api): tolak snapshot tanpa token`.

Satu commit = satu perubahan logis. Referensikan ID backlog di body (mis. `Refs: E4-01`).

## Pull request

- Target `develop` (rilis ke `main` lewat PR dari `develop`).
- Judul mengikuti format commit; isi sesuai template PR.
- CI harus hijau sebelum merge.
- Minimal 1 reviewer jika berdua; jika sendirian, review diri sendiri dengan checklist template.
- Merge dengan **squash** agar riwayat bersih.
- Hapus branch setelah merge.

## Definition of Done

- Test relevan ditambahkan dan lulus.
- Kegagalan (kamera putus, DB/snapshot gagal) ditangani tanpa menampilkan sukses palsu.
- Dokumentasi/README/`docs` diperbarui bila kontrak API, skema, atau konfigurasi berubah.
- Perubahan arsitektur/kontrak: PR `docs/*` **lebih dulu** (spesifikasi), implementasi menyusul; deviasi saat implementasi wajib memperbarui spek di PR yang sama.
- Tidak ada secret, dataset besar, atau bobot model di Git.

## Yang tidak boleh masuk Git

- `.env` dan kredensial/URL kamera
- Dataset besar, rekaman video, snapshot (`storage/`)
- Bobot model (`*.pt`, `*.onnx`) — simpan di penyimpanan artefak/drive tim, catat versi dan checksum di `ml/models/MODELS.md`
- Data pribadi pengendara apa pun

Jika secret terlanjur ter-commit: anggap bocor, ganti segera, lalu bersihkan riwayat.

## Konvensi kode

| Area | Aturan |
|---|---|
| Python | `ruff` (lint + format), type hints, Pydantic untuk skema, pytest |
| TypeScript | ESLint + Prettier, strict mode, tanpa `any` tanpa alasan |
| SQL/DB | Perubahan skema hanya lewat Alembic; satu migrasi per perubahan |
| API | Ikuti [spek](docs/05-API-SPEC-ERD.md); ubah spek di PR yang sama dengan kodenya |
| Waktu | UTC di backend/DB, konversi WIB hanya di UI |

## Versioning model dan dataset

- Setiap model: `helmet-vMAJOR.MINOR` (mis. `helmet-v1.2`), dicatat di `MODEL_VERSION` dan kolom `events.model_version`.
- Catat versi dataset, konfigurasi training, dan hasil evaluasi per model di `ml/models/MODELS.md`.
- Evaluasi selalu di test set yang sama agar perbandingan adil.

## CI/CD

- **CI** (`.github/workflows/ci.yml`): lint, test, build, docker build, pemindaian secret pada setiap push/PR.
- **CD**: tidak ada deployment otomatis di MVP. Deploy manual ke server demo:

```bash
git pull origin main
cp .env.example .env   # hanya pertama kali, lalu isi nilai asli
docker compose up -d --build
docker compose exec api alembic upgrade head
```

Pertimbangkan CD otomatis hanya setelah server target stabil dan tersedia lewat SSH/registry.

## Proteksi branch (disarankan)

Aktifkan di GitHub untuk `main` dan `develop`: wajib PR, wajib CI lulus, larang force-push.
