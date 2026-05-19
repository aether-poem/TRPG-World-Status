#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from pathlib import Path


BASE_DIR = Path(__file__).resolve().parents[1]
MODEL_DIR = BASE_DIR / "data" / "spanbert-large-cased"
REQUIRED_FILES = {
    "config.json": 100,
    "pytorch_model.bin": 600_000_000,
    "vocab.txt": 100_000,
}


def main():
    missing = []
    too_small = []

    for filename, min_size in REQUIRED_FILES.items():
        path = MODEL_DIR / filename
        if not path.exists():
            missing.append(filename)
            continue
        if path.stat().st_size < min_size:
            too_small.append((filename, path.stat().st_size, min_size))

    if missing or too_small:
        print(f"SpanBERT local model is not ready: {MODEL_DIR}")
        if missing:
            print("Missing:", ", ".join(missing))
        for filename, size, min_size in too_small:
            print(f"Too small: {filename} ({size} bytes, expected >= {min_size})")
        raise SystemExit(1)

    print(f"SpanBERT local model is ready: {MODEL_DIR}")


if __name__ == "__main__":
    main()
