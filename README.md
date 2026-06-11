# TRPG World Status

TRPG World Status is a web-based narrative processing tool for converting
English prose into a structured tabletop role-playing game world state.

The system first applies coreference resolution to the source text, replacing
pronouns and other referring expressions with their likely entities. It then
sends the resolved text to the DeepSeek Chat Completions API and asks the model
to produce a JSON world state containing characters, locations, factions, items,
relationships, quests, weakly structured timeline events, open narrative
threads, and global context variables.

This project is intended as an experimental digital humanities and interactive
narrative prototype. It explores how NLP and large language models can support
the transformation of literary narrative into playable TRPG-oriented world
structures.

## Features

- Browser-based interface for entering or loading narrative text.
- Browser-local snapshot save/load for generated results.
- Manual export of the full result as JSON and the coreference result as TXT.
- Clickable ontology-layer filters for micro, meso, macro, context, and full JSON views.
- Interactive knowledge graph generated from the same World Status JSON.
- Local sentence chunking with a custom tokenizer.
- AllenNLP SpanBERT-based coreference resolution.
- DeepSeek-powered TRPG world-state generation.
- Three-layer ontology-oriented output for digital humanities interpretation.
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

## Ontology-Oriented Output

The generated JSON keeps the original practical field structure, but its
meaning is aligned with a three-layer narrative ontology:

| Layer | JSON fields | Ontology reading | Interpretation value |
| --- | --- | --- | --- |
| Micro | `characters`, `items` | `Character`, `NarrativeObject / Clue`, `hasOwner`, `evokesMemory` | Character psychology, local interaction, symbolic objects, and clues. |
| Meso | `locations`, `factions`, `relationships` | `Place`, `CollectiveAgent`, `hasSocialRelationWith`, `belongsToCollective` | Social relations, group positions, spatial narrative, and faction pressure. |
| Macro | `timeline`, `quests`, `open_threads` | `NarrativeEvent`, `Quest`, `OpenThread`, `precedes`, `containsQuest` | Plot progression, task generation, and world-state evolution. |

`context_variables.atmosphere` and `context_variables.scene_state` are treated
as global contextual constraints rather than ordinary concept classes. They
describe the scene tone, psychological pressure, thematic atmosphere, and the
overall current condition of the adapted scenario.

Several ontology object properties are inferred from existing fields without
requiring extra JSON fields:

- `items.owner` -> `hasOwner`
- `items.importance` and `timeline` -> `evokesMemory`
- `factions.relationships` and `characters.description` -> `belongsToCollective`
- `timeline` order -> `precedes`
- `quests` and `open_threads` -> `containsQuest`

The browser interface exposes these layers as clickable filters:

- Micro view: `characters`, `items`
- Meso view: `locations`, `factions`, `relationships`
- Macro view: `timeline`, `quests`, `open_threads`
- Context view: `context_variables`
- Full JSON view: the complete generated world state

Filtering changes only the visible and copied JSON. Snapshot saving and JSON
downloads always preserve the complete world-state result.

## Interactive Knowledge Graph

The browser turns each generated or imported World Status JSON into an
interactive SVG knowledge graph without changing the backend JSON contract.
Designers can:

- drag nodes and pan or zoom the graph,
- search across node names and attributes,
- filter characters, locations, factions, items, events, quests, open threads,
  context, and externally referenced entities,
- click a node to inspect all of its World Status fields,
- import a previously downloaded World Status snapshot JSON,
- export a static SVG or a self-contained interactive HTML file.

Explicit `relationships` become graph edges, `items.owner` becomes an ownership
edge, and adjacent `timeline` entries are connected in sequence. The graph also
keeps a World Status root node so entities that do not yet have explicit
relationships remain discoverable.

The interactive HTML export can be opened directly in a modern browser without
the backend or an internet connection. It preserves search, type filters,
zooming, panning, node dragging, and the node detail panel.

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

## Netlify Deployment

The repository includes `netlify.toml` and lightweight Netlify Functions for a
production-hosted version:

```bash
netlify env:set DEEPSEEK_API_KEY your-key
netlify deploy --prod
```

Netlify cannot host the large AllenNLP/SpanBERT runtime, so the cloud deployment
passes source text directly to DeepSeek. The local FastAPI/WSL workflow
continues to perform coreference resolution before generation. Both deployments
support detailed acts, the interactive graph, and all export formats.

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
|-- app.py
|-- pipeline.py
|-- requirements.txt
|-- frontend/
|   |-- index.html
|   |-- styles.css
|   `-- app.js
|-- utils/
|   |-- text_processor.py
|   `-- llm_engine.py
|-- scripts/
|   |-- download_spanbert.sh
|   `-- check_spanbert.py
`-- data/
    `-- .gitkeep
```

The `data/` directory is intentionally empty in the repository. Large model
files, local text data, generated outputs, and API keys are not committed.

Browser snapshots are stored with `localStorage`. They remain in the current
browser only, are not uploaded to the server, and do not call DeepSeek again
when loaded.

## Performance and Warm-Up

The SpanBERT coreference model is large. On CPU, the first model load can take
several minutes, while subsequent short requests are much faster.

The application starts loading SpanBERT in a background thread as soon as the
FastAPI server starts. The browser shows `模型预热中` until the model is ready.
Keep the server running between requests to avoid repeating the cold start.

The process also keeps two in-memory caches:

- up to 128 repeated coreference chunks,
- up to 16 complete World Status results.

Submitting the same text again can therefore return immediately without
repeating DeepSeek API usage. These caches reset whenever the server restarts.

Optional performance environment variables:

```env
# Load the coreference model automatically when the server starts.
COREF_PRELOAD=1

# Use CPU. Set this to 0 only when CUDA-enabled PyTorch and a compatible GPU
# are available inside the runtime environment.
COREF_CUDA_DEVICE=-1
```

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

The download script resolves the model directory relative to the repository.
It therefore works from the current WSL project path without a hard-coded
drive letter.

## WSL Location And Startup

The registered Ubuntu distribution may be stored on a Windows drive such as:

```text
E:\WSL\Ubuntu
```

That storage path contains the WSL virtual disk. It is not the path used by
Linux commands. This repository is currently available inside WSL at:

```text
/mnt/e/AllenNLP/backend
```

From Windows PowerShell, start the WSL backend and long-running local proxy
with:

```powershell
.\scripts\start_wsl_stack.ps1
```

The PowerShell launcher derives the WSL project path from the current
repository location, starts the Linux virtual environment, discovers the
current WSL IP address, and exposes the application at:

```text
http://127.0.0.1:8000/
```

For a quick interface or health check without loading SpanBERT:

```powershell
.\scripts\start_wsl_stack.ps1 -SkipModelPreload
```

To run only the backend from inside WSL:

```bash
bash scripts/start_wsl_backend.sh 8001
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
acts
  act_number
  title
  dramatic_purpose
  opening_state
  scenes
    title
    location
    time
    participants
    objective
    beats
    conflict
    discoveries
    player_choices
    consequences
    transition
  character_changes
  clues_revealed
  unresolved_threads
  closing_state
  next_act_hook
characters
locations
factions
items
relationships
timeline
quests
open_threads
context_variables
  atmosphere
  scene_state
```

The frontend renders `acts` as a dedicated act-and-scene view. Each act captures
its dramatic purpose and state transition, while each scene provides concrete
beats, discoveries, player choices, and consequences for play.

For backward compatibility, if the model returns legacy top-level `atmosphere`
or `scene_state` fields, the backend normalizes them into
`context_variables`.

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
