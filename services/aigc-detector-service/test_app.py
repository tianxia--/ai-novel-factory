from fastapi.testclient import TestClient

import app as detector_app


class FakeDetector:
    def predict(self, text):
        ai_probability = 0.91 if "模板化" in text else 0.21
        human_probability = 1 - ai_probability
        label = "AI" if ai_probability >= human_probability else "人类"
        score = max(ai_probability, human_probability)
        return detector_app.DetectResponse(
            label=label,
            score=score,
            confidence=score,
            aiProbability=ai_probability,
            humanProbability=human_probability,
            model="fake-detector",
            maxLength=512,
        )


def test_health_does_not_load_model():
    detector_app._detector = None
    client = TestClient(detector_app.app)

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["ok"] is True
    assert response.json()["loaded"] is False


def test_detect_normalizes_ai_probability(monkeypatch):
    monkeypatch.setattr(detector_app, "get_detector", lambda: FakeDetector())
    client = TestClient(detector_app.app)

    response = client.post("/detect", json={"text": "这是一段模板化表达。"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["label"] == "AI"
    assert payload["aiProbability"] == 0.91
    assert payload["score"] == 0.91


def test_detect_batch_preserves_segment_metadata(monkeypatch):
    monkeypatch.setattr(detector_app, "get_detector", lambda: FakeDetector())
    client = TestClient(detector_app.app)

    response = client.post("/detect-batch", json={
        "segments": [
            {"id": "s1", "text": "她低头看见袖口沾着雨。", "startOffset": 0, "endOffset": 11},
            {"id": "s2", "text": "这是一段模板化表达。", "startOffset": 12, "endOffset": 22},
        ],
    })

    assert response.status_code == 200
    payload = response.json()
    assert payload["totalSegments"] == 2
    assert payload["maxAiProbability"] == 0.91
    assert payload["results"][1]["id"] == "s2"
    assert payload["results"][1]["label"] == "AI"
