import httpx
import pytest

from agent.http_client import DisallowedByRobots, PoliteClient


class FakeTime:
    """A clock that only moves when the client sleeps, so spacing is measurable."""

    def __init__(self) -> None:
        self.now = 0.0
        self.sleeps: list[float] = []

    def clock(self) -> float:
        return self.now

    def sleep(self, seconds: float) -> None:
        self.sleeps.append(seconds)
        self.now += seconds


def client_for(handler, fake: FakeTime) -> PoliteClient:  # type: ignore[no-untyped-def]
    return PoliteClient(
        "SignalDesk-test/0.1",
        transport=httpx.MockTransport(handler),
        clock=fake.clock,
        sleep=fake.sleep,
    )


def test_sends_the_user_agent_and_respects_robots_disallow() -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        if request.url.path == "/robots.txt":
            return httpx.Response(200, text="User-agent: *\nDisallow: /private/\n")
        return httpx.Response(200, json={"ok": True})

    with client_for(handler, FakeTime()) as client:
        assert client.get("https://example.com/public/jobs").status_code == 200
        with pytest.raises(DisallowedByRobots):
            client.get("https://example.com/private/data")

    assert all(r.headers["User-Agent"] == "SignalDesk-test/0.1" for r in seen)
    assert [r.url.path for r in seen].count("/robots.txt") == 1  # cached per host


def test_a_4xx_robots_file_allows_everything_and_5xx_blocks_everything() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/robots.txt":
            return httpx.Response(401 if request.url.host == "open.example" else 503)
        return httpx.Response(200)

    with client_for(handler, FakeTime()) as client:
        assert client.get("https://open.example/jobs").status_code == 200
        with pytest.raises(DisallowedByRobots):
            client.get("https://down.example/jobs")


def test_waits_one_second_between_requests_to_the_same_host() -> None:
    fake = FakeTime()

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(404 if request.url.path == "/robots.txt" else 200)

    with client_for(handler, fake) as client:
        client.get("https://a.example/1")  # robots.txt, then /1 (spaced)
        client.get("https://a.example/2")  # spaced again
        client.get("https://b.example/1")  # different host: robots.txt needs no wait

    assert fake.sleeps == [1.0, 1.0, 1.0]


def test_retries_429_with_retry_after_then_returns_the_last_response() -> None:
    fake = FakeTime()
    calls = {"jobs": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/robots.txt":
            return httpx.Response(404)
        calls["jobs"] += 1
        if calls["jobs"] < 3:
            return httpx.Response(429, headers={"Retry-After": "5"})
        return httpx.Response(200)

    with client_for(handler, fake) as client:
        assert client.get("https://api.example/jobs").status_code == 200

    assert calls["jobs"] == 3
    assert 5.0 in fake.sleeps
