"""Точка входа FastAPI ai-service."""
from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.responses import PlainTextResponse

from .api.analysis_router import router as analysis_router
from .api.recsys_router import router as recsys_router
from .config import get_settings

logging.basicConfig(level=get_settings().log_level)

app = FastAPI(
    title="Miyu AI Service",
    description="Анализ треков, модерация и (в перспективе) рекомендации.",
    version="0.2.0",
)

app.include_router(analysis_router, tags=["analysis"])
app.include_router(recsys_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/metrics", response_class=PlainTextResponse)
def metrics() -> str:
    """Prometheus metrics endpoint (Phase 5)."""
    try:
        from prometheus_client import generate_latest, REGISTRY
        from . import metrics as m
        from . import db
        from .recsys import index as idx_mod, itemcf as itemcf_mod
        
        # Update gauge metrics
        try:
            # HNSW index size
            snap = idx_mod.get_index()
            m.recsys_index_size.labels(index_type='hnsw').set(snap.size)
        except Exception:
            pass
        
        try:
            # ItemCF index size
            cf_idx = itemcf_mod.get_index()
            m.recsys_index_size.labels(index_type='itemcf').set(cf_idx.size)
        except Exception:
            pass
        
        try:
            # User profiles count
            row = db.get_one("SELECT COUNT(*) as cnt FROM user_taste_profile WHERE taste_embedding IS NOT NULL")
            if row:
                m.recsys_profiles_total.set(row['cnt'])
        except Exception:
            pass
        
        # Service info
        from .config import get_settings
        s = get_settings()
        m.service_info.info({
            'version': '0.3.0',
            'analysis_version': s.analysis_version,
            'profile_version': s.profile_version,
            'whisper_model': s.whisper_model,
        })
        
        return generate_latest(REGISTRY).decode("utf-8")
    except Exception as e:
        return f"# metrics error: {e}\n"


if __name__ == "__main__":
    import uvicorn
    s = get_settings()
    uvicorn.run("app.main:app", host=s.host, port=s.port, reload=False)
