#!/usr/bin/env python3
"""Vidy direct source resolver used by SynScraper.

The current Vidy frontend fetches media metadata from db.wecollege.net and
provider sources from api.wecollege.net. Provider responses are returned in
Vidy's enc=2 envelope, which is decoded here using the same seed/media-id
algorithm used by the public player.
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
import argparse
import base64
import json
import re
import ssl
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

__version__ = "0.3.0"

BASE_URL = "https://www.vidy.st"
DB_BASE = "https://db.wecollege.net/3"
API_BASE = "https://api.wecollege.net"

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/150.0.0.0 Safari/537.36"
)

DEFAULT_PROVIDERS = (
    "miami",
    "atlanta",
    "seattle",
    "denver",
    "phoenix",
    "portland",
    "dallas",
)
ALL_PROVIDERS = DEFAULT_PROVIDERS + (
    "austin",
    "munich",
    "berlin",
    "paris",
    "delhi",
    "cancun",
)

MAGIC = b"mvm1"
MASK32 = 0xFFFFFFFF
PHI32 = 0x9E3779B9


def _u32(value: int) -> int:
    return value & MASK32


def _imul(a: int, b: int) -> int:
    return (a * b) & MASK32


def _rotl32(value: int, count: int) -> int:
    value &= MASK32
    count &= 31
    if count == 0:
        return value
    return ((value << count) | (value >> (32 - count))) & MASK32


def _mix32(value: int) -> int:
    value &= MASK32
    value ^= value >> 16
    value = _imul(value, 2246822507)
    value ^= value >> 13
    value = _imul(value, 3266489909)
    value ^= value >> 16
    return value & MASK32


def _seed_hash(text: str) -> int:
    value = 2166136261
    for ch in text:
        value = _imul(value ^ ord(ch), 16777619)
    return _mix32(value)


def _keystream(seed: str, media_id: int, length: int) -> bytes:
    state: dict[int, int] = {}
    r = _mix32(_seed_hash(seed) ^ _mix32(_u32(media_id) ^ PHI32))

    for index in range(8):
        slot = r % 61
        r = _rotl32(_u32(r + PHI32), 7 + (7 & index))
        state[slot] = _u32(r ^ _mix32(r))
        r = _mix32(_u32(r + slot))

    acc = _mix32(_u32(0xA5A5A5A5 ^ r))
    out = bytearray(length)
    counter = 0
    pos = 0

    while pos < length:
        slot = acc % 61
        present = slot in state
        prior = state.get(slot, 0)
        mixed = _u32(prior ^ _imul(PHI32, counter + 1))
        word = _u32((acc | mixed) if present else (acc ^ mixed))
        word = _u32(
            _rotl32(_u32(word + acc), slot & 31)
            ^ _rotl32(acc, _imul(slot, 7) & 31)
        )
        acc = _mix32(_u32(word + PHI32))
        state[slot] = acc
        counter += 1

        for shift in (0, 8, 16, 24):
            if pos >= length:
                break
            out[pos] = (acc >> shift) & 0xFF
            pos += 1

    return bytes(out)


def decode_envelope(payload: str, seed: str, media_id: int) -> str:
    if not isinstance(payload, str):
        raise TypeError("encrypted Vidy payload must be a string")
    padded = payload.replace("-", "+").replace("_", "/")
    padded += "=" * (-len(padded) % 4)
    encrypted = base64.b64decode(padded)
    stream = _keystream(str(seed), int(media_id), len(encrypted))
    clear = bytes(a ^ b for a, b in zip(encrypted, stream))
    if not clear.startswith(MAGIC):
        raise ValueError("Vidy decrypt failed: bad seed or changed envelope")
    return clear[len(MAGIC) :].decode("utf-8")


class VidyResolver:
    def __init__(self, debug: bool = False):
        self.debug = debug
        self.ssl_context = ssl.create_default_context()

    def log(self, message: str) -> None:
        if self.debug:
            print(f"[Vidy] {message}")

    def _request(
        self,
        url: str,
        *,
        params: dict[str, Any] | None = None,
        referer: str | None = None,
        accept: str = "application/json,text/plain,*/*",
    ) -> Any:
        if params:
            query = urllib.parse.urlencode(
                [(key, value) for key, value in params.items() if value is not None]
            )
            url = f"{url}{'&' if '?' in url else '?'}{query}"

        headers = {
            "User-Agent": USER_AGENT,
            "Accept": accept,
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": referer or f"{BASE_URL}/",
            "Origin": BASE_URL,
        }
        req = urllib.request.Request(url, headers=headers, method="GET")
        self.log(f"GET {url}")
        try:
            with urllib.request.urlopen(req, timeout=25, context=self.ssl_context) as response:
                raw = response.read().decode("utf-8", errors="strict")
                content_type = response.headers.get("Content-Type", "").lower()
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="ignore")
            raise RuntimeError(f"HTTP {exc.code} from {url}: {body[:240]}") from exc
        except urllib.error.URLError as exc:
            raise RuntimeError(f"URL error for {url}: {exc.reason}") from exc

        if "json" in content_type:
            try:
                return json.loads(raw)
            except json.JSONDecodeError:
                pass
        stripped = raw.strip()
        if stripped.startswith(("{", "[", '"')):
            try:
                return json.loads(stripped)
            except json.JSONDecodeError:
                pass
        return raw

    def _metadata(self, media_id: int, media_type: str) -> dict[str, Any]:
        if media_type == "movie":
            data = self._request(
                f"{DB_BASE}/movie/{media_id}",
                params={"append_to_response": "external_ids", "language": "en"},
            )
            if not isinstance(data, dict):
                raise RuntimeError("Unexpected Vidy movie metadata response")
            release = data.get("release_date") or ""
            return {
                "title": data.get("title") or data.get("original_title") or "",
                "mediaType": "movie",
                "year": int(release[:4]) if release[:4].isdigit() else None,
                "tmdbId": int(media_id),
                "imdbId": data.get("imdb_id")
                or (data.get("external_ids") or {}).get("imdb_id")
                or "",
            }

        if media_type == "tv":
            data = self._request(
                f"{DB_BASE}/tv/{media_id}",
                params={"append_to_response": "external_ids", "language": "en"},
            )
            if not isinstance(data, dict):
                raise RuntimeError("Unexpected Vidy TV metadata response")
            release = data.get("first_air_date") or ""
            return {
                "title": data.get("name") or data.get("original_name") or "",
                "mediaType": "tv",
                "year": int(release[:4]) if release[:4].isdigit() else None,
                "tmdbId": int(media_id),
                "imdbId": (data.get("external_ids") or {}).get("imdb_id") or "",
            }

        raise ValueError(f"metadata is unsupported for {media_type}")

    def _post_json(self, url: str, payload: dict[str, Any]) -> Any:
        body = json.dumps(payload).encode("utf-8")
        headers = {
            "User-Agent": USER_AGENT,
            "Accept": "application/json,text/plain,*/*",
            "Content-Type": "application/json",
            "Referer": f"{BASE_URL}/",
            "Origin": BASE_URL,
        }
        req = urllib.request.Request(url, headers=headers, data=body, method="POST")
        self.log(f"POST {url}")
        try:
            with urllib.request.urlopen(req, timeout=25, context=self.ssl_context) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            error_body = exc.read().decode("utf-8", errors="ignore")
            raise RuntimeError(f"HTTP {exc.code} from {url}: {error_body[:240]}") from exc
        except urllib.error.URLError as exc:
            raise RuntimeError(f"URL error for {url}: {exc.reason}") from exc

    def _anime_title(self, anilist_id: int) -> str:
        data = self._post_json(
            "https://graphql.anilist.co",
            {
                "query": (
                    "query ($id: Int) { Media(id: $id, type: ANIME) { "
                    "title { english romaji } } }"
                ),
                "variables": {"id": int(anilist_id)},
            },
        )
        media = ((data or {}).get("data") or {}).get("Media") or {}
        title = media.get("title") or {}
        value = title.get("english") or title.get("romaji") or ""
        if not value:
            raise RuntimeError("AniList did not return a title for this ID")
        return str(value)

    def _anime_provider_id(self, title: str) -> str:
        data = self._request(
            "https://anime.vidy.st/api/search",
            params={"keyword": title, "page": 1},
        )
        items = (((data or {}).get("results") or {}).get("data") or []) if isinstance(data, dict) else []
        if not items:
            raise RuntimeError("Vidy anime search returned no provider match")
        target = title.lower()
        selected = next(
            (item for item in items if isinstance(item, dict) and str(item.get("title") or "").lower() == target),
            items[0],
        )
        slug = str(selected.get("slug") or "") if isinstance(selected, dict) else ""
        provider_id = slug.split("/", 1)[0]
        if not provider_id:
            raise RuntimeError("Vidy anime search result had no provider ID")
        return provider_id

    def _anime_sources(self, anilist_id: int, episode: int, dub: bool) -> dict[str, Any]:
        title = self._anime_title(anilist_id)
        provider_id = self._anime_provider_id(title)
        data = self._request(
            f"{API_BASE}/anikoto/sources-id",
            params={
                "providerId": provider_id,
                "episodeId": int(episode),
                "dub": "true" if dub else "false",
            },
        )
        if not isinstance(data, dict):
            raise RuntimeError("Unexpected Vidy anime source response")
        return data

    def _seed(self, media_id: int) -> str:
        data = self._request(f"{API_BASE}/seed", params={"mediaId": int(media_id)})
        if not isinstance(data, dict) or data.get("seed") is None:
            raise RuntimeError(f"Unexpected Vidy seed response: {data!r}")
        return str(data["seed"])

    @staticmethod
    def _encrypted_payload(value: Any) -> str:
        if isinstance(value, str):
            return value
        if isinstance(value, dict):
            for key in ("data", "payload", "encrypted", "result"):
                if isinstance(value.get(key), str):
                    return value[key]
        raise RuntimeError("Unexpected encrypted Vidy provider response")

    def _provider(
        self,
        provider: str,
        media_id: int,
        params: dict[str, Any],
        seed: str | None = None,
    ) -> dict[str, Any]:
        query = dict(params)
        query["title"] = urllib.parse.quote(str(query.get("title") or ""), safe="")

        seed = str(seed or self._seed(media_id))
        query.update({"enc": "2", "seed": seed})
        response = self._request(f"{API_BASE}/{provider}/sources", params=query)
        encrypted = self._encrypted_payload(response)
        clear = decode_envelope(encrypted, seed, media_id)
        data = json.loads(clear)
        if not isinstance(data, dict):
            raise RuntimeError("Decoded Vidy source response is not an object")
        return data

    @staticmethod
    def _stream_type(source: dict[str, Any]) -> str:
        url = str(source.get("url") or "").lower()
        kind = str(source.get("type") or "").lower()
        if ".mpd" in url or kind in {"mpd", "dash"}:
            return "dash"
        if ".m3u8" in url or kind in {"m3u8", "hls"}:
            return "hls"
        return kind or "unknown"

    @staticmethod
    def _quality(source: dict[str, Any]) -> str:
        quality = source.get("quality") or source.get("label")
        if quality:
            return str(quality)
        match = re.search(r"(2160|1440|1080|720|480|360)p?", str(source.get("url") or ""), re.I)
        return f"{match.group(1)}p" if match else "Auto"

    def _playables(
        self,
        data: dict[str, Any],
        provider: str,
        page_url: str,
    ) -> list[dict[str, Any]]:
        out: list[dict[str, Any]] = []
        for source in data.get("sources") or []:
            if not isinstance(source, dict):
                continue
            url = source.get("url")
            if not isinstance(url, str) or not url.startswith(("http://", "https://")):
                continue
            kind = self._stream_type(source)
            if kind not in {"hls", "dash"} and not any(x in url.lower() for x in (".m3u8", ".mpd")):
                continue
            source_headers = source.get("headers") if isinstance(source.get("headers"), dict) else {}
            headers = {
                "Referer": source_headers.get("Referer") or source_headers.get("referer") or page_url,
                "Origin": source_headers.get("Origin") or source_headers.get("origin") or BASE_URL,
                "User-Agent": source_headers.get("User-Agent") or source_headers.get("user-agent") or USER_AGENT,
            }
            for key, value in source_headers.items():
                if isinstance(value, str) and key not in headers:
                    headers[key] = value
            out.append(
                {
                    "url": url,
                    "type": kind,
                    "quality": self._quality(source),
                    "headers": headers,
                    "server": f"Vidy {provider.title()}",
                }
            )
        return out

    def resolve(
        self,
        media_id: str | int,
        media_type: str = "movie",
        season: int | None = None,
        episode: int | None = None,
        provider: str = "auto",
        verify: bool = False,
        dub: bool = False,
    ) -> str:
        try:
            numeric_id = int(media_id)
        except (TypeError, ValueError):
            return json.dumps({"status": "error", "server": "Vidy", "message": "Vidy requires a numeric media ID"}, indent=2)

        if media_type == "anime":
            anime_episode = int(episode or 1)
            page_url = f"{BASE_URL}/anime/{numeric_id}/{anime_episode}"
            try:
                data = self._anime_sources(numeric_id, anime_episode, dub)
                media_sources = data.get("mediaSources") if isinstance(data.get("mediaSources"), dict) else data
                playable = self._playables(media_sources, "Anikoto", page_url)
                subtitles = media_sources.get("subtitles") if isinstance(media_sources, dict) else []
                if not playable:
                    return json.dumps({"status": "notfound", "server": "Vidy", "message": "No playable Vidy anime sources were returned.", "page": page_url}, indent=2)
                return json.dumps(
                    {
                        "status": "success",
                        "id": str(numeric_id),
                        "type": "anime",
                        "season": None,
                        "episode": anime_episode,
                        "page": page_url,
                        "playable_urls": playable,
                        "subtitles": subtitles if isinstance(subtitles, list) else [],
                    },
                    indent=2,
                )
            except Exception as exc:
                return json.dumps({"status": "error", "server": "Vidy", "message": str(exc), "page": page_url}, indent=2)

        if media_type == "tv" and (season is None or episode is None):
            return json.dumps({"status": "error", "server": "Vidy", "message": "TV requires season and episode"}, indent=2)
        if media_type not in {"movie", "tv"}:
            return json.dumps({"status": "error", "server": "Vidy", "message": "type must be movie, tv, or anime"}, indent=2)

        if media_type == "movie":
            page_url = f"{BASE_URL}/movie/{numeric_id}"
        else:
            page_url = f"{BASE_URL}/tv/{numeric_id}/{int(season)}/{int(episode)}"

        try:
            params = self._metadata(numeric_id, media_type)
            if media_type == "tv":
                params["seasonId"] = int(season)
                params["episodeId"] = int(episode)

            providers = ALL_PROVIDERS if provider == "all" else ((provider,) if provider not in {"auto", ""} else DEFAULT_PROVIDERS)
            playable: list[dict[str, Any]] = []
            subtitles: list[dict[str, Any]] = []
            errors: dict[str, str] = {}
            shared_seed = self._seed(numeric_id)

            def load_provider(name: str):
                decoded = self._provider(name, numeric_id, params, seed=shared_seed)
                return name, decoded, self._playables(decoded, name, page_url)

            results = []
            if len(providers) == 1:
                try:
                    results.append(load_provider(providers[0]))
                except Exception as exc:
                    errors[providers[0]] = str(exc)
            else:
                with ThreadPoolExecutor(max_workers=min(5, len(providers))) as pool:
                    futures = {pool.submit(load_provider, name): name for name in providers}
                    for future in as_completed(futures):
                        name = futures[future]
                        try:
                            results.append(future.result())
                        except Exception as exc:
                            errors[name] = str(exc)
                            self.log(f"{name}: {exc}")

            order = {name: idx for idx, name in enumerate(providers)}
            results.sort(key=lambda item: order.get(item[0], 999))
            for name, decoded, current in results:
                if current:
                    playable.extend(current)
                    if isinstance(decoded.get("subtitles"), list):
                        subtitles.extend(x for x in decoded["subtitles"] if isinstance(x, dict))

            unique: list[dict[str, Any]] = []
            seen: set[str] = set()
            for source in playable:
                if source["url"] in seen:
                    continue
                seen.add(source["url"])
                if verify:
                    try:
                        self._request(source["url"], referer=source["headers"].get("Referer"), accept="*/*")
                    except Exception:
                        continue
                unique.append(source)

            def quality_rank(source: dict[str, Any]) -> int:
                match = re.search(r"(2160|1440|1080|720|480|360)", str(source.get("quality") or ""), re.I)
                return int(match.group(1)) if match else 0

            unique.sort(key=lambda source: (-quality_rank(source), str(source.get("server") or "")))

            if not unique:
                message = "No playable Vidy sources were returned by the current providers."
                if self.debug and errors:
                    message += " " + json.dumps(errors)
                return json.dumps({"status": "notfound", "server": "Vidy", "message": message, "page": page_url}, indent=2)

            return json.dumps(
                {
                    "status": "success",
                    "id": str(numeric_id),
                    "type": media_type,
                    "season": season,
                    "episode": episode,
                    "page": page_url,
                    "playable_urls": unique,
                    "subtitles": subtitles,
                },
                indent=2,
            )
        except Exception as exc:
            return json.dumps({"status": "error", "server": "Vidy", "message": str(exc), "page": page_url}, indent=2)


def main() -> None:
    parser = argparse.ArgumentParser(description="Vidy direct stream resolver")
    parser.add_argument("id", help="TMDB ID (movie/TV) or AniList ID (anime)")
    parser.add_argument("--type", choices=["movie", "tv", "anime"], default="movie")
    parser.add_argument("--season", type=int)
    parser.add_argument("--episode", type=int)
    parser.add_argument("--provider", choices=["auto", "all", *ALL_PROVIDERS], default="auto")
    parser.add_argument("--verify", action="store_true")
    parser.add_argument("--dub", action="store_true", help="Use dubbed anime sources when available")
    parser.add_argument("--debug", action="store_true")
    parser.add_argument("--pretty", action="store_true")
    args = parser.parse_args()

    result = VidyResolver(debug=args.debug).resolve(
        args.id,
        media_type=args.type,
        season=args.season,
        episode=args.episode,
        provider=args.provider,
        verify=args.verify,
        dub=args.dub,
    )
    if args.pretty:
        try:
            print(json.dumps(json.loads(result), indent=2))
            return
        except Exception:
            pass
    print(result)


if __name__ == "__main__":
    main()
