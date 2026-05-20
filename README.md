# TRPG World Status

TRPG World Status is a web-based narrative processing tool for converting
English prose into a structured tabletop role-playing game world state.

The system first applies coreference resolution to the source text, replacing
pronouns and other referring expressions with their likely entities. It then
sends the resolved text to the DeepSeek Chat Completions API and asks the model
to produce a JSON world state containing characters, locations, factions, items,
relationships, quests, timeline events, atmosphere, and unresolved story
threads.

This project is intended as an experimental digital humanities and interactive
narrative prototype. It explores how NLP and large language models can support
the transformation of literary narrative into playable TRPG-oriented world
structures.

## Features

- Browser-based interface for entering or loading narrative text.
- Local sentence chunking with a custom tokenizer.
- AllenNLP SpanBERT-based coreference resolution.
- DeepSeek-powered TRPG world-state generation.
- Side-by-side display of:
  - original text,
  - coreference-resolved text,
  - generated world-state JSON.
- FastAPI backend with a simple JSON API.

## System Architecture

```text
Browser UI
  |
  | POST /api/world-state
  v
FastAPI backend
  |
  v
Local sentence tokenizer
  |
  v
AllenNLP + SpanBERT coreference resolution
  |
  v
DeepSeek Chat Completions API
  |
  v
Structured TRPG world-state JSON
```

## Technology Stack

- Python 3.9
- FastAPI
- Uvicorn
- AllenNLP
- AllenNLP Models
- SpanBERT large coreference model
- Hugging Face Transformers
- PyTorch
- spaCy
- DeepSeek Chat Completions API
- HTML, CSS, and vanilla JavaScript

Confirmed local environment versions:

```text
FastAPI 0.99.1
Uvicorn 0.39.0
Pydantic 1.8.2
spaCy 3.3.3
Python 3.9
```

## Repository Structure

```text
.
├── app.py
├── pipeline.py
├── requirements.txt
├── frontend/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── utils/
│   ├── text_processor.py
│   └── llm_engine.py
├── scripts/
│   ├── download_spanbert.sh
│   └── check_spanbert.py
└── data/
    └── .gitkeep
```

The `data/` directory is intentionally empty in the repository. Large model
files, local text data, generated outputs, and API keys are not committed.

## Requirements

This project requires a Python environment capable of running AllenNLP and
PyTorch. Because the coreference model is large, a very small cloud server may
not be sufficient.

Recommended minimum for demonstration:

```text
4 CPU cores
8 GB RAM
```

The system can start with less memory, but the first coreference request may be
slow or fail if the server runs out of memory.

## Installation

Create and activate a virtual environment:

```bash
python -m venv trpg_env
source trpg_env/bin/activate
```

Install Python dependencies:

```bash
python -m pip install -r requirements.txt
```

If dependency resolution upgrades Pydantic to version 2, downgrade it because
AllenNLP and spaCy in this project expect Pydantic 1.x:

```bash
python -m pip install "pydantic<1.9" "fastapi<0.100" --force-reinstall
```

## DeepSeek Configuration

Create a `.env` file from `.env.example`:

```bash
cp .env.example .env
```

Set your own DeepSeek API key:

```env
DEEPSEEK_API_KEY=your_deepseek_api_key
DEEPSEEK_API_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

The repository does not include a real API key. Users must provide their own
key before calling the DeepSeek API.

For backward compatibility, the older misspelled variable name
`DEESEEK_API_KEY` is also supported, but `DEEPSEEK_API_KEY` is preferred.

## Model Files

The repository does not include large model files. They must be downloaded or
provided locally before running coreference resolution.

### AllenNLP Coreference Archive

Place the AllenNLP coreference model archive here:

```text
data/coref-spanbert-large-2021.03.10.tar.gz
```

### SpanBERT Transformer Files

The AllenNLP archive depends on the Hugging Face model
`SpanBERT/spanbert-large-cased`. Download it into:

```text
data/spanbert-large-cased/
```

You can use the provided script:

```bash
bash scripts/download_spanbert.sh
python scripts/check_spanbert.py
```

If Hugging Face is unavailable, use a mirror endpoint:

```bash
HF_ENDPOINT=https://hf-mirror.com bash scripts/download_spanbert.sh
python scripts/check_spanbert.py
```

The expected local files include:

```text
data/spanbert-large-cased/config.json
data/spanbert-large-cased/pytorch_model.bin
data/spanbert-large-cased/vocab.txt
data/spanbert-large-cased/tokenizer_config.json
```

The backend automatically uses `data/spanbert-large-cased/` if it exists.
Alternatively, set a custom local path:

```bash
export COREF_TRANSFORMER_MODEL_PATH=/path/to/spanbert-large-cased
```

### spaCy English Model

The AllenNLP predictor also requires a spaCy English model. For spaCy 3.3.x,
install `en_core_web_sm` 3.3.0:

```bash
python -m pip install data/spacy/en_core_web_sm-3.3.0-py3-none-any.whl
```

If installing from the internet:

```bash
python -m spacy download en_core_web_sm
```

## Running the Web App

Start the FastAPI server:

```bash
python -m uvicorn app:app --host 127.0.0.1 --port 8000
```

Open the local web interface:

```text
http://127.0.0.1:8000
```

For a public cloud demo, bind to all network interfaces:

```bash
python -m uvicorn app:app --host 0.0.0.0 --port 8000
```

Make sure the server firewall or cloud security group allows access to the
chosen port.

## API Reference

### Health Check

```http
GET /api/health
```

Response:

```json
{
  "status": "ok"
}
```

### Generate World State

```http
POST /api/world-state
```

Request body:

```json
{
  "text": "Alice saw Bob. She waved to him.",
  "max_chars": 1200
}
```

Response fields:

```json
{
  "input_chunks": [],
  "resolved_chunks": [],
  "resolved_text": "...",
  "world_state": {},
  "model": "deepseek-chat",
  "usage": {}
}
```

The `world_state` object is generated by DeepSeek and is expected to contain:

```text
summary
characters
locations
factions
items
relationships
timeline
quests
open_threads
atmosphere
scene_state
```

## Example Coreference Behavior

Input:

```text
Alice saw Bob. She waved to him.
```

Coreference-resolved text:

```text
Alice saw Bob. She waved to Bob.
```

The resolved text is then used as the input for world-state generation. This
helps the language model associate actions, goals, and relationships with the
correct entities.

## Security Notes

- Do not commit `.env`.
- Do not commit DeepSeek API keys.
- Do not commit local model files or virtual environments.
- This repository includes `.env.example` only.
- Users who deploy the project must provide their own DeepSeek API key.

## License

This project is licensed under the PolyForm Noncommercial License 1.0.0.

Noncommercial use is permitted. Commercial use, commercial deployment, resale,
or incorporation into commercial products requires prior permission from the
copyright holder.

See [LICENSE](LICENSE) and [NOTICE](NOTICE) for details.

## Limitations

- Coreference resolution is not always correct, especially in long literary
  passages with many characters or ambiguous pronouns.
- The generated world state is LLM output and should be reviewed by a human.
- First-time model loading can be slow.
- The current system is optimized for English narrative text.
- Large local models make low-memory cloud deployment difficult.

## Intended Use

This project is designed as a research and demonstration prototype for digital
humanities, narrative analysis, and TRPG world-building workflows. It is not a
fully automated literary interpretation system. Human review remains important,
especially when using the generated JSON for scholarly analysis or game design.
