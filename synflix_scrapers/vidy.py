#!/usr/bin/env python3
"""
Vidy Resolver for SynScraper.

Supports:
  Movie: /movie/{tmdb_id}
  TV:    /tv/{tmdb_id}/{season}/{episode}
  Anime: /anime/{anilist_id}/{episode}

Extracts direct HLS/DASH sources from Vidy's publicly returned player data.
Does not attempt to bypass DRM.
"""

import argparse
import base64
import html
import json
import re
import ssl
import urllib.error
import urllib.request
from urllib.parse import urljoin, urlparse

__version__ = "0.1.0"

BASE_URL = "https://vidy.st"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/150.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/json,*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": BASE_URL + "/",
    "Origin": BASE_URL,
}


class VidyResolver:
    def __init__(self, debug=False):
        self.debug = debug
        self.ssl_context = ssl.create_default_context()

    def log(self, message):
        if self.debug:
            print(f"[Vidy] {message}")

    def _request(self, url, headers=None):
        request_headers = HEADERS.copy()
        if headers:
            request_headers.update(headers)

        req = urllib.request.Request(url, headers=request_headers, method="GET")

        try:
            with urllib.request.urlopen(req, timeout=20, context=self.ssl_context) as response:
                return {
                    "ok": True,
                    "url": response.geturl(),
                    "status": response.status,
                    "content_type": response.headers.get("Content-Type", ""),
                    "text": response.read().decode("utf-8", errors="ignore"),
                }
        except urllib.error.HTTPError as exc:
            return {"ok": False, "error": f"HTTP {exc.code}: {exc.reason}"}
        except urllib.error.URLError as exc:
            return {"ok": False, "error": f"URL error: {exc.reason}"}
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    def _decode_js_string(self, value):
        if not isinstance(value, str):
            return value

        value = html.unescape(value)
        replacements = {
            r"\/": "/",
            r"\u002F": "/",
            r"\u002f": "/",
            r"\u003A": ":",
            r"\u003a": ":",
            r"\u0026": "&",
            r"\u003D": "=",
            r"\u003d": "=",
            r"\x2F": "/",
            r"\x2f": "/",
            r"\x3A": ":",
            r"\x3a": ":",
        }
        for old, new in replacements.items():
            value = value.replace(old, new)
        return value.strip()

    def _maybe_base64_decode(self, value):
        if not isinstance(value, str):
            return None

        candidate = value.strip()
        if len(candidate) < 20 or candidate.startswith(("http://", "https://")):
            return None
        if not re.fullmatch(r"[A-Za-z0-9+/_=-]+", candidate):
            return None

        try:
            padded = candidate + "=" * (-len(candidate) % 4)
            raw = base64.b64decode(padded, validate=False)
            decoded = raw.decode("utf-8", errors="ignore")
            if (
                "http" in decoded
                or "m3u8" in decoded
                or ".mpd" in decoded
                or decoded.lstrip().startswith(("{", "["))
            ):
                return decoded
        except Exception:
            pass
        return None

    def _walk_json(self, obj, results):
        if isinstance(obj, dict):
            for value in obj.values():
                if isinstance(value, str):
                    value = self._decode_js_string(value)
                    if self._looks_like_stream(value):
                        results.add(value)
                    decoded = self._maybe_base64_decode(value)
                    if decoded:
                        self._extract_from_text(decoded, results)
                else:
                    self._walk_json(value, results)
        elif isinstance(obj, list):
            for item in obj:
                self._walk_json(item, results)
        elif isinstance(obj, str):
            value = self._decode_js_string(obj)
            if self._looks_like_stream(value):
                results.add(value)

    def _looks_like_stream(self, value):
        value_lower = value.lower()
        return value.startswith(("http://", "https://")) and (
            ".m3u8" in value_lower
            or ".mpd" in value_lower
            or "manifest.m3u8" in value_lower
            or "master.m3u8" in value_lower
        )

    def _extract_from_text(self, text, results):
        if not text:
            return

        text = self._decode_js_string(text)
        patterns = [
            r'https?://[^"\'\s<>\\]+?\.m3u8(?:\?[^"\'\s<>\\]*)?',
            r'https?://[^"\'\s<>\\]+?\.mpd(?:\?[^"\'\s<>\\]*)?',
        ]
        for pattern in patterns:
            for match in re.findall(pattern, text, flags=re.I):
                results.add(self._decode_js_string(match))

        fields = ["file", "src", "source", "url", "playlist", "manifest", "stream"]
        for field in fields:
            pattern = rf'["\']?{field}["\']?\s*[:=]\s*["\']([^"\']+)["\']'
            for match in re.findall(pattern, text, flags=re.I):
                match = self._decode_js_string(match)
                if self._looks_like_stream(match):
                    results.add(match)
                decoded = self._maybe_base64_decode(match)
                if decoded:
                    self._extract_from_text(decoded, results)

        json_candidates = re.findall(r'({[^{}]{20,10000}})', text, flags=re.S)
        for candidate in json_candidates:
            try:
                self._walk_json(json.loads(candidate), results)
            except Exception:
                continue

    def _extract_next_data(self, html_text, results):
        match = re.search(
            r'<script[^>]+id=["\']__NEXT_DATA__["\'][^>]*>(.*?)</script>',
            html_text,
            flags=re.I | re.S,
        )
        if not match:
            return

        try:
            self._walk_json(json.loads(html.unescape(match.group(1))), results)
        except Exception as exc:
            self.log(f"Unable to parse __NEXT_DATA__: {exc}")

    def _extract_scripts(self, page_url, html_text):
        scripts = []
        for match in re.findall(
            r'<script[^>]+src=["\']([^"\']+)["\']', html_text, flags=re.I
        ):
            scripts.append(urljoin(page_url, html.unescape(match)))
        return list(dict.fromkeys(scripts))

    def _allowed_script(self, script_url):
        return urlparse(script_url).scheme in ("http", "https")

    def _scan_scripts(self, page_url, html_text, results):
        scripts = self._extract_scripts(page_url, html_text)
        self.log(f"Found {len(scripts)} JS assets")

        for script_url in scripts[:30]:
            if not self._allowed_script(script_url):
                continue
            self.log(f"Inspecting JS: {script_url}")
            response = self._request(
                script_url,
                {"Referer": page_url, "Accept": "*/*"},
            )
            if response["ok"]:
                self._extract_from_text(response["text"], results)

    def _extract_sources(self, page_url, response):
        results = set()
        text = response["text"]
        content_type = response.get("content_type", "").lower()

        if "mpegurl" in content_type or "dash+xml" in content_type:
            results.add(page_url)
            return results

        if "application/json" in content_type or text.lstrip().startswith(("{", "[")):
            try:
                self._walk_json(json.loads(text), results)
            except Exception:
                pass

        self._extract_from_text(text, results)
        self._extract_next_data(text, results)

        if "<script" in text.lower():
            self._scan_scripts(page_url, text, results)

        return results

    def _get_quality(self, stream_url):
        match = re.search(r"(2160|1440|1080|720|480|360)p?", stream_url, flags=re.I)
        return f"{match.group(1)}p" if match else "Auto"

    def _verify_stream(self, url, referer):
        result = self._request(
            url,
            {"Referer": referer, "Origin": BASE_URL, "Accept": "*/*"},
        )
        return result["ok"]

    def resolve(
        self,
        media_id,
        media_type="movie",
        season=None,
        episode=None,
        verify=False,
    ):
        media_id = str(media_id)

        if media_type == "movie":
            path = f"/movie/{media_id}"
        elif media_type == "tv":
            if season is None or episode is None:
                return json.dumps(
                    {"status": "error", "message": "TV requires season and episode"},
                    indent=2,
                )
            path = f"/tv/{media_id}/{int(season)}/{int(episode)}"
        elif media_type == "anime":
            if episode is None:
                return json.dumps(
                    {"status": "error", "message": "Anime requires episode"},
                    indent=2,
                )
            path = f"/anime/{media_id}/{int(episode)}"
        else:
            return json.dumps(
                {"status": "error", "message": "type must be movie, tv, or anime"},
                indent=2,
            )

        page_url = urljoin(BASE_URL, path)
        self.log(f"Fetching Vidy: {page_url}")
        response = self._request(page_url)

        if not response["ok"]:
            return json.dumps(
                {
                    "status": "error",
                    "server": "Vidy",
                    "message": response["error"],
                    "page": page_url,
                },
                indent=2,
            )

        streams = self._extract_sources(page_url, response)
        if not streams:
            return json.dumps(
                {
                    "status": "notfound",
                    "server": "Vidy",
                    "message": "No direct HLS/DASH source was found in the current Vidy response.",
                    "page": page_url,
                },
                indent=2,
            )

        playable_urls = []
        for stream in sorted(streams):
            if verify and not self._verify_stream(stream, page_url):
                continue
            playable_urls.append(
                {
                    "url": stream,
                    "type": "dash" if ".mpd" in stream.lower() else "hls",
                    "quality": self._get_quality(stream),
                    "headers": {
                        "Referer": page_url,
                        "Origin": BASE_URL,
                        "User-Agent": HEADERS["User-Agent"],
                    },
                    "server": "Vidy",
                }
            )

        if not playable_urls:
            return json.dumps(
                {
                    "status": "notfound",
                    "server": "Vidy",
                    "message": "Sources were detected but none passed verification.",
                },
                indent=2,
            )

        return json.dumps(
            {
                "status": "success",
                "id": media_id,
                "type": media_type,
                "season": season,
                "episode": episode,
                "page": page_url,
                "playable_urls": playable_urls,
            },
            indent=2,
        )


def main():
    parser = argparse.ArgumentParser(description="Vidy direct stream resolver")
    parser.add_argument("id", help="TMDB ID or AniList ID")
    parser.add_argument("--type", choices=["movie", "tv", "anime"], default="movie")
    parser.add_argument("--season", type=int)
    parser.add_argument("--episode", type=int)
    parser.add_argument("--verify", action="store_true")
    parser.add_argument("--debug", action="store_true")
    parser.add_argument("--pretty", action="store_true")
    args = parser.parse_args()

    resolver = VidyResolver(debug=args.debug)
    result = resolver.resolve(
        args.id,
        media_type=args.type,
        season=args.season,
        episode=args.episode,
        verify=args.verify,
    )

    if args.pretty:
        try:
            print(json.dumps(json.loads(result), indent=2))
        except Exception:
            print(result)
    else:
        print(result)


if __name__ == "__main__":
    main()
