import sys

from sqlalchemy import select

from app.db import SessionLocal
from app.models import Camera

SEED_CAMERAS = [
    {
        "name": "CAM-01",
        "location": "Webcam Laptop",
        "source_type": "webcam",
        "stream_config_ref": "CAM01_STREAM",
    },
    {
        "name": "CAM-02",
        "location": "Gerbang Masuk",
        "source_type": "phone",
        "stream_config_ref": "CAM02_STREAM",
    },
]


def main() -> int:
    with SessionLocal() as db:
        for item in SEED_CAMERAS:
            existing = db.scalar(select(Camera).where(Camera.name == item["name"]))
            if existing is None:
                db.add(Camera(**item))
                print(f"Kamera {item['name']} dibuat")
            else:
                print(f"Kamera {item['name']} sudah ada")
        db.commit()
    return 0


if __name__ == "__main__":
    sys.exit(main())
