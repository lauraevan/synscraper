#!/usr/bin/env python3
"""VidZee resolver for the current plaintext stream API."""

import json
import re
import ssl
import urllib.error
import urllib.request
from urllib.parse import urlencode

__version__ = "2.0.0"

API_BASE = "https://core.vidzee.wtf"
PLAYER_REFERER = "https://player.vidzee.wtf/"
PLAYER_ORIGIN = "https://player.vidzee.wtf"
DEFAULT_SERVERS = ("dcloud", "tik", "ipcloud", "v6:Hindi")

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": PLAYER_REFERER,
    "Origin": PLAYER_ORIGIN,
}


class VidzeeResolver:
    def __init__(self, debug=False):
        self.debug = debug
        self.ssl_context = ssl.create_default_context()

    def log(self, message, level="INFO"):
        if self.debug or level == "ERROR":
            print(f"[{level}] {message}")

    def _fetch_json(self, url, timeout=15):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=timeout, context=self.ssl_context) as response:
                body = response.read().decode("utf-8", errors="ignore")
                return True, json.loads(body), None, getattr(response, "status", 200)
        except urllib.error.HTTPError as exc:
            return False, None, f"HTTP Error {exc.code}: {exc.reason}", exc.code
        except urllib.error.URLError as exc:
            return False, None, f"URL Error: {exc}", None
        except json.JSONDecodeError as exc:
            return False, None, f"Invalid JSON: {exc}", None
        except Exception as exc:
            return False, None, f"Error: {exc}", None

    def _build_stream_url(self, tmdb_id, media_type, season, episode, server):
        if media_type == "tv":
            if season is None or episode is None:
                raise ValueError("TV resolution requires season and episode")
            path = f"/streams/tv/{tmdb_id}/{int(season)}/{int(episode)}"
        else:
            path = f"/streams/movie/{tmdb_id}"
        query = urlencode({"s": server, "e": 0})
        return f"{API_BASE}{path}?{query}"

    @staticmethod
    def _stream_type(url):
        lower = url.lower().split("?", 1)[0]
        if ".mp4" in lower:
            return "mp4"
        return "hls"

    def _fetch_server_stream(self, tmdb_id, media_type, season, episode, server):
        url = self._build_stream_url(tmdb_id, media_type, season, episode, server)
        success, data, error, status = self._fetch_json(url)
        if not success:
            self.log(f"{server} failed ({status}): {error}", "WARNING")
            return None
        if not isinstance(data, dict):
            return None

        stream_url = str(data.get("url") or "").strip()
        if not stream_url.startswith(("http://", "https://")):
            return None

        api_headers = data.get("headers") if isinstance(data.get("headers"), dict) else {}
        headers = dict(api_headers)
        headers.setdefault("Referer", PLAYER_REFERER)
        headers.setdefault("Origin", PLAYER_ORIGIN)
        headers.setdefault("User-Agent", HEADERS["User-Agent"])

        language = data.get("language") or data.get("lang") or "unknown"
        return {
            "server": server,
            "url": stream_url,
            "quality": data.get("quality") or "Auto",
            "type": data.get("type") or self._stream_type(stream_url),
            "headers": headers,
            "lang": language,
        }

    def resolve(self, url_or_id, media_type="movie", season=None, episode=None):
        if str(url_or_id).startswith("http"):
            match = re.search(r"/(?:movie|tv)/(\d+)", str(url_or_id))
            if not match:
                return json.dumps({"status": "error", "message": "Could not extract TMDB ID from URL"})
            tmdb_id = match.group(1)
            if "/tv/" in str(url_or_id):
                media_type = "tv"
                se_match = re.search(r"/tv/\d+/(\d+)/(\d+)", str(url_or_id))
                if se_match:
                    season = int(se_match.group(1))
                    episode = int(se_match.group(2))
        else:
            tmdb_id = str(url_or_id)

        if not tmdb_id.isdigit():
            return json.dumps({"status": "error", "message": "TMDB ID must be numeric"})
        if media_type == "tv" and (season is None or episode is None):
            return json.dumps({"status": "error", "message": "TV resolution requires season and episode"})

        playable_urls = []
        for server in DEFAULT_SERVERS:
            stream = self._fetch_server_stream(tmdb_id, media_type, season, episode, server)
            if stream:
                playable_urls.append(stream)

        if not playable_urls:
            return json.dumps({"status": "error", "message": "No playable VidZee sources found"})

        return json.dumps(
            {"status": "success", "tmdb_id": tmdb_id, "playable_urls": playable_urls},
            indent=2,
        )


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="VidZee resolver")
    parser.add_argument("url_or_id")
    parser.add_argument("--type", choices=["movie", "tv"], default="movie")
    parser.add_argument("--season", type=int)
    parser.add_argument("--episode", type=int)
    parser.add_argument("--debug", action="store_true")
    args = parser.parse_args()

    print(
        VidzeeResolver(debug=args.debug).resolve(
            args.url_or_id,
            media_type=args.type,
            season=args.season,
            episode=args.episode,
        )
    )
