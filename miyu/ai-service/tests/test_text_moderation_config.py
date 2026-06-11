from __future__ import annotations

from app.analysis import text_moderation
from app.config import get_settings


def test_toxicity_can_be_disabled_without_loading_detoxify(monkeypatch):
    get_settings.cache_clear()
    monkeypatch.setenv("MIYU_AI_ENABLE_TOXICITY_MODEL", "false")
    called = False

    def fail_load():
        nonlocal called
        called = True
        raise AssertionError("Detoxify model should not load when toxicity is disabled")

    monkeypatch.setattr(text_moderation, "_load_detoxify", fail_load)

    assert text_moderation.toxicity_scores("тестовый текст") == {}
    assert called is False
    get_settings.cache_clear()


def test_text_embeddings_can_be_disabled_without_loading_model(monkeypatch):
    get_settings.cache_clear()
    monkeypatch.setenv("MIYU_AI_ENABLE_TEXT_EMBEDDINGS", "false")
    called = False

    def fail_load():
        nonlocal called
        called = True
        raise AssertionError("SentenceTransformer should not load when text embeddings are disabled")

    monkeypatch.setattr(text_moderation, "_load_embedder", fail_load)

    assert text_moderation.embed("тестовый текст") is None
    assert called is False
    get_settings.cache_clear()
