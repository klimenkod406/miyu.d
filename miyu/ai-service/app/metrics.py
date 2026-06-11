"""Prometheus метрики для ai-service (Фаза 5).

Метрики:
- Воркеры: throughput, latency, ошибки
- Модерация: auto-approve rate, ai_score distribution
- Рекомендации: feed latency, cache hit rate, index size
- Общие: HTTP requests, DB queries
"""
from __future__ import annotations

from prometheus_client import Counter, Histogram, Gauge, Info

# ============================================================================
# Воркеры (RQ tasks)
# ============================================================================

# Счётчики задач
worker_jobs_total = Counter(
    'miyu_worker_jobs_total',
    'Total number of worker jobs processed',
    ['job_type', 'status']  # status: done, failed
)

# Латентность задач
worker_job_duration_seconds = Histogram(
    'miyu_worker_job_duration_seconds',
    'Worker job processing time',
    ['job_type'],
    buckets=[0.5, 1, 2, 5, 10, 30, 60, 120, 300]
)

# ============================================================================
# Модерация
# ============================================================================

# Распределение ai_score
moderation_ai_score = Histogram(
    'miyu_moderation_ai_score',
    'Distribution of AI moderation scores',
    buckets=[0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
)

# Решения модерации
moderation_decisions_total = Counter(
    'miyu_moderation_decisions_total',
    'Moderation decisions count',
    ['decision']  # auto_approve, pending, ai_flagged
)

# Флаги модерации
moderation_flags_total = Counter(
    'miyu_moderation_flags_total',
    'AI flags raised during moderation',
    ['flag']  # hate, nsfw_cover, invalid_audio, possible_duplicate, explicit_lyrics
)

# ============================================================================
# Рекомендации
# ============================================================================

# Латентность feed
recsys_feed_duration_seconds = Histogram(
    'miyu_recsys_feed_duration_seconds',
    'Feed generation time',
    ['mode'],  # content_based, popularity, hybrid
    buckets=[0.01, 0.05, 0.1, 0.2, 0.5, 1.0, 2.0, 5.0]
)

# Cache hit/miss
recsys_cache_requests_total = Counter(
    'miyu_recsys_cache_requests_total',
    'Cache requests',
    ['cache_type', 'result']  # cache_type: feed, similar; result: hit, miss
)

# Размер индексов
recsys_index_size = Gauge(
    'miyu_recsys_index_size',
    'Number of items in recommendation index',
    ['index_type']  # hnsw, itemcf
)

# Профили пользователей
recsys_profiles_total = Gauge(
    'miyu_recsys_profiles_total',
    'Total user profiles with taste embeddings'
)

# Feedback
recsys_feedback_total = Counter(
    'miyu_recsys_feedback_total',
    'User feedback events',
    ['target_type', 'score']  # target_type: track/artist/genre; score: 1/-1/-2
)

# ============================================================================
# HTTP API
# ============================================================================

http_requests_total = Counter(
    'miyu_http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status']
)

http_request_duration_seconds = Histogram(
    'miyu_http_request_duration_seconds',
    'HTTP request duration',
    ['method', 'endpoint'],
    buckets=[0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0]
)

# ============================================================================
# База данных
# ============================================================================

db_queries_total = Counter(
    'miyu_db_queries_total',
    'Total database queries',
    ['operation']  # select, insert, update, delete
)

db_query_duration_seconds = Histogram(
    'miyu_db_query_duration_seconds',
    'Database query duration',
    ['operation'],
    buckets=[0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0]
)

# ============================================================================
# Системная информация
# ============================================================================

service_info = Info('miyu_ai_service', 'AI service version and config')
