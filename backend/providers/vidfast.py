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
from concurrent.futures import ThreadPoolExecutor, as_completed
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse

import requests

DEFAULT_ORIGIN = "https://vidfast.vc"
USER_AGENT = "Mozilla/5.0 (compatible; SynScraper/1.0)"
MEDIA_EXTENSIONS = (".m3u8", ".mp4")


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


    def _capture_browser_media(self, page_url):
        """Observe media requests from the normal VidFast player in Chromium.

        Optional: install playwright + its Chromium browser, then set
        VIDFAST_BROWSER=1. No anti-bot evasion or private API decryption.
        """
        if os.getenv("VIDFAST_BROWSER", "0") != "1":
            return []
        try:
            from playwright.sync_api import sync_playwright
        except ImportError:
            return []
        results = []
        seen = set()

        def record(response):
            try:
                url = response.url
                if response.status not in (200, 206) or url in seen:
                    return
                parsed = urlparse(url)
                media_kind = next((kind for ext, kind in
                    ((".m3u8", "hls"), (".mp4", "mp4"))
                    if parsed.path.lower().endswith(ext)), None)
                if not media_kind:
                    content_type = response.headers.get("content-type", "").lower()
                    if "mpegurl" in content_type:
                        media_kind = "hls"
                    elif content_type.startswith("video/mp4"):
                        media_kind = "mp4"
                if not media_kind or parsed.scheme not in ("http", "https"):
                    return
                seen.add(url)
                request_headers = response.request.headers
                results.append({
                    "server": "VidFast",
                    "url": url,
                    "type": media_kind,
                    "quality": "Auto",
                    "headers": {
                        "Referer": request_headers.get("referer", page_url),
                        "Origin": request_headers.get("origin", self.origin),
                        "User-Agent": USER_AGENT,
                    },
                })
            except Exception:
                return

        try:
            with sync_playwright() as playwright:
                browser = playwright.chromium.launch(headless=True)
                try:
                    context = browser.new_context(user_agent=USER_AGENT)
                    page = context.new_page()
                    page.on("response", record)
                    page.goto(page_url + "?autoPlay=true", wait_until="domcontentloaded", timeout=12000)
                    page.wait_for_timeout(2000)
                    if not results:
                        for selector in ('video', 'button[aria-label*="Play"]', 'button[title*="Play"]'):
                            try:
                                button = page.locator(selector).first
                                if button.count() and button.is_visible():
                                    button.click(timeout=1200)
                                    break
                            except Exception:
                                pass
                        page.wait_for_timeout(6000)
                finally:
                    browser.close()
        except Exception:
            pass
        return results


    def _verify_media(self, url, referer, kind):
        """Verify static HTML media links before exposing them as playable."""
        try:
            with self.session.get(
                url,
                headers={
                    "User-Agent": USER_AGENT,
                    "Referer": referer,
                    "Origin": self.origin,
                    "Range": "bytes=0-4095",
                },
                timeout=4,
                stream=True,
            ) as response:
                response.raise_for_status()
                mime = response.headers.get("Content-Type", "").lower()
                if kind == "hls":
                    if "mpegurl" in mime:
                        return True
                    head = next(response.iter_content(4096), b"")
                    return head.lstrip().startswith(b"#EXTM3U")
                if kind == "mp4":
                    if mime.startswith("video/mp4"):
                        return True
                    head = next(response.iter_content(32), b"")
                    return b"ftyp" in head[:16]
        except (requests.RequestException, ValueError, StopIteration):
            return False
        return False


    def _resolve_via_api(self, page_url):
        """Resolve streams using the publicly documented EncDec VidFast flow.

        Reference: github.com/smy778/EncDecEndpoints/blob/main/samples/vidfast.py
        The API is third-party and may change; failures are nonfatal.
        """
        if os.getenv("VIDFAST_API", "1") == "0":
            return []
        endpoint = os.getenv("VIDFAST_ENCDEC_API", "https://enc-dec.app/api").rstrip("/")
        host_headers = {
            "User-Agent": USER_AGENT,
            "Referer": self.origin + "/",
            "X-Requested-With": "XMLHttpRequest",
        }

        def result_or_none(response):
            response.raise_for_status()
            obj = response.json()
            if not isinstance(obj, dict) or obj.get("status") != 200:
                return None
            return obj.get("result")

        try:
            # A trailing slash is used by the documented API sample.
            response = self.session.get(page_url + "/", headers=host_headers, timeout=5)
            response.raise_for_status()
            page = response.text.replace('\\\"', '"')
            match = re.search(r'"(?:en|token)"\\s*:\\s*"([^"]+)"', page)
            if not match:
                return []
            token = match.group(1)

            parts = result_or_none(self.session.get(
                endpoint + "/enc-vidfast",
                params={"text": token, "stage": "1"}, timeout=5,
            ))
            if not isinstance(parts, dict) or not parts.get("stage1") or not parts.get("token"):
                return []
            host_headers["X-CSRF-Token"] = parts["token"]
            stage1 = self.session.post(parts["stage1"], headers=host_headers, timeout=5)
            stage1.raise_for_status()

            stage2 = result_or_none(self.session.get(
                endpoint + "/enc-vidfast",
                params={"text": stage1.text, "stage": "2"}, timeout=5,
            ))
            if not isinstance(stage2, dict) or not all(stage2.get(k) for k in ("servers", "stream", "token")):
                return []
            host_headers["X-CSRF-Token"] = stage2["token"]
            encrypted_servers = self.session.post(stage2["servers"], headers=host_headers, timeout=5)
            encrypted_servers.raise_for_status()
            servers = result_or_none(self.session.post(
                endpoint + "/dec-vidfast",
                json={"text": encrypted_servers.text}, timeout=5,
            ))
            if not isinstance(servers, list):
                return []
        except (requests.RequestException, ValueError, KeyError, TypeError):
            return []

        def fetch_stream(server):
            if not isinstance(server, dict) or not server.get("data"):
                return None
            # A separate session per worker avoids concurrent session-cookie mutation.
            try:
                with requests.Session() as session:
                    encrypted = session.post(
                        stage2["stream"].rstrip("/") + "/" + str(server["data"]),
                        headers=host_headers, timeout=6,
                    )
                    encrypted.raise_for_status()
                    decrypted = result_or_none(session.post(
                        endpoint + "/dec-vidfast",
                        json={"text": encrypted.text}, timeout=6,
                    ))
                if not isinstance(decrypted, dict):
                    return None
                url = decrypted.get("url")
                if not isinstance(url, str) or not url.startswith(("https://", "http://")):
                    return None
                path = urlparse(url).path.lower()
                kind = "dash" if path.endswith(".mpd") else (
                    "mp4" if path.endswith(".mp4") else "hls"
                )
                # SynPlayer currently supports native MP4 and HLS, not DASH.
                if kind == "dash":
                    return None
                return {
                    "server": str(server.get("name") or "VidFast")[:80],
                    "url": url,
                    "type": kind,
                    "quality": "Auto",
                    "headers": {
                        "Referer": self.origin + "/",
                        "Origin": self.origin,
                        "User-Agent": USER_AGENT,
                    },
                }
            except (requests.RequestException, ValueError, TypeError):
                return None

        output = []
        seen = set()
        # Limit workload to avoid hammering provider endpoints on every request.
        with ThreadPoolExecutor(max_workers=3) as pool:
            futures = [pool.submit(fetch_stream, s) for s in servers[:8]]
            for future in as_completed(futures):
                stream = future.result()
                if stream and stream["url"] not in seen:
                    seen.add(stream["url"])
                    output.append(stream)
        return output

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
        api_streams = self._resolve_via_api(page_url)
        if api_streams:
            return json.dumps({"status": "success", "tmdb_id": tmdb_id, "playable_urls": api_streams})
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
        except (requests.RequestException, ValueError):
            # JavaScript-based players can still be readable through Chromium
            # even when a plain HTTP client cannot fetch their landing page.
            content = ""

        parser = _MediaParser()
        parser.feed(content)
        candidates = list(parser.sources)
        # Some public players declare static sources in configuration fields.
        for match in re.finditer(r'["\'](?:file|src|source|contentUrl)["\']\s*:\s*["\']([^"\']+)["\']', content):
            candidates.append(match.group(1))

        playable = []
        seen = set()
        for candidate in candidates:
            candidate = html.unescape(candidate).replace("\\/", "/").strip()
            url = urljoin(page_url, candidate)
            parsed = urlparse(url)
            if parsed.scheme not in ("http", "https") or not parsed.hostname:
                continue
            # Only accept unambiguous media URLs, not embeds or thumbnails.
            media_path = parsed.path.lower()
            media_type_out = next((kind for ext, kind in
                ((".m3u8", "hls"), (".mp4", "mp4"))
                if media_path.endswith(ext)), None)
            if not media_type_out or url in seen:
                continue
            if not self._verify_media(url, page_url, media_type_out):
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
            playable = self._capture_browser_media(page_url)
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
