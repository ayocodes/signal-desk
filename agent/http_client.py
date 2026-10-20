"""PoliteClient: the only way the agent talks to the internet (AGENTS.md hard rule 4).

- Checks robots.txt for every host before fetching from it (RFC 9309 rules).
- Sends the descriptive AGENT_USER_AGENT on every request.
- At most one request per second per host.
- A timeout on every request.
- Retries 429 and 5xx a few times with backoff, honoring Retry-After (capped).
"""

from __future__ import annotations

import time
from collections.abc import Callable, Mapping
from urllib.parse import urlsplit
from urllib.robotparser import RobotFileParser

import httpx

RETRY_STATUSES = {429, 500, 502, 503, 504}
MAX_RETRY_AFTER_SECONDS = 30.0


class DisallowedByRobots(Exception):
    """robots.txt for this host disallows the URL for our user agent."""


class PoliteClient:
    def __init__(
        self,
        user_agent: str,
        *,
        timeout_seconds: float = 20.0,
        min_interval_seconds: float = 1.0,
        max_retries: int = 2,
        transport: httpx.BaseTransport | None = None,
        clock: Callable[[], float] = time.monotonic,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self._user_agent = user_agent
        self._min_interval = min_interval_seconds
        self._max_retries = max_retries
        self._clock = clock
        self._sleep = sleep
        self._last_request_at: dict[str, float] = {}
        self._robots: dict[str, RobotFileParser] = {}
        self._client = httpx.Client(
            headers={"User-Agent": user_agent},
            timeout=timeout_seconds,
            follow_redirects=True,
            transport=transport,
        )
        self.request_count = 0

    def __enter__(self) -> PoliteClient:
        return self

    def __exit__(self, *_: object) -> None:
        self.close()

    def close(self) -> None:
        self._client.close()

    def get(self, url: str, params: Mapping[str, str | int] | None = None) -> httpx.Response:
        """GET with robots.txt, rate limit and retries. Raises DisallowedByRobots or httpx errors."""
        if not self._allowed(url):
            raise DisallowedByRobots(url)

        attempt = 0
        while True:
            response = self._send(url, params)
            if response.status_code not in RETRY_STATUSES or attempt >= self._max_retries:
                return response
            attempt += 1
            self._sleep(self._retry_delay(response, attempt))

    def _send(self, url: str, params: Mapping[str, str | int] | None = None) -> httpx.Response:
        host = urlsplit(url).netloc
        last = self._last_request_at.get(host)
        if last is not None:
            wait = self._min_interval - (self._clock() - last)
            if wait > 0:
                self._sleep(wait)
        try:
            return self._client.get(url, params=params)
        finally:
            self._last_request_at[host] = self._clock()
            self.request_count += 1

    def _retry_delay(self, response: httpx.Response, attempt: int) -> float:
        retry_after = response.headers.get("Retry-After", "")
        if retry_after.isdigit():
            return min(float(retry_after), MAX_RETRY_AFTER_SECONDS)
        return min(2.0**attempt, MAX_RETRY_AFTER_SECONDS)

    def _allowed(self, url: str) -> bool:
        parts = urlsplit(url)
        host = parts.netloc
        if host not in self._robots:
            self._robots[host] = self._fetch_robots(f"{parts.scheme}://{host}/robots.txt")
        return self._robots[host].can_fetch(self._user_agent, url)

    def _fetch_robots(self, robots_url: str) -> RobotFileParser:
        parser = RobotFileParser(robots_url)
        try:
            response = self._send(robots_url)
        except httpx.HTTPError:
            # RFC 9309: if robots.txt is unreachable, assume everything is disallowed.
            parser.disallow_all = True
            return parser

        if response.status_code >= 500:
            parser.disallow_all = True
        elif response.status_code >= 400:
            # RFC 9309: a 4xx (including 401/403) means "no rules": everything is allowed.
            # (Python's RobotFileParser.read() treats 401/403 as disallow-all; we don't use it.)
            parser.allow_all = True
        else:
            parser.parse(response.text.splitlines())
        return parser
