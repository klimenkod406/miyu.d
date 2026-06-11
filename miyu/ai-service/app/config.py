from __future__ import annotations
from functools import lru_cache
from pathlib import Path
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict
APP_DIR = Path(__file__).resolve().parent
AI_SERVICE_DIR = APP_DIR.parent
REPO_ROOT = AI_SERVICE_DIR.parent
def _default_storage_root():
    lb = REPO_ROOT / "backend"
    if (lb / "uploads").exists(): return lb
    return Path("/data")
def _default_db_path():
    lp = REPO_ROOT / "database" / "miyu.db"
    if lp.exists(): return lp
    return Path("/data/miyu.db")
def _default_redis_url():
    if (REPO_ROOT / "backend").exists() and (REPO_ROOT / "ai-service").exists(): return "redis://localhost:6379/0"
    return "redis://redis:6379/0"
class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="MIYU_AI_", extra="ignore")
    host: str = "0.0.0.0"
    port: int = 8001
    log_level: str = "INFO"
    storage_root: Path = Field(default_factory=_default_storage_root)
    db_path: Path = Field(default_factory=_default_db_path)
    redis_url: str = Field(default_factory=_default_redis_url)
    rq_queue_default: str = "miyu-ai"
    whisper_model: str = "large-v3"  # Заменить на путь к large-v3-turbo-ct2
    whisper_compute_type: str = "int8"
    whisper_device: str = "cpu"
    whisper_num_workers: int = 3
    enable_toxicity_model: bool = True
    enable_text_embeddings: bool = True
    auto_approve_threshold: float = 0.20
    flag_threshold: float = 0.70
    unverified_artist_penalty: float = 0.10
    auto_approve_daily_limit: int = 0
@lru_cache(maxsize=1)
def get_settings(): return Settings()
