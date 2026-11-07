"""VidFast public-page media extractor.

Thanks to Byte for granting permission to develop this integration.

This resolver inspects publicly returned HTML for directly declared HLS/MP4
sources. It does not decrypt player bundles, bypass access controls, or treat
an iframe URL as a direct playable media stream.
"""
import html
import json
import os
import re
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse

import requests

DEFAULT_ORIGIN = "https://vidfast.vc"
USER_AGENT = "Mozilla/5.0 (compatible; SynScraper/1.0)"
MEDIA_EXTENSIONS = (".m3u8", ".mp4", ".mpd")


class _MediaParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.sources = []

    def handle_starttag(self, tag, attrs):
        if tag not in ("video", "source"):
            return
        values = dict(attrs)
        if values.get("src"):
            self.sources.append(values["src"])


class VidFastResolver:
    def __init__(self, debug=False, session=None, origin=None):
        self.debug = debug
        self.session = session or requests.Session()
        self.origin = (origin or os.getenv("VIDFAST_ORIGIN") or DEFAULT_ORIGIN).rstrip("/")

    def resolve(self, url_or_id, media_type="movie", season=None, episode=None):
        tmdb_id = str(url_or_id).strip()
        if not re.fullmatch(r"[0-9]+", tmdb_id):
            return json.dumps({"status": "error", "message": "Invalid numeric TMDB ID"})
        if media_type not in ("movie", "tv"):
            return json.dumps({"status": "error", "message": "Invalid media type"})
        if media_type == "tv":
            try:
                season, episode = int(season), int(episode)
                if season < 1 or episode < 1:
                    raise ValueError()
            except (ValueError, TypeError):
                return json.dumps({"status": "error", "message": "Valid season and episode required"})
            path = f"/tv/{tmdb_id}/{season}/{episode}"
        else:
            path = f"/movie/{tmdb_id}"

        page_url = self.origin + path
        headers = {
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml",
            "Referer": self.origin + "/",
        }
        try:
            response = self.session.get(page_url, headers=headers, timeout=7)
            response.raise_for_status()
            if len(response.content) > 2_000_000:
                raise ValueError("Page too large")
            content = response.text
        except (requests.RequestException, ValueError) as exc:
            return json.dumps({"status": "error", "message": f"VidFast page unavailable: {type(exc).__name__}"})

        parser = _MediaParser()
        parser.feed(content)
        candidates = list(parser.sources)
        # Some public players declare static sources in configuration fields.
        for match in re.finditer(r'["\'](?:file|src|source|contentUrl)["\']\s*:\s*["\']([^"\']+)["\']', content):
            candidates.append(match.group(1))

        playable = []
        seen = set()
        allowed_host = urlparse(self.origin).hostname
        for candidate in candidates:
            candidate = html.unescape(candidate).replace("\\/", "/").strip()
            url = urljoin(page_url, candidate)
            parsed = urlparse(url)
            if parsed.scheme not in ("http", "https") or not parsed.hostname:
                continue
            # Only accept unambiguous media URLs, not embeds or thumbnails.
            media_path = parsed.path.lower()
            media_type_out = next((kind for ext, kind in
                ((".m3u8", "hls"), (".mp4", "mp4"), (".mpd", "dash"))
                if media_path.endswith(ext)), None)
            if not media_type_out or url in seen:
                continue
            seen.add(url)
            playable.append({
                "server": "VidFast",
                "url": url,
                "type": media_type_out,
                "quality": "Auto",
                "headers": {
                    "Referer": page_url,
                    "Origin": self.origin,
                    "User-Agent": USER_AGENT,
                },
            })
        if not playable:
            return json.dumps({
                "status": "error",
                "message": "No publicly declared direct media sources; VidFast may require its embedded player",
                "embed_url": page_url,
            })
        return json.dumps({"status": "success", "tmdb_id": tmdb_id, "playable_urls": playable})


if __name__ == "__main__":
    import argparse
    cli = argparse.ArgumentParser()
    cli.add_argument("id")
    cli.add_argument("--type", choices=["movie", "tv"], default="movie")
    cli.add_argument("--season", type=int)
    cli.add_argument("--episode", type=int)
    args = cli.parse_args()
    print(VidFastResolver().resolve(args.id, args.type, args.season, args.episode))
