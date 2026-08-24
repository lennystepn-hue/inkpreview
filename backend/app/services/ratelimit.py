"""In-memory sliding-window rate limiter.

Good enough for a single-instance deploy. For multi-instance prod, swap the
store for Redis (the interface stays the same).
"""

import time
from collections import defaultdict, deque

from app.config import get_settings


class InMemoryRateLimiter:
    def __init__(self, limit: int, window_s: int) -> None:
        self.limit = limit
        self.window_s = window_s
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def allow(self, key: str) -> bool:
        now = time.monotonic()
        dq = self._hits[key]
        while dq and dq[0] <= now - self.window_s:
            dq.popleft()
        if len(dq) >= self.limit:
            return False
        dq.append(now)
        return True

    def clear(self) -> None:
        self._hits.clear()


_settings = get_settings()
# Shared limiter for image-job creation (designs + previews), keyed by user id.
generation_limiter = InMemoryRateLimiter(_settings.anon_rate_limit, _settings.rate_limit_window_s)
