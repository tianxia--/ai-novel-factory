from __future__ import annotations

import os
import threading
from dataclasses import dataclass
from typing import Any, Dict, List, Literal, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field


DEFAULT_MODEL_NAME = "yuchuantian/AIGC_detector_zhv3short"
DEFAULT_MAX_LENGTH = 512


class DetectRequest(BaseModel):
    text: str = Field(default="", description="Text to classify.")


class SegmentRequest(BaseModel):
    id: Optional[str] = None
    text: str
    index: Optional[int] = None
    startOffset: Optional[int] = None
    endOffset: Optional[int] = None
    metadata: Optional[Dict[str, Any]] = None


class DetectBatchRequest(BaseModel):
    segments: List[SegmentRequest] = Field(default_factory=list)


class DetectResponse(BaseModel):
    label: Literal["AI", "人类"]
    score: float
    confidence: float
    aiProbability: float
    humanProbability: float
    model: str
    maxLength: int


class SegmentDetectResponse(DetectResponse):
    id: Optional[str] = None
    index: Optional[int] = None
    startOffset: Optional[int] = None
    endOffset: Optional[int] = None
    metadata: Optional[Dict[str, Any]] = None


class DetectBatchResponse(BaseModel):
    results: List[SegmentDetectResponse]
    totalSegments: int
    maxAiProbability: Optional[float]
    averageAiProbability: Optional[float]
    model: str


@dataclass
class DetectorSettings:
    model_name: str = DEFAULT_MODEL_NAME
    max_length: int = DEFAULT_MAX_LENGTH
    device: str = "auto"


class ChineseAigcDetector:
    def __init__(self, settings: DetectorSettings):
        import torch
        from transformers.models.bert import BertForSequenceClassification, BertTokenizer

        self.torch = torch
        self.settings = settings
        self.device = self._resolve_device(settings.device)
        self.tokenizer = BertTokenizer.from_pretrained(settings.model_name)
        self.model = BertForSequenceClassification.from_pretrained(settings.model_name)
        self.model.to(self.device)
        self.model.eval()
        self.lock = threading.Lock()

    def predict(self, text: str) -> DetectResponse:
        stripped = text.strip()
        if not stripped:
            raise ValueError("text_required")

        with self.torch.no_grad():
            inputs = self.tokenizer(
                stripped,
                return_tensors="pt",
                max_length=self.settings.max_length,
                truncation=True,
            )
            inputs = {key: value.to(self.device) for key, value in inputs.items()}
            with self.lock:
                outputs = self.model(**inputs)
            probabilities = outputs.logits[0].softmax(0).detach().cpu().numpy()

        human_probability = float(probabilities[0])
        ai_probability = float(probabilities[1])
        if ai_probability >= human_probability:
            label: Literal["AI", "人类"] = "AI"
            score = ai_probability
        else:
            label = "人类"
            score = human_probability

        return DetectResponse(
            label=label,
            score=score,
            confidence=score,
            aiProbability=ai_probability,
            humanProbability=human_probability,
            model=self.settings.model_name,
            maxLength=self.settings.max_length,
        )

    @staticmethod
    def _resolve_device(value: str) -> str:
        if value and value != "auto":
            return value
        import torch
        return "cuda" if torch.cuda.is_available() else "cpu"


def load_settings() -> DetectorSettings:
    max_length_raw = os.getenv("AIGC_DETECTOR_MODEL_MAX_LENGTH", str(DEFAULT_MAX_LENGTH))
    try:
        max_length = int(max_length_raw)
    except ValueError:
        max_length = DEFAULT_MAX_LENGTH
    return DetectorSettings(
        model_name=os.getenv("AIGC_DETECTOR_MODEL", DEFAULT_MODEL_NAME),
        max_length=max(1, max_length),
        device=os.getenv("AIGC_DETECTOR_DEVICE", "auto"),
    )


app = FastAPI(title="AIGC Detector Service", version="0.1.0")
settings = load_settings()
_detector: Optional[ChineseAigcDetector] = None


def get_detector() -> ChineseAigcDetector:
    global _detector
    if _detector is None:
        _detector = ChineseAigcDetector(settings)
    return _detector


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "model": settings.model_name,
        "maxLength": settings.max_length,
        "loaded": _detector is not None,
    }


@app.post("/detect", response_model=DetectResponse)
def detect(request: DetectRequest) -> DetectResponse:
    try:
        return get_detector().predict(request.text)
    except ValueError as error:
        if str(error) == "text_required":
            raise HTTPException(status_code=400, detail="text_required") from error
        raise


@app.post("/detect-batch", response_model=DetectBatchResponse)
def detect_batch(request: DetectBatchRequest) -> DetectBatchResponse:
    detector = get_detector()
    results: List[SegmentDetectResponse] = []
    for index, segment in enumerate(request.segments):
        if not segment.text.strip():
            continue
        prediction = detector.predict(segment.text)
        results.append(SegmentDetectResponse(
            **prediction.model_dump(),
            id=segment.id,
            index=segment.index if segment.index is not None else index,
            startOffset=segment.startOffset,
            endOffset=segment.endOffset,
            metadata=segment.metadata,
        ))

    ai_probabilities = [result.aiProbability for result in results]
    return DetectBatchResponse(
        results=results,
        totalSegments=len(results),
        maxAiProbability=max(ai_probabilities) if ai_probabilities else None,
        averageAiProbability=sum(ai_probabilities) / len(ai_probabilities) if ai_probabilities else None,
        model=settings.model_name,
    )
