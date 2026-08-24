from app.config import Settings


def test_defaults_are_zero_infra():
    """Local dev must boot with no Docker: sqlite + inline jobs + fs storage + mock engine."""
    s = Settings(_env_file=None)
    assert s.image_engine == "mock"
    assert s.job_mode == "inline"
    assert s.storage_backend == "fs"
    assert s.database_url.startswith("sqlite")
    assert s.openai_api_key is None


def test_reads_env(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://u:p@h/db")
    monkeypatch.setenv("IMAGE_ENGINE", "openai")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    monkeypatch.setenv("JOB_MODE", "arq")
    s = Settings(_env_file=None)
    assert s.database_url.startswith("postgresql+asyncpg")
    assert s.image_engine == "openai"
    assert s.openai_api_key == "sk-test"
    assert s.job_mode == "arq"


def test_cors_list_splits():
    s = Settings(_env_file=None, cors_origins="http://a.com, http://b.com")
    assert s.cors_origins_list == ["http://a.com", "http://b.com"]
