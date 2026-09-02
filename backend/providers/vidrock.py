#!/usr/bin/env python3
"""Vidrock resolver for the current plain-ID API and encrypted stream URLs."""

import base64
import json
import re
import ssl
import urllib.error
import urllib.request

try:
    from Crypto.Cipher import AES
except ImportError as exc:
    raise ImportError("Please install pycryptodome: pip install pycryptodome") from exc

__version__ = "2.0.0"

DOMAIN = "https://vidrock.net"
VIDROCK_GCM_KEY_HEX = "7f3e9c2a8b5d1f4e6a9c3b7d2e5f8a1c4b6d9e2f5a8c1b4d7e9f2a5c8b1d4e7f"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": f"{DOMAIN}/",
    "Origin": DOMAIN,
}


class VidrockResolver:
    def __init__(self, debug=False):
        self.debug = debug
        self.ssl_context = ssl.create_default_context()

    def log(self, message, level="INFO"):
        if self.debug or level == "ERROR":
            print(f"[{level}] {message}")

    def _fetch_url(self, url, headers=None, timeout=15):
        request_headers = dict(HEADERS)
        if headers:
            request_headers.update(headers)
        try:
            req = urllib.request.Request(url, headers=request_headers)
            with urllib.request.urlopen(req, timeout=timeout, context=self.ssl_context) as response:
                content = response.read().decode("utf-8", errors="ignore")
                status = getattr(response, "status", 200)
                return True, content, None, status, response.headers
        except urllib.error.HTTPError as exc:
            return False, None, f"HTTP Error {exc.code}: {exc.reason}", exc.code, exc.headers
        except urllib.error.URLError as exc:
            return False, None, f"URL Error: {exc}", None, None
        except Exception as exc:
            return False, None, f"Error: {exc}", None, None

    @staticmethod
    def _base64url_decode(value):
        text = str(value or "").replace("-", "+").replace("_", "/")
        remainder = len(text) % 4
        if remainder == 2:
            text += "=="
        elif remainder == 3:
            text += "="
        elif remainder == 1:
            raise ValueError("invalid base64url")
        return base64.b64decode(text)

    def _decrypt_stream_url(self, encrypted):
        raw = self._base64url_decode(encrypted)
        if len(raw) < 29:
            raise ValueError("ciphertext too short")
        iv = raw[:12]
        ciphertext_and_tag = raw[12:]
        ciphertext = ciphertext_and_tag[:-16]
        tag = ciphertext_and_tag[-16:]
        key = bytes.fromhex(VIDROCK_GCM_KEY_HEX)
        cipher = AES.new(key, AES.MODE_GCM, nonce=iv)
        plaintext = cipher.decrypt_and_verify(ciphertext, tag)
        return plaintext.decode("utf-8")

    def _resolve_quality_manifest(self, url, headers):
        success, content, _error, _status, response_headers = self._fetch_url(url, headers=headers)
        if not success:
            return url, None
        content_type = str(response_headers.get("Content-Type", "") if response_headers else "").lower()
        stripped = content.lstrip()
        if "json" not in content_type and not stripped.startswith("["):
            return url, None
        try:
            data = json.loads(content)
        except json.JSONDecodeError:
            return url, None
        if not isinstance(data, list):
            return url, None

        candidates = []
        for entry in data:
            if not isinstance(entry, dict):
                continue
            candidate = entry.get("url")
            if not isinstance(candidate, str) or not candidate.startswith(("http://", "https://")):
                continue
            try:
                resolution = int(entry.get("resolution") or 0)
            except (TypeError, ValueError):
                resolution = 0
            candidates.append((resolution, candidate))
        if not candidates:
            return url, None
        resolution, best_url = max(candidates, key=lambda item: item[0])
        return best_url, resolution or None

    @staticmethod
    def _quality_for(url, server_name, explicit_resolution=None):
        if explicit_resolution:
            return "4K" if explicit_resolution >= 2160 else f"{explicit_resolution}p"
        combined = f"{url} {server_name}".lower()
        if "2160" in combined or "4k" in combined:
            return "4K"
        for value in (1440, 1080, 720, 480, 360, 240, 144):
            if str(value) in combined:
                return f"{value}p"
        return "Auto"

    def resolve(self, url_or_id, media_type="movie", season=None, episode=None):
        raw_input = str(url_or_id)
        if raw_input.startswith("http"):
            match = re.search(r"/(?:movie|tv)/(\d+)", raw_input)
            if not match:
                return json.dumps({"status": "error", "message": "Could not extract TMDB ID from URL"})
            tmdb_id = match.group(1)
            if "/tv/" in raw_input:
                media_type = "tv"
                se_match = re.search(r"/tv/\d+/(\d+)/(\d+)", raw_input)
                if se_match:
                    season = int(se_match.group(1))
                    episode = int(se_match.group(2))
        else:
            tmdb_id = raw_input

        if not tmdb_id.isdigit():
            return json.dumps({"status": "error", "message": "TMDB ID must be numeric"})

        if media_type == "tv":
            if season is None or episode is None:
                return json.dumps({"status": "error", "message": "TV resolution requires season and episode"})
            api_url = f"{DOMAIN}/api/tv/{tmdb_id}/{int(season)}/{int(episode)}"
        else:
            api_url = f"{DOMAIN}/api/movie/{tmdb_id}"

        success, content, error, status, _headers = self._fetch_url(api_url)
        if not success:
            return json.dumps({"status": "error", "message": f"API request failed ({status}): {error}"})

        try:
            sources = json.loads(content)
        except json.JSONDecodeError as exc:
            return json.dumps({"status": "error", "message": f"Invalid JSON from API: {exc}"})
        if not isinstance(sources, dict):
            return json.dumps({"status": "error", "message": "Unexpected Vidrock response format"})

        playable_urls = []
        for server_name, server_data in sources.items():
            if not isinstance(server_data, dict):
                continue
            encrypted_url = server_data.get("url")
            if not isinstance(encrypted_url, str) or not encrypted_url.strip():
                continue
            try:
                stream_url = self._decrypt_stream_url(encrypted_url.strip())
            except Exception as exc:
                self.log(f"{server_name}: decrypt failed: {exc}", "WARNING")
                continue
            if not stream_url.startswith(("http://", "https://")):
                continue

            response_headers = server_data.get("headers") if isinstance(server_data.get("headers"), dict) else {}
            playback_headers = dict(response_headers)
            playback_headers.setdefault("Referer", f"{DOMAIN}/")
            playback_headers.setdefault("Origin", DOMAIN)
            playback_headers.setdefault("User-Agent", HEADERS["User-Agent"])

            final_url, resolution = self._resolve_quality_manifest(stream_url, playback_headers)
            source_type = str(server_data.get("type") or "").lower()
            if ".mp4" in final_url.lower() or source_type == "mp4":
                stream_type = "mp4"
            else:
                stream_type = "hls"

            playable_urls.append({
                "server": server_name,
                "url": final_url,
                "quality": self._quality_for(final_url, server_name, resolution),
                "type": stream_type,
                "headers": playback_headers,
                "lang": server_data.get("language") or server_data.get("lang") or "unknown",
            })

        if not playable_urls:
            return json.dumps({"status": "error", "message": "No playable Vidrock sources found"})

        return json.dumps(
            {"status": "success", "tmdb_id": tmdb_id, "playable_urls": playable_urls},
            indent=2,
        )


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Vidrock resolver")
    parser.add_argument("url_or_id")
    parser.add_argument("--type", choices=["movie", "tv"], default="movie")
    parser.add_argument("--season", type=int)
    parser.add_argument("--episode", type=int)
    parser.add_argument("--debug", action="store_true")
    args = parser.parse_args()

    print(
        VidrockResolver(debug=args.debug).resolve(
            args.url_or_id,
            media_type=args.type,
            season=args.season,
            episode=args.episode,
        )
    )
