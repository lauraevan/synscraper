#!/usr/bin/env python3
"""Current VidCore.org resolver for SynScraper.

Uses VidCore's public primary source API exposed by the current embed player and
returns its HLS renditions in SynScraper's normal resolver shape. This resolver
does not implement DRM handling.
"""

from __future__ import annotations

import json
import os
from typing import Any

import requests

__version__ = "0.2.0"

BASE_URL = os.environ.get("VIDCORE_ORIGIN", "https://vidcore.org").rstrip("/")
PRIMARY_API = os.environ.get(
    "VIDCORE_PRIMARY_API",
    "https://vidrack.created.app/api/sources/cineplay",
).strip()
USER_AGENT = os.environ.get(
    "SCRAPER_USER_AGENT",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
)


class VidCoreResolver:
    def __init__(self, debug: bool = False, timeout: float = 7.0):
        self.debug = debug
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": USER_AGENT,
            "Accept": "application/json,text/plain,*/*",
            "Accept-Language": "en-US,en;q=0.9",
        })

    def log(self, message: str) -> None:
        if self.debug:
            print(f"[VidCore] {message}")

    @staticmethod
    def _quality(item: dict[str, Any]) -> str:
        value = str(item.get("quality") or item.get("label") or "Auto")
        lower = value.lower()
        for height in (2160, 1440, 1080, 720, 480, 360, 240, 144):
            if str(height) in lower:
                return f"{height}p"
        if "4k" in lower:
            return "2160p"
        return "Auto"

    @staticmethod
    def _stream_type(item: dict[str, Any], url: str) -> str:
        kind = str(item.get("type") or "").lower()
        lower = url.lower()
        if kind in {"hls", "m3u8"} or ".m3u8" in lower:
            return "hls"
        if kind in {"mp4", "video"} or ".mp4" in lower:
            return "mp4"
        return "hls"

    @staticmethod
    def _embed_path(media_id: str, media_type: str, season=None, episode=None) -> str:
        if media_type == "tv":
            if season is None or episode is None:
                raise ValueError("TV requires season and episode")
            return f"/embed/tv/{media_id}/{int(season)}/{int(episode)}"
        return f"/embed/movie/{media_id}"

    def resolve(
        self,
        media_id: str | int,
        media_type: str = "movie",
        season: int | None = None,
        episode: int | None = None,
    ) -> str:
        if media_type not in {"movie", "tv"}:
            return json.dumps({
                "status": "error",
                "server": "VidCore",
                "message": "type must be movie or tv",
            })

        try:
            tmdb_id = str(int(media_id))
            embed_path = self._embed_path(tmdb_id, media_type, season, episode)
            referer = f"{BASE_URL}{embed_path}"

            params: dict[str, Any] = {"id": tmdb_id, "type": media_type}
            if media_type == "tv":
                params.update({"season": int(season), "episode": int(episode)})

            response = self.session.get(
                PRIMARY_API,
                params=params,
                headers={
                    "User-Agent": USER_AGENT,
                    "Accept": "application/json,text/plain,*/*",
                    "Referer": referer,
                    "Origin": BASE_URL,
                },
                timeout=self.timeout,
            )
            response.raise_for_status()
            data = response.json()
            sources = data.get("sources") if isinstance(data, dict) else None
            if not isinstance(sources, list):
                return json.dumps({
                    "status": "notfound",
                    "server": "VidCore",
                    "message": "VidCore returned no source list",
                })

            playable: list[dict[str, Any]] = []
            seen: set[str] = set()
            for item in sources:
                if not isinstance(item, dict):
                    continue
                url = str(item.get("url") or "").strip()
                if not url.startswith(("http://", "https://")) or url in seen:
                    continue
                seen.add(url)
                playable.append({
                    "url": url,
                    "type": self._stream_type(item, url),
                    "quality": self._quality(item),
                    "label": item.get("label") or "VidCore",
                    "server": "VidCore",
                    "headers": {
                        "Referer": referer,
                        "Origin": BASE_URL,
                        "User-Agent": USER_AGENT,
                    },
                })

            if not playable:
                return json.dumps({
                    "status": "notfound",
                    "server": "VidCore",
                    "message": "No playable VidCore streams were returned",
                })

            def rank(item: dict[str, Any]) -> int:
                quality = str(item.get("quality") or "")
                for value in (2160, 1440, 1080, 720, 480, 360, 240, 144):
                    if str(value) in quality:
                        return value
                return 0

            playable.sort(key=rank, reverse=True)
            return json.dumps({
                "status": "success",
                "server": "VidCore",
                "id": tmdb_id,
                "type": media_type,
                "season": season,
                "episode": episode,
                "page": referer,
                "playable_urls": playable,
                "subtitles": [],
            })
        except Exception as exc:
            self.log(str(exc))
            return json.dumps({
                "status": "error",
                "server": "VidCore",
                "message": str(exc),
            })
