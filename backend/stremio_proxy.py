import asyncio
import ipaddress
import socket
from urllib.parse import quote, urljoin, urlparse

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()
_ALLOWED_RESOURCES = {"catalog", "meta", "stream", "subtitles", "addon_catalog"}
_MAX_BYTES = 2_000_000
_MAX_REDIRECTS = 3
_HEADERS = {
    "accept": "application/json",
    "user-agent": "SynFlix/1.0 StremioAddonClient",
}


class ManifestRequest(BaseModel):
    url: str


class ResourceRequest(BaseModel):
    base_url: str
    resource: str
    type: str
    id: str


def _normalize_manifest_url(value: str) -> str:
    value = (value or "").strip()
    if not value:
        raise HTTPException(status_code=400, detail="Enter a Stremio add-on manifest URL.")
    if "://" not in value:
        value = f"https://{value}"
    parsed = urlparse(value)
    if parsed.scheme.lower() != "https":
        raise HTTPException(status_code=400, detail="SynFlix currently accepts public HTTPS add-ons only.")
    if not parsed.path.endswith("/manifest.json"):
        value = value.rstrip("/") + "/manifest.json"
    return value


async def _assert_public_https(url: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme.lower() != "https" or not parsed.hostname:
        raise HTTPException(status_code=400, detail="Only public HTTPS add-on URLs are supported.")
    if parsed.username or parsed.password:
        raise HTTPException(status_code=400, detail="Credentials in add-on URLs are not supported.")
    if parsed.port not in (None, 443):
        raise HTTPException(status_code=400, detail="Only the standard HTTPS port is supported.")

    def resolve():
        return socket.getaddrinfo(parsed.hostname, 443, type=socket.SOCK_STREAM)

    try:
        resolved = await asyncio.to_thread(resolve)
    except socket.gaierror as exc:
        raise HTTPException(status_code=400, detail="The add-on hostname could not be resolved.") from exc

    addresses = {item[4][0] for item in resolved if item and item[4]}
    if not addresses:
        raise HTTPException(status_code=400, detail="The add-on hostname could not be resolved.")
    for address in addresses:
        try:
            if not ipaddress.ip_address(address).is_global:
                raise HTTPException(status_code=400, detail="Private or local-network add-on addresses are blocked.")
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="The add-on resolved to an invalid network address.") from exc


async def _safe_json(url: str) -> tuple[dict, str]:
    current = url
    timeout = httpx.Timeout(12.0, connect=6.0)
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=False, headers=_HEADERS) as client:
        for _ in range(_MAX_REDIRECTS + 1):
            await _assert_public_https(current)
            try:
                response = await client.get(current)
            except httpx.HTTPError as exc:
                raise HTTPException(status_code=502, detail="The add-on did not respond.") from exc

            if response.status_code in {301, 302, 303, 307, 308}:
                target = response.headers.get("location")
                if not target:
                    raise HTTPException(status_code=502, detail="The add-on returned an invalid redirect.")
                current = urljoin(current, target)
                continue

            if response.status_code != 200:
                raise HTTPException(status_code=502, detail=f"The add-on returned HTTP {response.status_code}.")

            length = response.headers.get("content-length")
            if length and length.isdigit() and int(length) > _MAX_BYTES:
                raise HTTPException(status_code=502, detail="The add-on response is too large.")
            if len(response.content) > _MAX_BYTES:
                raise HTTPException(status_code=502, detail="The add-on response is too large.")
            try:
                payload = response.json()
            except ValueError as exc:
                raise HTTPException(status_code=502, detail="The add-on did not return valid JSON.") from exc
            if not isinstance(payload, dict):
                raise HTTPException(status_code=502, detail="The add-on returned an invalid JSON payload.")
            return payload, current

    raise HTTPException(status_code=502, detail="The add-on redirected too many times.")


def _validate_manifest(manifest: dict) -> None:
    for field in ("id", "name", "version", "resources", "types", "catalogs"):
        if field not in manifest:
            raise HTTPException(status_code=400, detail=f"The manifest is missing required field: {field}.")
    if not isinstance(manifest.get("id"), str) or not manifest["id"].strip():
        raise HTTPException(status_code=400, detail="The manifest has an invalid id.")
    if not isinstance(manifest.get("resources"), list) or not isinstance(manifest.get("types"), list):
        raise HTTPException(status_code=400, detail="The manifest resources or types are invalid.")
    if not isinstance(manifest.get("catalogs"), list):
        raise HTTPException(status_code=400, detail="The manifest catalogs field is invalid.")


@router.post("/stremio/manifest")
async def stremio_manifest(request: ManifestRequest):
    manifest_url = _normalize_manifest_url(request.url)
    manifest, final_url = await _safe_json(manifest_url)
    _validate_manifest(manifest)
    if not final_url.endswith("/manifest.json"):
        raise HTTPException(status_code=400, detail="The resolved add-on URL is not a Stremio manifest.")
    base_url = final_url[: -len("/manifest.json")]
    return {
        "manifest": manifest,
        "manifest_url": final_url,
        "base_url": base_url,
    }


@router.post("/stremio/resource")
async def stremio_resource(request: ResourceRequest):
    resource = (request.resource or "").strip()
    if resource not in _ALLOWED_RESOURCES:
        raise HTTPException(status_code=400, detail="Unsupported Stremio resource.")
    base_url = (request.base_url or "").strip().rstrip("/")
    await _assert_public_https(base_url)
    resource_url = (
        f"{base_url}/{quote(resource, safe='')}/"
        f"{quote(str(request.type), safe='')}/"
        f"{quote(str(request.id), safe='')}.json"
    )
    payload, _ = await _safe_json(resource_url)
    return payload
