# Тонкая обёртка для обратной совместимости со старыми скриптами/Docker-командами:
# реальное приложение живёт в `app/main.py`.
from app.main import app  # noqa: F401

if __name__ == "__main__":
    import uvicorn
    from app.config import get_settings
    s = get_settings()
    uvicorn.run("app.main:app", host=s.host, port=s.port)
