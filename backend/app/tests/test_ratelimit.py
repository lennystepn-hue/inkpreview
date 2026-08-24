from app.services.ratelimit import InMemoryRateLimiter


def test_limiter_blocks_past_limit():
    rl = InMemoryRateLimiter(limit=2, window_s=60)
    assert rl.allow("u")
    assert rl.allow("u")
    assert not rl.allow("u")  # third blocked


def test_limiter_keys_are_independent():
    rl = InMemoryRateLimiter(limit=1, window_s=60)
    assert rl.allow("a")
    assert not rl.allow("a")
    assert rl.allow("b")  # different key has its own budget
