"""Настраиваемые конфигурации параметров транскрипции.

Позволяет быстро переключаться между наборами параметров для A/B-тестирования.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class TranscriptionConfig:
    """Один набор параметров транскрипции."""

    name: str
    description: str

    # VAD parameters
    vad_enabled: bool = True
    vad_threshold: float = 0.5
    vad_min_speech_duration_ms: int = 250
    vad_min_silence_duration_ms: int = 2000
    vad_speech_pad_ms: int = 400

    # Decoding parameters
    beam_size: int = 8
    best_of: int = 8
    patience: float = 1.0  # Beam search patience (higher = more thorough)
    hotwords: str = ""  # Hotwords for boosting, comma-separated
    temperature: list[float] = field(default_factory=lambda: [0.0, 0.2, 0.4, 0.6])
    compression_ratio_threshold: float = 2.4
    log_prob_threshold: float = -1.0
    no_speech_threshold: float = 0.5
    condition_on_previous_text: bool = False

    # Post-processing
    enable_prompt_leak_filter: bool = True
    enable_hallucination_filter: bool = True
    enable_repeat_filter: bool = True
    enable_low_confidence_filter: bool = True
    enable_language_mix_fix: bool = True
    enable_segment_dedup: bool = False  # Экспериментально

    # Soft VAD fallback
    soft_vad_enabled: bool = True
    soft_vad_threshold: float = 0.15
    soft_vad_min_speech_duration_ms: int = 100
    soft_vad_min_silence_duration_ms: int = 300
    soft_vad_speech_pad_ms: int = 500
    soft_vad_coverage_threshold: float = 0.85

    # Initial prompt
    initial_prompt: str = "Song lyrics with music background."
    russian_initial_prompt: str = "Текст русской песни. Куплет, припев, повторяющиеся строки, музыка на фоне."


# ============== Предустановленные конфиги ==============

FACTORY = {

    "baseline": TranscriptionConfig(
        name="baseline",
        description="Исходная конфигурация (как есть в production)",
        vad_threshold=0.5,
        vad_min_silence_duration_ms=2000,
        beam_size=8, best_of=8,
        temperature=[0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6],
        compression_ratio_threshold=2.4,
        no_speech_threshold=0.5,
        soft_vad_threshold=0.15,
        soft_vad_min_silence_duration_ms=300,
        soft_vad_coverage_threshold=0.85,
    ),

    "vad_softer": TranscriptionConfig(
        name="vad_softer",
        description="VAD threshold понижен до 0.3, silence короче — больше речи попадает",
        vad_threshold=0.3,
        vad_min_speech_duration_ms=150,
        vad_min_silence_duration_ms=1000,
        vad_speech_pad_ms=500,
        beam_size=8, best_of=8,
        temperature=[0.0, 0.2, 0.4, 0.6],
        compression_ratio_threshold=2.4,
        no_speech_threshold=0.6,
        soft_vad_threshold=0.10,
        soft_vad_min_silence_duration_ms=200,
        soft_vad_coverage_threshold=0.80,
        initial_prompt="Текст песни. Куплет, припев, повторяющиеся строки.",
    ),

    "vad_minimal": TranscriptionConfig(
        name="vad_minimal",
        description="VAD почти выключен — минимальное отсечение, захват всего",
        vad_threshold=0.1,
        vad_min_speech_duration_ms=50,
        vad_min_silence_duration_ms=500,
        vad_speech_pad_ms=800,
        beam_size=10, best_of=10,
        temperature=[0.0, 0.1, 0.2, 0.3, 0.4, 0.5],
        compression_ratio_threshold=3.0,
        no_speech_threshold=0.7,
        soft_vad_enabled=False,  # не нужен — первый проход уже мягкий
    ),

    "no_vad_full_beam": TranscriptionConfig(
        name="no_vad_full_beam",
        description="VAD выключен, beam_size=12, захватывает всё подряд",
        vad_enabled=False,
        beam_size=12, best_of=10,
        temperature=[0.0, 0.2, 0.4, 0.6, 0.8],
        compression_ratio_threshold=3.5,
        log_prob_threshold=-2.0,
        no_speech_threshold=0.9,
        soft_vad_enabled=False,
    ),

    "low_noise_tolerant": TranscriptionConfig(
        name="low_noise_tolerant",
        description="Терпимый к шуму — для треков с плотной музыкой/битами",
        vad_threshold=0.25,
        vad_min_speech_duration_ms=100,
        vad_min_silence_duration_ms=800,
        beam_size=8, best_of=8,
        temperature=[0.0, 0.1, 0.2, 0.3, 0.4, 0.5],
        compression_ratio_threshold=2.8,
        no_speech_threshold=0.4,
        soft_vad_threshold=0.08,
        soft_vad_min_silence_duration_ms=150,
        soft_vad_coverage_threshold=0.75,
    ),

    "high_recall": TranscriptionConfig(
        name="high_recall",
        description="Максимальный захват — для проблем с началом/концом трека",
        vad_enabled=False,
        beam_size=10, best_of=8,
        temperature=[0.0, 0.1, 0.2, 0.3, 0.4, 0.5],
        compression_ratio_threshold=3.2,
        log_prob_threshold=-1.5,
        no_speech_threshold=0.8,
        soft_vad_enabled=False,
    ),

    "music_optimized": TranscriptionConfig(
        name="music_optimized",
        description="ОПТИМАЛЬНЫЙ: VAD выключен, beam=10, lenient decoding — для музыки",
        vad_enabled=False,
        beam_size=10,
        best_of=8,
        temperature=[0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6],
        condition_on_previous_text=False,
        compression_ratio_threshold=2.8,
        log_prob_threshold=-1.5,
        no_speech_threshold=0.7,
        soft_vad_enabled=False,
        enable_prompt_leak_filter=True,
        enable_hallucination_filter=True,
        enable_repeat_filter=True,
        enable_low_confidence_filter=True,
        enable_language_mix_fix=True,
        hotwords="любовь,ночь,сердце,глаза,танцы,комета,Сансара,дофамин,эй,ой,ведь,проходишь,секрет,втюрилась,влюблена",
        initial_prompt="Текст песни. Куплет, припев, повторяющиеся строки, музыка на фоне.",
    ),

    "music_precise": TranscriptionConfig(
        name="music_precise",
        description="ПРЕЦИЗИОННЫЙ: без VAD, beam=12, high temp — для сложных треков",
        vad_enabled=False,
        beam_size=12,
        best_of=10,
        temperature=[0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7],
        condition_on_previous_text=False,
        compression_ratio_threshold=3.0,
        log_prob_threshold=-2.0,
        no_speech_threshold=0.8,
        soft_vad_enabled=False,
        enable_prompt_leak_filter=True,
        enable_hallucination_filter=True,
        enable_repeat_filter=True,
        enable_low_confidence_filter=True,
        enable_language_mix_fix=True,
        hotwords="любовь,ночь,сердце,глаза,танцы,комета,Сансара,дофамин,эй,ой,ведь,проходишь,секрет,втюрилась,влюблена",
        initial_prompt="Русская поп-музыка. Текст песни: куплет, припев, бридж, повторяющиеся строки.",
    ),

    "music_rap_focused": TranscriptionConfig(
        name="music_rap_focused",
        description="ДЛЯ РЭПА/ХИП-ХОПА: без VAD, быстрый темп, плотный текст",
        vad_enabled=False,
        beam_size=10,
        best_of=8,
        temperature=[0.0, 0.1, 0.2, 0.3, 0.4, 0.5],
        condition_on_previous_text=False,
        compression_ratio_threshold=2.6,
        log_prob_threshold=-1.5,
        no_speech_threshold=0.7,
        soft_vad_enabled=False,
        enable_prompt_leak_filter=True,
        enable_hallucination_filter=True,
        enable_repeat_filter=False,  # для рэпа повторы не галлюцинации
        enable_low_confidence_filter=True,
        enable_language_mix_fix=True,
        initial_prompt="Rap lyrics, hip-hop music. Fast-paced verses, chorus, repeating lines.",
    ),

    "music_conditional": TranscriptionConfig(
        name="music_conditional",
        description="УСЛОВНЫЙ: condition_on_previous_text=True для лучшей связности текста",
        vad_enabled=False,
        beam_size=10,
        best_of=8,
        temperature=[0.0, 0.1, 0.2, 0.3, 0.4],
        condition_on_previous_text=True,
        compression_ratio_threshold=2.6,
        log_prob_threshold=-1.2,
        no_speech_threshold=0.7,
        soft_vad_enabled=False,
        enable_prompt_leak_filter=True,
        enable_hallucination_filter=True,
        enable_repeat_filter=True,
        enable_low_confidence_filter=True,
        enable_language_mix_fix=True,
        hotwords="любовь,ночь,сердце,глаза,танцы,комета,Сансара,дофамин,эй,ой,ведь,проходишь,секрет,втюрилась,влюблена",
        initial_prompt="Текст современной популярной песни. Куплет, припев. Певцы поют о любви, танцах, вечеринках.",
    ),

    "music_vad_light": TranscriptionConfig(
        name="music_vad_light",
        description="VAD очень легкий: threshold=0.05 — для шумных записей",
        vad_enabled=True,
        vad_threshold=0.05,
        vad_min_speech_duration_ms=50,
        vad_min_silence_duration_ms=800,
        vad_speech_pad_ms=600,
        beam_size=10,
        best_of=8,
        temperature=[0.0, 0.1, 0.2, 0.3, 0.4, 0.5],
        condition_on_previous_text=False,
        compression_ratio_threshold=2.8,
        log_prob_threshold=-1.5,
        no_speech_threshold=0.7,
        soft_vad_enabled=False,
        initial_prompt="Текст песни. Куплет, припев.",
    ),

    "music_polish": TranscriptionConfig(
        name="music_polish",
        description="ПОЛИРОВКА: beam=15, patience=2, suppressions",
        vad_enabled=False,
        beam_size=15,
        best_of=10,
        patience=2.0,
        temperature=[0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7],
        condition_on_previous_text=False,
        compression_ratio_threshold=2.6,
        log_prob_threshold=-1.0,
        no_speech_threshold=0.8,
        soft_vad_enabled=False,
        enable_prompt_leak_filter=True,
        enable_hallucination_filter=True,
        enable_repeat_filter=True,
        enable_low_confidence_filter=True,
        enable_language_mix_fix=True,
        hotwords="любовь,ночь,сердце,глаза,танцы,комета,Сансара,дофамин,эй,ой,ведь,проходишь,секрет,втюрилась,влюблена",
        initial_prompt="Современная популярная русская песня. Текст: куплет, припев. Слова о любви, танцах, отношениях.",
    ),

    "music_hybrid": TranscriptionConfig(
        name="music_hybrid",
        description="ГИБРИДНЫЙ: без языка, для треков с разными языками",
        vad_enabled=False,
        beam_size=12,
        best_of=8,
        temperature=[0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6],
        condition_on_previous_text=False,
        compression_ratio_threshold=2.8,
        hotwords="love,life,every,time,here,waiting,long,first,stay,look,eyes,broken,crying,anymore,dance,night,heart,freedom,world,light,feel,need,лайф,кайф,фристайл,вискарь",
        initial_prompt="Mixed Russian and English pop song. English chorus, Russian verses.",
    ),

    "music_hybrid_ru": TranscriptionConfig(
        name="music_hybrid_ru",
        description="ГИБРИДНЫЙ+RU: русский + английские hotwords",
        vad_enabled=False,
        beam_size=12,
        best_of=8,
        temperature=[0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6],
        condition_on_previous_text=False,
        compression_ratio_threshold=2.8,
        log_prob_threshold=-1.5,
        no_speech_threshold=0.7,
        soft_vad_enabled=False,
        enable_prompt_leak_filter=True,
        enable_hallucination_filter=True,
        enable_repeat_filter=True,
        enable_low_confidence_filter=True,
        enable_language_mix_fix=True,
        hotwords="love,life,every,time,here,waiting,long,first,stay,look,eyes,broken,crying,anymore,dance,night,heart,freedom,world,light,feel,need,лайф,кайф,фристайл,вискарь",
        initial_prompt="Русская поп-песня с английскими вставками. Русский текст, английский припев.",
    ),
}


def get_config(name: str = "baseline") -> TranscriptionConfig:
    """Возвращает конфиг по имени. Если не найден — baseline."""
    return FACTORY.get(name, FACTORY["baseline"])


def list_configs() -> list[str]:
    return list(FACTORY.keys())
