#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
from pathlib import Path

from utils.llm_engine import generate_world_state
from utils.text_processor import coref_resolve_many, preprocess_text, split_text


BASE_DIR = Path(__file__).resolve().parent
DATA_FILE = BASE_DIR / "data" / "the_dead_first_half.txt"
OUTPUT_FILE = BASE_DIR / "data" / "trpg_output.json"


def run_pipeline_from_text(text, max_chars=1200):
    chunks = split_text(text, max_chars=max_chars)
    resolved_chunks = coref_resolve_many(chunks)
    resolved_text = "\n\n".join(resolved_chunks)
    llm_result = generate_world_state(resolved_text)

    return {
        "input_chunks": chunks,
        "resolved_chunks": resolved_chunks,
        "resolved_text": resolved_text,
        "world_state": llm_result["world_state"],
        "model": llm_result["model"],
        "usage": llm_result["usage"],
    }


def run_pipeline(input_file=DATA_FILE, output_file=OUTPUT_FILE):
    chunks = preprocess_text(input_file)
    text = "\n\n".join(chunks)
    result = run_pipeline_from_text(text)

    output_file = Path(output_file)
    output_file.parent.mkdir(parents=True, exist_ok=True)
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"Pipeline completed. Output saved to {output_file}")
    return result


if __name__ == "__main__":
    run_pipeline()
