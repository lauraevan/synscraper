"""No-network regression tests for all public Synscraper provider contracts."""

import asyncio
import json
import unittest
from contextlib import redirect_stdout
from io import StringIO
from unittest.mock import patch

import provider_api
import scraper
import synscraper_cli


class ProviderContractTests(unittest.TestCase):
    def test_all_provider_modules_are_in_one_registry(self):
        ids = [provider_id for _, provider_id, _ in scraper.PROVIDERS]
        self.assertEqual(len(ids), len(set(ids)))
        self.assertEqual(set(ids), {
            "orlando", "vidy", "castle", "vidlink", "vidnest", "vidzee",
            "vidrock", "cinejoy", "vidcore", "vidfast", "vixsrc",
        })

    def test_catalog_is_derived_from_registry(self):
        payload = provider_api.list_providers()
        self.assertEqual(payload["count"], len(scraper.PROVIDERS))
        self.assertEqual(
            [provider["id"] for provider in payload["providers"]],
            [item[1] for item in scraper.PROVIDERS],
        )
        vidy = next(x for x in payload["providers"] if x["id"] == "vidy")
        self.assertIn("anime", vidy["media_types"])

    def test_media_validation(self):
        provider_api.validate_request("movie", "550")
        provider_api.validate_request("tv", "1399", 1, 2)
        provider_api.validate_request("anime", "16498", episode=1, provider="vidy")
        for typ, ident, season, episode, provider in [
            ("bad", "550", None, None, None),
            ("movie", "../admin", None, None, None),
            ("tv", "1399", None, 1, None),
            ("tv", "1399", 1, None, None),
            ("anime", "16498", None, 1, None),
            ("movie", "0", None, None, None),
        ]:
            with self.assertRaises(ValueError):
                provider_api.validate_request(typ, ident, season, episode, provider)
        with self.assertRaises(LookupError):
            provider_api.validate_request("movie", "550", provider="bogus")

    def test_public_urls_preserve_legacy_payload_and_captions(self):
        original = {
            "type": "movie", "id": "550", "count": 1,
            "servers": [{
                "id": "vidfast-0",
                "provider": "vidfast",
                "play_url": "/api/hls?url=https%3A%2F%2Fcdn.test%2Fx.m3u8",
                "captions": [{"play_url": "/api/caption?url=https%3A%2F%2Fcdn.test%2Fsub.vtt"}],
            }],
        }
        new = provider_api.public_stream_response(original, "https://media.example.org/")
        self.assertEqual(new["version"], "1")
        self.assertEqual(new["count"], 1)
        self.assertEqual(
            new["servers"][0]["play_url"],
            "https://media.example.org/api/hls?url=https%3A%2F%2Fcdn.test%2Fx.m3u8",
        )
        self.assertTrue(new["servers"][0]["captions"][0]["play_url"].startswith("https://media.example.org/"))
        self.assertTrue(original["servers"][0]["play_url"].startswith("/api/"))
        self.assertTrue(original["servers"][0]["captions"][0]["play_url"].startswith("/api/"))

    def test_absolute_urls_are_not_rewritten(self):
        self.assertEqual(
            provider_api.absolute_url("https://cdn.example.org/x", "https://api.example.org"),
            "https://cdn.example.org/x",
        )

    def test_cli_lists_all_without_network(self):
        output = StringIO()
        with redirect_stdout(output):
            code = synscraper_cli.main(["list"])
        self.assertEqual(code, 0)
        self.assertEqual(json.loads(output.getvalue())["count"], len(scraper.PROVIDERS))

    def test_cli_resolves_using_shared_scraper(self):
        async def fake_scrape(*args, **kwargs):
            self.assertEqual(args[:2], ("movie", "550"))
            self.assertEqual(kwargs["provider_id"], "vidfast")
            return [{"provider": "vidfast", "url": "https://media.example.org/master.m3u8"}]

        output = StringIO()
        with patch.object(scraper, "scrape_streams", fake_scrape), redirect_stdout(output):
            code = synscraper_cli.main(["resolve", "--id", "550", "--provider", "vidfast"])
        self.assertEqual(code, 0)
        self.assertEqual(json.loads(output.getvalue())["count"], 1)


if __name__ == "__main__":
    unittest.main()
