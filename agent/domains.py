"""Domain helpers: one normalized domain per company, and safe comparisons with story URLs."""

from __future__ import annotations

from urllib.parse import urlsplit

# Hosts many unrelated projects share. A story on one of these never proves a company match
# by URL alone (the title rule still can).
SHARED_HOSTS = frozenset(
    {
        "github.com",
        "gitlab.com",
        "medium.com",
        "substack.com",
        "youtube.com",
        "youtu.be",
        "twitter.com",
        "x.com",
        "notion.site",
        "vercel.app",
        "netlify.app",
        "herokuapp.com",
        "apps.apple.com",
        "play.google.com",
        "producthunt.com",
        "ycombinator.com",
    }
)


def normalize_domain(website: str | None) -> str | None:
    """'https://www.Trigger.dev/pricing' -> 'trigger.dev'. None if there's no usable host."""
    if not website or not website.strip():
        return None
    text = website.strip()
    if "://" not in text:
        text = f"https://{text}"
    host = (urlsplit(text).hostname or "").lower().rstrip(".")
    if host.startswith("www."):
        host = host[4:]
    return host if "." in host else None


def url_matches_domain(url: str | None, company_domain: str) -> bool:
    """True when the URL is on the company's domain or one of its subdomains."""
    host = normalize_domain(url)
    if host is None or company_domain in SHARED_HOSTS:
        return False
    if any(host == shared or host.endswith(f".{shared}") for shared in SHARED_HOSTS):
        return False
    return host == company_domain or host.endswith(f".{company_domain}")
