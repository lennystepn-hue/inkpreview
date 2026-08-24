"""Arq Redis pool (prod job mode only)."""

from arq import create_pool
from arq.connections import ArqRedis, RedisSettings

from app.config import Settings

_pool: ArqRedis | None = None


async def get_arq_pool(settings: Settings) -> ArqRedis:
    global _pool
    if _pool is None:
        _pool = await create_pool(RedisSettings.from_dsn(settings.redis_url))
    return _pool
