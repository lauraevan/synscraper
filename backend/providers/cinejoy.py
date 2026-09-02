#!/usr/bin/env python3
"""CineJoy source resolver for SynScraper.

CineJoy's current scraper API is protected by its public crush.wasm request
sealer. This resolver reproduces the browser client's request envelope and
returns only direct HTTP(S) HLS/DASH/MP4 sources exposed to the authorized
player. It does not handle DRM/content keys.
"""
from __future__ import annotations

import json
import os
import re
import secrets
from typing import Any

import requests
from Crypto.Cipher import AES
from wasmtime import Engine, Instance, Module, Store

__version__ = "0.1.0"

BASE_URL = "https://cinejoy.to"
API_BASE = "https://api.shegu.st"
WASM_URL = f"{API_BASE}/crush.wasm"
AAD_NAME = b"lumen-gate-v2"
USER_AGENT = os.environ.get(
    "SCRAPER_USER_AGENT",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36",
)

RANDOM_LEN = 44
RESPONSE_KEY_LEN = 32
KEY_ID_LEN = 1
EPHEMERAL_PUBLIC_LEN = 65
SEALED_HEADER_LEN = RESPONSE_KEY_LEN + KEY_ID_LEN + EPHEMERAL_PUBLIC_LEN
IV_LEN = 12
TAG_LEN = 16


