"""Извлечение базовых аудио-признаков на librosa.

Все возвращаемые значения нормализованы в [0..1] для производных метрик
(`danceability`, `energy`, `valence`, `acousticness`, `instrumentalness`,
`speechiness`). На фазе 0 — эвристики; в фазе 2 заменим на модели.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, asdict

import librosa
import numpy as np

logger = logging.getLogger(__name__)

NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]


@dataclass
class AudioFeatures:
    bpm: float
    key: str
    loudness: float
    energy: float
    danceability: float
    valence: float
    acousticness: float
    instrumentalness: float
    speechiness: float
    duration_sec: float
    sample_rate: int

    def asdict(self) -> dict:
        return asdict(self)


def _clip01(x: float) -> float:
    return float(max(0.0, min(1.0, x)))


def extract(file_path: str, target_sr: int = 22050) -> AudioFeatures:
    """Извлечь признаки. Бросает исключение при невалидном аудио."""
    y, sr = librosa.load(file_path, sr=target_sr, mono=True)
    if y.size == 0:
        raise ValueError("empty audio")

    duration = float(librosa.get_duration(y=y, sr=sr))

    # BPM
    tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
    bpm = round(float(np.atleast_1d(tempo)[0]), 2)

    # Key (упрощённо: argmax суммы chroma)
    chroma = librosa.feature.chroma_stft(y=y, sr=sr)
    key_idx = int(np.argmax(np.sum(chroma, axis=1)))
    key = NOTES[key_idx]

    # RMS / loudness
    rms = librosa.feature.rms(y=y).flatten()
    rms_mean = float(np.mean(rms))
    # Псевдо-LUFS: dBFS относительно 1.0
    loudness_db = float(20.0 * np.log10(max(rms_mean, 1e-6)))

    # Спектральные дескрипторы
    centroid = float(np.mean(librosa.feature.spectral_centroid(y=y, sr=sr)))
    rolloff = float(np.mean(librosa.feature.spectral_rolloff(y=y, sr=sr)))
    flatness = float(np.mean(librosa.feature.spectral_flatness(y=y)))
    zcr = float(np.mean(librosa.feature.zero_crossing_rate(y=y)))

    # Производные эвристики (фаза 0)
    energy = _clip01(np.interp(rms_mean, [0.0, 0.3], [0.0, 1.0]))
    danceability = _clip01(0.5 * np.interp(bpm, [60, 180], [0.0, 1.0]) + 0.5 * energy)
    valence = _clip01(0.6 * energy + 0.4 * np.interp(centroid, [500, 4000], [0.0, 1.0]))
    acousticness = _clip01(1.0 - np.interp(centroid, [500, 4000], [0.0, 1.0]))
    instrumentalness = _clip01(1.0 - np.interp(zcr, [0.02, 0.15], [0.0, 1.0]))
    speechiness = _clip01(np.interp(zcr, [0.02, 0.20], [0.0, 1.0]) * (1.0 - flatness))

    return AudioFeatures(
        bpm=bpm,
        key=key,
        loudness=round(loudness_db, 2),
        energy=round(energy, 4),
        danceability=round(danceability, 4),
        valence=round(valence, 4),
        acousticness=round(acousticness, 4),
        instrumentalness=round(instrumentalness, 4),
        speechiness=round(speechiness, 4),
        duration_sec=round(duration, 2),
        sample_rate=int(sr),
    )
