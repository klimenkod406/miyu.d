"""Audio tagging + embeddings через PANNs CNN14 (AudioSet, 527 тегов).

Веса скачиваются автоматически при первом вызове (~340 MB).
Эмбеддинг — выход penultimate слоя (2048-d).
"""
from __future__ import annotations

import logging
from pathlib import Path

import numpy as np

logger = logging.getLogger(__name__)

# Маппинг подмножества AudioSet-классов на наши mood/genre-тэги.
# Минимальный seed; будет расширяться по мере калибровки.
GENRE_KEYWORDS = {
    "rock", "pop", "hip hop", "rap", "electronic", "dance music",
    "house music", "techno", "trance", "drum and bass", "dubstep",
    "jazz", "blues", "classical music", "country", "reggae",
    "folk music", "metal", "punk rock", "r&b", "soul music",
    "ambient music", "lo-fi", "indie rock",
}

GENRE_ALIASES = {
    "pop music": "pop",
    "hip hop music": "hip hop",
    "rhythm and blues": "r&b",
}
MOOD_KEYWORDS = {
    "happy music": "happy",
    "sad music": "sad",
    "tender music": "tender",
    "exciting music": "energetic",
    "scary music": "dark",
    "angry music": "aggressive",
    "funny music": "playful",
    "background music": "calm",
}

_MODEL = None
_LABELS: list[str] | None = None


def _panns_data_dir() -> Path:
    return Path.home() / "panns_data"


def _assets_available() -> bool:
    data_dir = _panns_data_dir()
    labels_path = data_dir / "class_labels_indices.csv"
    checkpoint_path = data_dir / "Cnn14_mAP=0.431.pth"
    return labels_path.exists() and checkpoint_path.exists() and checkpoint_path.stat().st_size >= int(3e8)


def _fallback_result() -> dict:
    return {
        "raw_tags": [],
        "genre_tags": [],
        "mood_tags": ["neutral"],
        "embedding": None,
    }


def _load():
    global _MODEL, _LABELS
    if _MODEL is not None:
        return _MODEL, _LABELS

    if not _assets_available():
        logger.warning(
            "PANNs assets are missing in %s; audio tagging is skipped",
            _panns_data_dir(),
        )
        return None, None

    from panns_inference import AudioTagging, labels  # type: ignore
    logger.info("Loading PANNs CNN14 (CPU)...")
    _MODEL = AudioTagging(checkpoint_path=None, device="cpu")
    _LABELS = list(labels)
    return _MODEL, _LABELS


def predict(file_path: str, top_k: int = 15) -> dict:
    """Возвращает теги, подбор жанров/настроений и эмбеддинг."""
    import librosa

    audio, _ = librosa.load(file_path, sr=32000, mono=True)
    if audio.size == 0:
        raise ValueError("empty audio")
    audio = audio[None, :]  # (1, T)

    model, labels = _load()
    if model is None or labels is None:
        return _fallback_result()

    clipwise_output, embedding = model.inference(audio)
    probs = clipwise_output[0]
    emb = np.asarray(embedding[0], dtype=np.float32)

    idx_sorted = np.argsort(-probs)[:top_k]
    raw_tags = [{"tag": labels[i], "prob": float(probs[i])} for i in idx_sorted]

    genre_tags: list[dict] = []
    mood_tags: list[str] = []
    for t in raw_tags:
        low = t["tag"].lower()
        normalized_genre = GENRE_ALIASES.get(low, low)
        if normalized_genre in GENRE_KEYWORDS and t["prob"] > 0.025:
            genre_tags.append({"tag": normalized_genre, "prob": round(t["prob"], 4)})
        for k, mood in MOOD_KEYWORDS.items():
            if k in low and t["prob"] > 0.05 and mood not in mood_tags:
                mood_tags.append(mood)

    if not mood_tags:
        mood_tags.append("neutral")

    return {
        "raw_tags": raw_tags,
        "genre_tags": genre_tags,
        "mood_tags": mood_tags,
        "embedding": emb,
    }
