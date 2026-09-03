#!/usr/bin/env python3
"""VidCore resolver for SynScraper.

Replays VidCore's player session/catalog flow and returns concrete HLS URLs.
Supports movie and TV TMDB ids. No DRM handling is implemented.
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
import base64
import hashlib
import html as html_lib
import json
import math
import os
import re
import struct
import time
from typing import Any

import requests
from Crypto.Cipher import AES
from Crypto.Util.Padding import pad

__version__ = "0.1.0"

ORIGINS = tuple(
    part.strip().rstrip("/")
    for part in os.environ.get(
        "VIDCORE_ORIGINS",
        "https://vidcore.org,https://www.vidcore.org,https://vidcore.io",
    ).split(",")
    if part.strip()
)

UA = os.environ.get(
    "SCRAPER_USER_AGENT",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
)

AES_KEY = bytes.fromhex("bc3b061beff76cf02a4e6e5b4de747407c9ea177faf1d0d953a0de9382e59089")
AES_IV = bytes.fromhex("29e99500c65d49bfd6d1e9786e742e7d")
PREFIX = bytes.fromhex("151ac1b316ec9db4")

ALPHA = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_"
ALPHA_TO = "sLeXqwO8WHuTGiQ9JpmV3_1jBhxZAr6n240YgDSU7NovytRabC5F-kEMdzcKlfPI"
ENC_TRANS = str.maketrans(ALPHA, ALPHA_TO)

HEX_KEY = bytes.fromhex("65514a10161847e8ec6d0400d80bee8dc69f6ba5c09b56729975781f66eaa4ca")
NUM_A = 5839172817
NUM_B = 5717337600

CATALOG_BASE = "/ja/1000018218870967"
LIST_ACTION = "E9AC6-y0Mng"
STREAM_ACTION = "UnTuCgorJGE"

PREFERRED_SERVERS = ("Premiere 4K", "Orbit", "Supreme", "Prime", "Horizon")


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _b64decode(value: str) -> bytes:
    raw = value.strip().encode("ascii")
    raw += b"=" * ((4 - len(raw) % 4) % 4)
    return base64.urlsafe_b64decode(raw)


def _encode_custom(data: bytes) -> str:
    return _b64(data).translate(ENC_TRANS)


def _rotl8(x: int, n: int) -> int:
    n &= 7
    return (((x << n) | (x >> (8 - n))) & 0xFF) if n else x & 0xFF


def _rotr8(x: int, n: int) -> int:
    n &= 7
    return (((x >> n) | (x << (8 - n))) & 0xFF) if n else x & 0xFF


def _xorshift(seed_material: bytes):
    digest = hashlib.sha256(seed_material).digest()
    vals = struct.unpack_from("<IIII", digest, 0)
    state = (vals[0] ^ vals[1] ^ vals[2] ^ vals[3]) & 0xFFFFFFFF
    if state == 0:
        state = 2654435769

    def next_u32() -> int:
        nonlocal state
        state ^= (state << 13) & 0xFFFFFFFF
        state &= 0xFFFFFFFF
        state ^= state >> 17
        state &= 0xFFFFFFFF
        state ^= (state << 5) & 0xFFFFFFFF
        state &= 0xFFFFFFFF
        return state

    return next_u32


def _fy_order(n: int, next_u32) -> list[int]:
    order = list(range(n))
    for i in range(n - 1, 0, -1):
        j = next_u32() % (i + 1)
        order[i], order[j] = order[j], order[i]
    return order


def _perm256(material: bytes) -> bytes:
    next_u32 = _xorshift(material)
    arr = list(range(256))
    for i in range(255, 0, -1):
        j = next_u32() % (i + 1)
        arr[i], arr[j] = arr[j], arr[i]
    return bytes(arr)


def _shuffle_blocks(data: bytes, seed_material: bytes) -> tuple[bytes, list[int]]:
    block = 16
    n = math.ceil(len(data) / block)
    order = _fy_order(n, _xorshift(seed_material))
    padded = data + b"\x00" * (n * block - len(data))
    out = bytearray(n * block)
    for i in range(n):
        src = order[i] * block
        out[i * block : (i + 1) * block] = padded[src : src + block]
    return bytes(out[: len(data)]), order


def _apply_order(data: bytes, order: list[int]) -> bytes:
    src = bytes(data)
    return bytes(src[index] for index in order)


def _rc4(key: bytes, data: bytes) -> bytes:
    s = list(range(256))
    j = 0
    for i in range(256):
        j = (j + s[i] + key[i % len(key)]) & 0xFF
        s[i], s[j] = s[j], s[i]
    i = 0
    j = 0
    out = bytearray(len(data))
    for n, byte in enumerate(data):
        i = (i + 1) & 0xFF
        j = (j + s[i]) & 0xFF
        s[i], s[j] = s[j], s[i]
        out[n] = byte ^ s[(s[i] + s[j]) & 0xFF]
    return bytes(out)


def _salted_xor(data: bytes, key_b64: str, salt_b64: str, xf) -> bytes:
    key = base64.b64decode(key_b64)
    salt = base64.b64decode(salt_b64)
    out = bytearray()
    for i, byte in enumerate(data):
        if i < len(salt):
            out.append(salt[i])
        out.append(xf(i, byte ^ key[i % len(key)]) & 0xFF)
    return bytes(out)


def _dispatch(table):
    return lambda i, x: table.get(i % 10, lambda v: v)(x)


OPS = {
    "xor59": lambda x: x ^ 59,
    "sub76": lambda x: (x - 76) & 0xFF,
    "sub200": lambda x: (x - 200) & 0xFF,
    "sub216": lambda x: (x - 216) & 0xFF,
    "sub218": lambda x: (x - 218) & 0xFF,
    "sub226": lambda x: (x - 226) & 0xFF,
    "add230": lambda x: (x + 230) & 0xFF,
    "rotl1": lambda x: _rotl8(x, 1),
    "rotl2": lambda x: _rotl8(x, 2),
    "rotr2": lambda x: _rotr8(x, 2),
    "rotl7": lambda x: _rotl8(x, 7),
    "rotr7": lambda x: _rotr8(x, 7),
}

XF_EA = _dispatch({
    0: OPS["sub226"], 9: OPS["sub226"], 1: OPS["sub76"], 5: OPS["sub76"],
    2: OPS["rotl2"], 3: OPS["sub200"], 7: OPS["sub200"],
    4: OPS["xor59"], 6: OPS["xor59"], 8: OPS["xor59"],
})
XF_B81 = _dispatch({
    0: OPS["sub218"], 7: OPS["sub218"], 1: OPS["rotl2"], 4: OPS["rotl2"],
    2: OPS["xor59"], 6: OPS["xor59"], 3: OPS["rotl1"], 8: OPS["rotl1"],
    5: OPS["rotr2"], 9: OPS["add230"],
})
XF_C272 = _dispatch({
    0: OPS["rotl2"], 1: OPS["sub200"], 3: OPS["sub200"], 2: OPS["rotr2"],
    7: OPS["rotr2"], 4: OPS["rotl1"], 5: OPS["rotr7"], 8: OPS["rotr7"],
    6: OPS["sub226"], 9: OPS["rotl7"],
})
XF_C936 = _dispatch({
    0: OPS["sub200"], 6: OPS["sub200"], 1: OPS["rotl2"], 8: OPS["rotl2"],
    2: OPS["sub226"], 3: OPS["add230"], 5: OPS["add230"],
    4: OPS["sub76"], 7: OPS["sub218"], 9: OPS["rotl1"],
})
XF_BAD = _dispatch({
    0: OPS["sub216"], 4: OPS["sub216"], 1: OPS["rotr7"], 2: OPS["rotl7"],
    7: OPS["rotl7"], 3: OPS["xor59"], 5: OPS["xor59"],
    6: OPS["sub226"], 8: OPS["rotl1"], 9: OPS["rotl2"],
})

PIPE = [
    ("xor", "4A0cZbwoo3dBMR+hBpflxHq7IulaAG+VHEP+/KuuGso=", "I2tW0Lrce40=", XF_EA),
    ("mix", "oqDHQwu30IFWxZuj737jFpp8xLPCEB8mjIt+syKfJRw="),
    ("xor", "spUa4i09naB+5oT/drp4yipRNCoPCf/sHySmWjFkv6I=", "4Lclzk8BGw0=", XF_BAD),
    ("mix", "h+FAFudwW8v7ike0RZHDffmyeYfPiYuzQMFuowMb5oU="),
    ("xor", "/fHl7Qv1ikwPKyL0lUzfSpezMzs/NQhXLd4oM2EV7rE=", "ktBTjeZq", XF_B81),
    ("mix", "uurIGtPeTc+ba1ChtLArhWmoRF/inQKroOVCnRWF95A="),
    ("xor", "x3pVPpO3HuDn6gWZWl2xZGMPKder59HOmXQapKYZFrc=", "UrW2YxI=", XF_C272),
    ("mix", "GXnh/ODoP1jQ1Bg4cK/2evHe1ftZq28kHUEjcNluJBs="),
    ("xor", "9tUZWeV9YLIXwIozINaRWJbShHyAkQqzK4DXjWNyxHE=", "eM8vlGc=", XF_C936),
    ("mix", "yxIDC/Gq/J7LOm/LFifOdFZQ7UQV3lKsaFz+PR3S+ak="),
]


def encrypt_resolve_token(en: str) -> str:
    rand = os.urandom(16)
    plain = rand + struct.pack("<Q", int(time.time() * 1000)) + en.encode("utf-8")
    cipher = AES.new(AES_KEY, AES.MODE_CBC, AES_IV)
    aes = bytearray(cipher.encrypt(pad(plain, 16)))

    h = hashlib.sha256(PREFIX + rand).digest()
    for i in range(len(aes)):
        if i % 32 == 0 and i > 0:
            h = hashlib.sha256(h).digest()
        aes[i] ^= h[i % 32]

    h2 = hashlib.sha256(AES_KEY + rand).digest()
    for i in range(len(aes)):
        k = h2[i % 32]
        aes[i] = (_rotl8(aes[i], k & 7) + (k ^ 165)) & 0xFF

    table = _perm256(rand + PREFIX + AES_IV)
    aes = bytearray(table[b] for b in aes)

    shuffled, block_order = _shuffle_blocks(bytes(aes), PREFIX + rand)
    aes = _apply_order(
        shuffled,
        _fy_order(len(shuffled), _xorshift(AES_KEY + rand + bytes([len(shuffled) & 0xFF]))),
    )

    order_buf = b"".join(struct.pack("<I", item) for item in block_order)
    mac = hashlib.sha256(order_buf + aes).digest()[:8]
    packet = b"\x01" + rand + struct.pack("<H", len(block_order)) + order_buf + aes + mac

    s = _encode_custom(packet)[::-1]
    data = s.encode("utf-8").hex().encode("utf-8")

    for step in PIPE:
        if step[0] == "mix":
            data = _rc4(base64.b64decode(step[1]), data)
        else:
            _, key, salt, xf = step
            data = _salted_xor(data, key, salt, xf)
    return _b64(data)


def decrypt_resolve_payload(value: str) -> Any:
    raw = _b64decode(value)
    if len(raw) < 44:
        raise ValueError("invalid VidCore encrypted response")
    salt = raw[:16]
    iv = raw[16:28]
    tag = raw[-16:]
    encrypted = raw[28:-16]
    master = hashlib.sha256(
        HEX_KEY + struct.pack("<Q", NUM_A) + struct.pack("<Q", NUM_B)
    ).digest()
    key = hashlib.sha256(master + salt).digest()
    cipher = AES.new(key, AES.MODE_GCM, nonce=iv)
    plain = cipher.decrypt_and_verify(encrypted, tag)
    if len(plain) < 8:
        raise ValueError("invalid VidCore payload")
    return json.loads(plain[8:].decode("utf-8"))


class VidCoreResolver:
    def __init__(self, debug: bool = False):
        self.debug = debug
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": UA,
            "Accept-Language": "en-US,en;q=0.9",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
        })

    def log(self, message: str):
        if self.debug:
            print(f"[VidCore] {message}")

    @staticmethod
    def _paths(tmdb_id: str, media_type: str, season=None, episode=None) -> list[str]:
        if media_type == "tv":
            if season is None or episode is None:
                raise ValueError("TV requires season and episode")
            suffix = f"tv/{tmdb_id}/{int(season)}/{int(episode)}"
        else:
            suffix = f"movie/{tmdb_id}"
        return [f"/embed/{suffix}", f"/{suffix}"]

    @staticmethod
    def _extract_en(page: str) -> str:
        decoded = html_lib.unescape(page)
        for pattern in (
            r'\\"en\\":\\"([^\\"]+)\\"',
            r'"en"\s*:\s*"([^"]+)"',
        ):
            match = re.search(pattern, decoded)
            if match:
                return match.group(1)
        raise ValueError("VidCore en token not found")

    def _bootstrap(self, tmdb_id: str, media_type: str, season=None, episode=None):
        last_error = None
        for origin in ORIGINS:
            for path in self._paths(tmdb_id, media_type, season, episode):
                url = origin + path
                try:
                    response = self.session.get(
                        url,
                        headers={
                            "Accept": "text/html,application/xhtml+xml",
                            "Referer": origin + "/",
                            "Origin": origin,
                        },
                        timeout=5.5,
                        allow_redirects=True,
                    )
                    if response.status_code != 200:
                        last_error = RuntimeError(f"{response.status_code} from {url}")
                        continue
                    en = self._extract_en(response.text)
                    scheme, rest = response.url.split("://", 1)
                    resolved_origin = f"{scheme}://{rest.split('/', 1)[0]}"
                    return resolved_origin, response.url, en
                except Exception as exc:
                    last_error = exc
        raise RuntimeError(f"VidCore bootstrap failed: {last_error}")

    def _list_servers(self, origin: str, referer: str, en: str) -> list[dict[str, Any]]:
        token = encrypt_resolve_token(en)
        response = self.session.post(
            f"{origin}{CATALOG_BASE}/{LIST_ACTION}/{token}",
            headers={
                "User-Agent": UA,
                "Accept": "*/*",
                "X-Requested-With": "XMLHttpRequest",
                "Referer": referer,
                "Origin": origin,
            },
            data="",
            timeout=5.5,
        )
        response.raise_for_status()
        data = decrypt_resolve_payload(response.text.strip())
        if not isinstance(data, list):
            raise RuntimeError("VidCore server list was not an array")
        by_name = {
            str(item.get("name") or ""): item
            for item in data
            if isinstance(item, dict) and item.get("data")
        }
        ordered = [by_name[name] for name in PREFERRED_SERVERS if name in by_name]
        ordered.extend(item for name, item in by_name.items() if name not in PREFERRED_SERVERS)
        return ordered[:6]

    def _unlock_one(self, origin: str, referer: str, server: dict[str, Any]):
        token = server.get("data")
        if not token:
            raise RuntimeError("VidCore server missing token")
        local = requests.Session()
        local.headers.update(self.session.headers)
        local.cookies.update(self.session.cookies)
        response = local.post(
            f"{origin}{CATALOG_BASE}/{STREAM_ACTION}/{token}",
            headers={
                "User-Agent": UA,
                "Accept": "*/*",
                "X-Requested-With": "XMLHttpRequest",
                "Referer": referer,
                "Origin": origin,
            },
            data="",
            timeout=5.5,
        )
        response.raise_for_status()
        config = decrypt_resolve_payload(response.text.strip())
        if not isinstance(config, dict) or not str(config.get("url") or "").startswith("http"):
            raise RuntimeError("VidCore stream config missing URL")
        name = str(server.get("name") or "VidCore")
        quality = "2160p" if "4k" in name.lower() else "Auto"
        return {
            "url": str(config["url"]),
            "type": "hls",
            "quality": quality,
            "server": name,
            "headers": {
                "Referer": origin + "/",
                "Origin": origin,
                "User-Agent": UA,
            },
        }

    def resolve(self, media_id: str | int, media_type: str = "movie", season=None, episode=None) -> str:
        if media_type not in {"movie", "tv"}:
            return json.dumps({"status": "error", "server": "VidCore", "message": "type must be movie or tv"})
        try:
            tmdb_id = str(int(media_id))
            origin, referer, en = self._bootstrap(tmdb_id, media_type, season, episode)
            servers = self._list_servers(origin, referer, en)
            if not servers:
                return json.dumps({"status": "notfound", "server": "VidCore", "message": "No VidCore servers returned"})

            playable = []
            with ThreadPoolExecutor(max_workers=min(5, len(servers))) as pool:
                futures = [pool.submit(self._unlock_one, origin, referer, item) for item in servers]
                for future in as_completed(futures):
                    try:
                        playable.append(future.result())
                    except Exception as exc:
                        self.log(str(exc))

            if not playable:
                return json.dumps({"status": "notfound", "server": "VidCore", "message": "No working VidCore streams"})
            playable.sort(key=lambda item: (0 if item["quality"] == "2160p" else 1, item["server"]))
            return json.dumps({
                "status": "success",
                "server": "VidCore",
                "id": tmdb_id,
                "type": media_type,
                "season": season,
                "episode": episode,
                "playable_urls": playable,
                "subtitles": [],
            })
        except Exception as exc:
            return json.dumps({"status": "error", "server": "VidCore", "message": str(exc)})
