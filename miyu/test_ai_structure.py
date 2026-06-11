"""Упрощенный тест AI-подсистемы без запуска тяжелых ML-моделей.

Проверяет:
1. Структуру файлов
2. Конфигурацию
3. Доступность БД
4. Наличие аудио-файлов
"""
import sys
import os
from pathlib import Path
import sqlite3

def test_structure():
    """Проверка структуры проекта."""
    print("=" * 60)
    print("MIYU AI SERVICE - STRUCTURE TEST")
    print("=" * 60)
    
    base = Path(__file__).parent
    
    # Проверка ключевых файлов
    checks = {
        "AI Service": base / "ai-service" / "app" / "main.py",
        "Metrics": base / "ai-service" / "app" / "metrics.py",
        "Pipeline": base / "ai-service" / "app" / "analysis" / "pipeline.py",
        "Feed": base / "ai-service" / "app" / "recsys" / "feed.py",
        "ItemCF": base / "ai-service" / "app" / "recsys" / "itemcf.py",
        "Requirements": base / "ai-service" / "requirements.txt",
        "Dockerfile": base / "ai-service" / "Dockerfile",
        "Prometheus Config": base / "ai-service" / "prometheus.yml",
        "Grafana Dashboard": base / "ai-service" / "grafana" / "dashboard.json",
        "Docker Compose": base / "database" / "docker-compose.yml",
        "Database": base / "database" / "miyu.db",
    }
    
    print("\nFile Structure:")
    all_ok = True
    for name, path in checks.items():
        exists = path.exists()
        status = "[OK]" if exists else "[FAIL]"
        print(f"   {status} {name}: {path.name}")
        if not exists:
            all_ok = False
    
    return all_ok

def test_database():
    """Проверка БД."""
    print("\nDatabase Check:")
    
    db_path = Path(__file__).parent / "database" / "miyu.db"
    if not db_path.exists():
        print("   [FAIL] Database not found")
        return False
    
    try:
        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()
        
        # Проверка AI-таблиц
        ai_tables = [
            'track_analysis',
            'user_taste_profile',
            'recsys_feedback',
            'ai_jobs',
            'track_similarity'
        ]
        
        for table in ai_tables:
            cursor.execute(f"SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?", (table,))
            exists = cursor.fetchone()[0] > 0
            status = "[OK]" if exists else "[FAIL]"
            print(f"   {status} Table: {table}")
        
        # Статистика
        cursor.execute("SELECT COUNT(*) FROM tracks")
        tracks_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM users")
        users_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM track_analysis")
        analysis_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM user_taste_profile")
        profiles_count = cursor.fetchone()[0]
        
        print(f"\n   Statistics:")
        print(f"      Tracks: {tracks_count}")
        print(f"      Users: {users_count}")
        print(f"      Analyzed tracks: {analysis_count}")
        print(f"      User profiles: {profiles_count}")
        
        conn.close()
        return True
        
    except Exception as e:
        print(f"   [FAIL] Database error: {e}")
        return False

def test_audio_files():
    """Проверка аудио-файлов."""
    print("\nAudio Files Check:")
    
    uploads = Path(__file__).parent / "uploads" / "tracks"
    if not uploads.exists():
        print("   [FAIL] Uploads directory not found")
        return False
    
    audio_files = list(uploads.glob("*.mp3"))
    print(f"   Found {len(audio_files)} MP3 files")
    
    if audio_files:
        sample = audio_files[0]
        size_mb = sample.stat().st_size / (1024 * 1024)
        print(f"   Sample: {sample.name} ({size_mb:.2f} MB)")
        return True
    else:
        print("   [WARN] No audio files found")
        return False

def test_config():
    """Проверка конфигурации."""
    print("\nConfiguration Check:")
    
    req_file = Path(__file__).parent / "ai-service" / "requirements.txt"
    if not req_file.exists():
        print("   [FAIL] requirements.txt not found")
        return False
    
    content = req_file.read_text()
    
    key_deps = [
        'fastapi',
        'librosa',
        'faster-whisper',
        'detoxify',
        'hnswlib',
        'implicit',
        'prometheus-client',
    ]
    
    for dep in key_deps:
        found = dep in content
        status = "[OK]" if found else "[FAIL]"
        print(f"   {status} {dep}")
    
    return True

def main():
    """Главная функция теста."""
    results = []
    
    results.append(("Structure", test_structure()))
    results.append(("Database", test_database()))
    results.append(("Audio Files", test_audio_files()))
    results.append(("Configuration", test_config()))
    
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    
    for name, passed in results:
        status = "[PASS]" if passed else "[FAIL]"
        print(f"{status}: {name}")
    
    all_passed = all(r[1] for r in results)
    
    print("\n" + "=" * 60)
    if all_passed:
        print("[SUCCESS] ALL TESTS PASSED")
        print("\nNext steps:")
        print("1. Install dependencies: cd ai-service && pip install -r requirements.txt")
        print("2. Start services: cd database && docker-compose up -d")
        print("3. Access Grafana: http://localhost:3001 (admin/admin)")
        print("4. Access Prometheus: http://localhost:9090")
    else:
        print("[FAILED] SOME TESTS FAILED")
    print("=" * 60)
    
    return 0 if all_passed else 1

if __name__ == '__main__':
    sys.exit(main())
