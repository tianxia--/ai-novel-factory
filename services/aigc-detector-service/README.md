# AIGC Detector Service

Standalone HTTP service for Chinese AI-generated text detection. It wraps the
YuchuanTian AIGC detector models behind a small JSON API that can be consumed by
AI Novel Factory through `AIGC_DETECTOR_PROVIDER=generic-json`.

## Model

Recommended default:

```text
yuchuantian/AIGC_detector_zhv3short
```

This is a Chinese BERT sequence-classification detector. The model file is about
390 MiB and the HuggingFace repository is about 818 MiB. The model truncates
input to 512 tokens, so long chapters should be detected as segments.

## Setup

```bash
cd services/aigc-detector-service
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
```

For Apple Silicon or CPU-only machines, install the CPU torch wheel appropriate
for your environment if `pip install` cannot resolve torch automatically.

## Run

```bash
uvicorn app:app --host 127.0.0.1 --port 8765
```

Configure AI Novel Factory:

```bash
export AIGC_DETECTOR_PROVIDER=generic-json
export AIGC_DETECTOR_URL=http://127.0.0.1:8765/detect
export AIGC_DETECTOR_THRESHOLD=0.8
```

## API

Health:

```bash
curl http://127.0.0.1:8765/health
```

Single text:

```bash
curl -X POST http://127.0.0.1:8765/detect \
  -H 'content-type: application/json' \
  -d '{"text":"这里放一段中文小说正文"}'
```

Batch:

```bash
curl -X POST http://127.0.0.1:8765/detect-batch \
  -H 'content-type: application/json' \
  -d '{"segments":[{"id":"s1","text":"第一段"},{"id":"s2","text":"第二段"}]}'
```

Response fields are normalized for AI Novel Factory:

```json
{
  "label": "AI",
  "score": 0.93,
  "confidence": 0.93,
  "aiProbability": 0.93,
  "model": "yuchuantian/AIGC_detector_zhv3short"
}
```

When `label` is `人类`, `aiProbability` is `1 - score`.