class CineJoyResolver:
    def __init__(self, debug: bool = False):
        self.debug = debug
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": USER_AGENT,
            "Accept": "application/json,text/plain,*/*",
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": f"{BASE_URL}/",
            "Origin": BASE_URL,
        })
        self._engine: Engine | None = None
        self._store: Store | None = None
        self._exports = None

    def log(self, message: str) -> None:
        if self.debug:
            print(f"[CineJoy] {message}")

    def _init_wasm(self) -> None:
        if self._exports is not None:
            return
        response = self.session.get(WASM_URL, timeout=20, headers={"Cache-Control": "no-cache"})
        response.raise_for_status()
        self._engine = Engine()
        self._store = Store(self._engine)
        module = Module(self._engine, response.content)
        instance = Instance(self._store, module, [])
        self._exports = instance.exports(self._store)

    def _seal(self, path: str, payload: dict[str, Any]) -> tuple[bytes, int, bytes, bytes]:
        self._init_wasm()
        assert self._store is not None and self._exports is not None
        request = json.dumps(
            {"path": path, "payload": payload if payload is not None else None},
            separators=(",", ":"),
            ensure_ascii=False,
        ).encode("utf-8")
        random_bytes = secrets.token_bytes(RANDOM_LEN)
        capacity = len(request) + 512
        memory = self._exports["memory"]
        alloc = self._exports["alloc"]
        dealloc = self._exports["dealloc"]
        seal_request = self._exports["seal_request"]
        p_request = alloc(self._store, len(request))
        p_random = alloc(self._store, len(random_bytes))
        p_out = alloc(self._store, capacity)
        if not p_request or not p_random or not p_out:
            raise RuntimeError("CineJoy protection WASM allocation failed")
        try:
            memory.write(self._store, request, p_request)
            memory.write(self._store, random_bytes, p_random)
            out_len = int(seal_request(
                self._store, p_request, len(request), p_random, len(random_bytes), p_out, capacity
            ))
            if out_len <= SEALED_HEADER_LEN or out_len > capacity:
                raise RuntimeError(f"CineJoy protection WASM sealing failed ({out_len})")
            sealed = bytes(memory.read(self._store, p_out, p_out + out_len))
        finally:
            dealloc(self._store, p_request, len(request))
            dealloc(self._store, p_random, len(random_bytes))
            dealloc(self._store, p_out, capacity)
        return (
            sealed[:RESPONSE_KEY_LEN],
            sealed[RESPONSE_KEY_LEN],
            sealed[RESPONSE_KEY_LEN + 1 : SEALED_HEADER_LEN],
            sealed[SEALED_HEADER_LEN:],
        )

    @staticmethod
    def _aad(key_id: int, ephemeral: bytes) -> bytes:
        return AAD_NAME + bytes((0, 2, key_id)) + ephemeral

    def _protected_call(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        response_key, key_id, ephemeral, body = self._seal(path, payload)
        response = self.session.post(
            f"{API_BASE}/g", data=body, timeout=25,
            headers={"Content-Type": "text/plain;charset=UTF-8"},
        )
        response.raise_for_status()
        encrypted = response.content
        if len(encrypted) < IV_LEN + TAG_LEN:
            raise RuntimeError("CineJoy protected response is malformed")
        iv = encrypted[:IV_LEN]
        ciphertext = encrypted[IV_LEN:-TAG_LEN]
        tag = encrypted[-TAG_LEN:]
        cipher = AES.new(response_key, AES.MODE_GCM, nonce=iv, mac_len=TAG_LEN)
        cipher.update(self._aad(key_id, ephemeral))
        clear = cipher.decrypt_and_verify(ciphertext, tag)
        data = json.loads(clear.decode("utf-8"))
        if not isinstance(data, dict):
            raise RuntimeError("CineJoy protected response is not an object")
        return data

    def _servers(self) -> list[dict[str, Any]]:
        response = self.session.get(f"{API_BASE}/servers", timeout=20)
        response.raise_for_status()
        data = response.json()
        servers = data.get("servers") if isinstance(data, dict) else None
        if not isinstance(servers, list):
            raise RuntimeError("CineJoy server list response changed")
        return [x for x in servers if isinstance(x, dict) and x.get("status") == "ok"]

    @staticmethod
    def _absolute_url(value: Any) -> str | None:
        if isinstance(value, str) and value.startswith(("https://", "http://")):
            return value
        return None

    @staticmethod
    def _quality(value: Any, url: str) -> str:
        if value not in (None, "", "unknown"):
            text = str(value)
            return text if text.lower().endswith("p") else f"{text}p" if text.isdigit() else text
        match = re.search(r"(?:^|[^0-9])(2160|1440|1080|720|480|360)(?:p|[^0-9]|$)", url, re.I)
        return f"{match.group(1)}p" if match else "Auto"

    @staticmethod
    def _kind(url: str, explicit: Any = None) -> str:
        kind = str(explicit or "").lower()
        low = url.lower()
        if ".m3u8" in low or kind == "hls": return "hls"
        if ".mpd" in low or kind in {"dash", "mpd"}: return "dash"
        if ".mp4" in low or kind in {"file", "mp4"}: return "mp4"
        return kind or "hls"

    def _captions(self, captions: Any, provider: str) -> list[dict[str, Any]]:
        if not isinstance(captions, list): return []
        out = []
        for idx, item in enumerate(captions):
            if isinstance(item, str): item = {"url": item}
            if not isinstance(item, dict): continue
            url = self._absolute_url(item.get("url") or item.get("file") or item.get("src"))
            if not url: continue
            out.append({
                "id": str(item.get("id") or f"cinejoy-{provider.lower()}-{idx}"),
                "url": url,
                "name": item.get("name") or item.get("label") or item.get("language") or "Subtitle",
                "lang": item.get("lang") or item.get("language") or "und",
                "type": item.get("type") or "vtt",
                "source": "cinejoy",
                "headers": item.get("headers") if isinstance(item.get("headers"), dict) else {},
            })
        return out

    def _normalize_streams(self, data: dict[str, Any], provider: str) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        inner = data.get("data") if isinstance(data.get("data"), dict) else data
        if not isinstance(inner, dict): return [], []
        raw_streams = inner.get("stream") or inner.get("streams") or inner.get("sources") or []
        if not isinstance(raw_streams, list): raw_streams = [raw_streams]
        playable, subtitles = [], []
        for stream in raw_streams:
            if not isinstance(stream, dict): continue
            captions = self._captions(stream.get("captions") or stream.get("subtitles"), provider)
            subtitles.extend(captions)
            headers = stream.get("headers") if isinstance(stream.get("headers"), dict) else {}
            direct = self._absolute_url(stream.get("playlist") or stream.get("url") or stream.get("file") or stream.get("src"))
            if direct:
                playable.append({
                    "url": direct,
                    "type": self._kind(direct, stream.get("type")),
                    "quality": self._quality(stream.get("quality") or stream.get("label"), direct),
                    "headers": {
                        "Referer": headers.get("Referer") or headers.get("referer") or f"{BASE_URL}/",
                        "Origin": headers.get("Origin") or headers.get("origin") or BASE_URL,
                        "User-Agent": headers.get("User-Agent") or headers.get("user-agent") or USER_AGENT,
                    },
                    "server": f"CineJoy · {provider}",
                    "captions": captions,
                })
            qualities = stream.get("qualities")
            if isinstance(qualities, dict):
                for quality, item in qualities.items():
                    if not isinstance(item, dict): continue
                    url = self._absolute_url(item.get("url") or item.get("file") or item.get("src"))
                    if not url: continue
                    qh = item.get("headers") if isinstance(item.get("headers"), dict) else headers
                    playable.append({
                        "url": url,
                        "type": self._kind(url, item.get("type") or stream.get("type")),
                        "quality": self._quality(quality, url),
                        "headers": {
                            "Referer": qh.get("Referer") or qh.get("referer") or f"{BASE_URL}/",
                            "Origin": qh.get("Origin") or qh.get("origin") or BASE_URL,
                            "User-Agent": qh.get("User-Agent") or qh.get("user-agent") or USER_AGENT,
                        },
                        "server": f"CineJoy · {provider}",
                        "captions": captions,
                    })
        return playable, subtitles

    def resolve(self, media_id: str | int, media_type: str = "movie", season: int | None = None,
                episode: int | None = None, **_: Any) -> str:
        try: tmdb_id = str(int(media_id))
        except (TypeError, ValueError):
            return json.dumps({"status": "error", "server": "CineJoy", "message": "CineJoy requires a numeric TMDB ID"})
        if media_type == "tv" and (season is None or episode is None):
            return json.dumps({"status": "error", "server": "CineJoy", "message": "TV requires season and episode"})
        if media_type not in {"movie", "tv"}:
            return json.dumps({"status": "notfound", "server": "CineJoy", "message": "CineJoy backend currently supports movie and TV routes"})
        payload: dict[str, Any] = {"tmdb": tmdb_id}
        endpoint, page = "movie", f"{BASE_URL}/watch/movie/{tmdb_id}"
        if media_type == "tv":
            payload.update({"season": str(int(season)), "episode": str(int(episode))})
            endpoint, page = "series", f"{BASE_URL}/watch/tv/{tmdb_id}/{int(season)}/{int(episode)}"
        try: servers = self._servers()
        except Exception as exc:
            return json.dumps({"status": "error", "server": "CineJoy", "message": str(exc), "page": page})
        all_playable, all_subtitles, errors = [], [], {}
        for server in servers[:6]:
            provider = str(server.get("name") or server.get("id") or server.get("server") or "").strip()
            if not provider: continue
            try:
                response = self._protected_call(f"/{provider}/{endpoint}", payload)
                status = int(response.get("status") or 0)
                if not 200 <= status < 300:
                    body = response.get("data") if isinstance(response.get("data"), dict) else {}
                    errors[provider] = str(body.get("error") or f"HTTP {status}")
                    continue
                playable, subtitles = self._normalize_streams(response, provider)
                if playable:
                    all_playable.extend(playable); all_subtitles.extend(subtitles)
                    if len(all_playable) >= 3: break
            except Exception as exc:
                errors[provider] = str(exc); self.log(f"{provider}: {exc}")
        unique, seen = [], set()
        for item in all_playable:
            if item["url"] in seen: continue
            seen.add(item["url"]); unique.append(item)
        if not unique:
            message = "No direct CineJoy streams were returned by the current servers."
            if self.debug and errors: message += " " + json.dumps(errors)
            return json.dumps({"status": "notfound", "server": "CineJoy", "message": message, "page": page}, indent=2)
        return json.dumps({
            "status": "success", "id": tmdb_id, "type": media_type,
            "season": season, "episode": episode, "page": page,
            "playable_urls": unique, "subtitles": all_subtitles,
        }, indent=2)
