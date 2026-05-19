# TRPG World State Backend

This project turns narrative text into a TRPG world-state JSON object.

Pipeline:

1. Split source text into manageable chunks.
2. Resolve coreferences with the local AllenNLP SpanBERT model.
3. Send the resolved text to DeepSeek Chat Completions.
4. Return structured world-state JSON to the Web API and frontend.

## Setup

```powershell
pip install -r requirements.txt
```

Create `.env` from `.env.example` and set:

```env
DEEPSEEK_API_KEY=your_deepseek_api_key
DEEPSEEK_API_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

The old typo `DEESEEK_API_KEY` is still supported for compatibility, but
`DEEPSEEK_API_KEY` is preferred.

## Run

```powershell
python -m uvicorn app:app --host 127.0.0.1 --port 8000
```

Open:

```text
http://127.0.0.1:8000
```

API endpoints:

- `GET /api/health`
- `POST /api/world-state`

Example request body:

```json
{
  "text": "Your narrative text here.",
  "max_chars": 1200
}
```

## Notes

The API can start without loading the 1.3GB coreference model. The model is
loaded lazily on the first `/api/world-state` request.

The AllenNLP predictor also needs the spaCy English model. If it is missing,
install the local wheel after downloading it:

```bash
python -m pip install data/spacy/en_core_web_sm-3.3.0-py3-none-any.whl
```

## Offline SpanBERT Files

The AllenNLP archive still needs the Hugging Face transformer files for
`SpanBERT/spanbert-large-cased`. Download them once:

```bash
bash scripts/download_spanbert.sh
python scripts/check_spanbert.py
```

If Hugging Face is blocked or unstable, use a mirror:

```bash
HF_ENDPOINT=https://hf-mirror.com bash scripts/download_spanbert.sh
python scripts/check_spanbert.py
```

After the files exist in `data/spanbert-large-cased`, the backend will load
SpanBERT locally and will not need to connect to Hugging Face for coreference
resolution.
