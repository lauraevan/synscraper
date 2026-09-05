#!/usr/bin/env python3
"""Orlando resolver backed by VidKing's current API and Peakstorm CDN.

Orlando is intentionally strict: it resolves through the VidKing source API,
decrypts the returned source payloads, and only exposes playable URLs hosted on
moon.peakstorm.top. This keeps Orlando independent from the Vidy/Miami resolver.
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
import json
import re
from urllib.parse import urlparse
from typing import Any

import requests

from providers.vidy import decode_envelope

VIDKING_ORIGIN = "https://www.vidking.net"
API_BASE = "https://api.speedracelight.com"
DB_BASE = "https://db.speedracelight.com/3"
PEAKSTORM_HOST = "moon.peakstorm.top"

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/150.0.0.0 Safari/537.36"
)

# VidKing's current English source mirrors. We query them in parallel and keep
# only Peakstorm-hosted media returned by the decrypted payloads.
SOURCE_ENDPOINTS = (
    "cdn/sources-with-title",
    "downloader2/sources-with-title",
    "m4uhd/sources-with-title",
    "vsrc/sources-with-title",
    "hdmovie/sources-with-title",
    "superflix/sources-with-title",
    "lamovie/sources-with-title",
)


def _quality_rank(value: str) -> int:
    text = str(value or "").upper()
    if "2160" in text or "4K" in text or "UHD" in text:
        return 2160
    match = re.search(r"(1440|1080|720|480|360|240|144)", text)
    return int(match.group(1)) if match else 0


class OrlandoResolver:
    def __init__(self, debug: bool = False):
        self.debug = debug
        self.session = requests.Session()

    def log(self, message: str) -> None:
        if self.debug:
            print(f"[Orlando] {message}")

    def _headers(self) -> dict[str, str]:
        return {
            "User-Agent": USER_AGENT,
            "Accept": "application/json,text/plain,*/*",
            "Accept-Language": "en-US,en;q=0.9",
            "Origin": VIDKING_ORIGIN,
            "Referer": f"{VIDKING_ORIGIN}/",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
        }

    def _get(self, url: str, *, params: dict[str, Any] | None = None, timeout: float = 7.0) -> requests.Response:
        self.log(f"GET {url}")
        response = self.session.get(
            url,
            params=params,
            headers=self._headers(),
            timeout=timeout,
        )
        response.raise_for_status()
        return response

    @staticmethod
    def _encrypted_payload(response: requests.Response) -> str:
        raw = response.text.strip()
        try:
            parsed = response.json()
        except ValueError:
            parsed = None

        if isinstance(parsed, str):
            return parsed
        if isinstance(parsed, dict):
            for key in ("data", "payload", "encrypted", "result"):
                if isinstance(parsed.get(key), str):
                    return parsed[key]
        if raw:
            return raw
        raise RuntimeError("Orlando source API returned an empty encrypted payload")

    def _metadata(self, media_id: int, media_type: str) -> dict[str, Any]:
        path = "movie" if media_type == "movie" else "tv"
        response = self._get(
            f"{DB_BASE}/{path}/{media_id}",
            params={"append_to_response": "external_ids", "language": "en-US"},
            timeout=6.0,
        )
        data = response.json()
        if not isinstance(data, dict):
            raise RuntimeError("Unexpected Orlando metadata response")

        if media_type == "movie":
            title = data.get("title") or data.get("original_title") or ""
            date = data.get("release_date") or ""
            imdb_id = data.get("imdb_id") or (data.get("external_ids") or {}).get("imdb_id") or ""
        else:
            title = data.get("name") or data.get("original_name") or ""
            date = data.get("first_air_date") or ""
            imdb_id = (data.get("external_ids") or {}).get("imdb_id") or ""

        return {
            "title": str(title),
            "year": str(date)[:4],
            "imdbId": str(imdb_id or ""),
        }

    def _seed(self, media_id: int) -> str:
        response = self._get(
            f"{API_BASE}/seed",
            params={"mediaId": int(media_id)},
            timeout=5.0,
        )
        try:
            data = response.json()
        except ValueError as exc:
            raise RuntimeError("Orlando seed endpoint returned non-JSON data") from exc
        if not isinstance(data, dict) or data.get("seed") is None:
            raise RuntimeError(f"Unexpected Orlando seed response: {data!r}")
        return str(data["seed"])

    def _payload(
        self,
        endpoint: str,
        media_id: int,
        media_type: str,
        season: int | None,
        episode: int | None,
        metadata: dict[str, Any],
        seed: str,
    ) -> dict[str, Any]:
        params = {
            "title": str(metadata.get("title") or ""),
            "mediaType": media_type,
            "year": str(metadata.get("year") or ""),
            "episodeId": str(int(episode or 1)),
            "seasonId": str(int(season or 1)),
            "tmdbId": str(int(media_id)),
            "imdbId": str(metadata.get("imdbId") or ""),
            "enc": "2",
            "seed": seed,
        }
        response = self._get(f"{API_BASE}/{endpoint}", params=params, timeout=8.0)
        encrypted = self._encrypted_payload(response)
        clear = decode_envelope(encrypted, seed, media_id)
        data = json.loads(clear)
        if not isinstance(data, dict):
            raise RuntimeError("Decoded Orlando source response is not an object")
        return data

    @staticmethod
    def _is_peakstorm(url: str) -> bool:
        try:
            return (urlparse(url).hostname or "").lower() == PEAKSTORM_HOST
        except ValueError:
            return False

    @staticmethod
    def _quality(source: dict[str, Any]) -> str:
        explicit = source.get("quality") or source.get("label")
        if explicit:
            return str(explicit)
        url = str(source.get("url") or "")
        indexed = re.search(r"index-s(\d+)p", url, re.I)
        if indexed:
            return f"{indexed.group(1)}p"
        match = re.search(r"(?:/|[-_])(2160|1440|1080|720|480|360)p?(?:/|[-_.])", url, re.I)
        return f"{match.group(1)}p" if match else "Auto"

    def _playables(self, payload: dict[str, Any]) -> list[dict[str, Any]]:
        out: list[dict[str, Any]] = []
        for source in payload.get("sources") or []:
            if not isinstance(source, dict):
                continue
            url = source.get("url")
            if not isinstance(url, str) or not url.startswith(("http://", "https://")):
                continue
            if not self._is_peakstorm(url):
                continue
            if ".m3u8" not in url.lower():
                continue

            source_headers = source.get("headers") if isinstance(source.get("headers"), dict) else {}
            out.append(
                {
                    "url": url,
                    "type": "hls",
                    "quality": self._quality(source),
                    "headers": {
                        "Referer": source_headers.get("Referer")
                        or source_headers.get("referer")
                        or f"{VIDKING_ORIGIN}/",
                        "Origin": source_headers.get("Origin")
                        or source_headers.get("origin")
                        or VIDKING_ORIGIN,
                        "User-Agent": source_headers.get("User-Agent")
                        or source_headers.get("user-agent")
                        or USER_AGENT,
                    },
                    "server": "Orlando",
                }
            )
        return out

    def resolve(
        self,
        media_id: str | int,
        media_type: str = "movie",
        season: int | None = None,
        episode: int | None = None,
        metadata_hint: dict[str, Any] | None = None,
        **_: Any,
    ) -> str:
        try:
            numeric_id = int(media_id)
        except (TypeError, ValueError):
            return json.dumps({"status": "error", "server": "Orlando", "message": "Orlando requires a numeric TMDB ID"})

        if media_type not in {"movie", "tv"}:
            return json.dumps({"status": "error", "server": "Orlando", "message": "type must be movie or tv"})
        if media_type == "tv" and (season is None or episode is None):
            return json.dumps({"status": "error", "server": "Orlando", "message": "TV requires season and episode"})

        try:
            hint = metadata_hint if isinstance(metadata_hint, dict) else {}
            title = str(hint.get("title") or "").strip()
            if title:
                metadata = {
                    "title": title,
                    "year": str(hint.get("year") or ""),
                    "imdbId": str(hint.get("imdbId") or hint.get("imdb_id") or ""),
                }
            else:
                metadata = self._metadata(numeric_id, media_type)

            seed = self._seed(numeric_id)
            payloads: list[dict[str, Any]] = []
            errors: dict[str, str] = {}

            with ThreadPoolExecutor(max_workers=len(SOURCE_ENDPOINTS)) as pool:
                futures = {
                    pool.submit(
                        self._payload,
                        endpoint,
                        numeric_id,
                        media_type,
                        season,
                        episode,
                        metadata,
                        seed,
                    ): endpoint
                    for endpoint in SOURCE_ENDPOINTS
                }
                for future in as_completed(futures):
                    endpoint = futures[future]
                    try:
                        payloads.append(future.result())
                    except Exception as exc:
                        errors[endpoint] = str(exc)
                        self.log(f"{endpoint}: {exc}")

            playable: list[dict[str, Any]] = []
            subtitles: list[dict[str, Any]] = []
            for payload in payloads:
                playable.extend(self._playables(payload))
                tracks = payload.get("subtitles")
                if isinstance(tracks, list):
                    subtitles.extend(track for track in tracks if isinstance(track, dict))

            unique: list[dict[str, Any]] = []
            seen_urls: set[str] = set()
            for source in sorted(playable, key=lambda item: -_quality_rank(str(item.get("quality") or ""))):
                if source["url"] in seen_urls:
                    continue
                seen_urls.add(source["url"])
                unique.append(source)

            if not unique:
                detail = "No moon.peakstorm.top HLS sources were returned by VidKing."
                if self.debug and errors:
                    detail += " " + json.dumps(errors)
                return json.dumps(
                    {
                        "status": "notfound",
                        "server": "Orlando",
                        "message": detail,
                    },
                    indent=2,
                )

            return json.dumps(
                {
                    "status": "success",
                    "id": str(numeric_id),
                    "type": media_type,
                    "season": season,
                    "episode": episode,
                    "playable_urls": unique,
                    "subtitles": subtitles,
                },
                indent=2,
            )
        except Exception as exc:
            return json.dumps(
                {
                    "status": "error",
                    "server": "Orlando",
                    "message": str(exc),
                },
                indent=2,
            )
