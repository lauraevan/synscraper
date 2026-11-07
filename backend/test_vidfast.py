"""Offline contract tests for VidFast, no network or browser required."""
import json
import os
import unittest
from unittest.mock import MagicMock, Mock, patch

from providers.vidfast import VidFastResolver


class FakeResponse:
    def __init__(self, text="", media_type="text/html", content=None):
        self.text = text
        self.content = text.encode() if content is None else content
        self.headers = {"Content-Type": media_type}

    def raise_for_status(self):
        pass

    def iter_content(self, chunk_size=4096):
        yield self.content[:chunk_size]

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


class VidFastResolverTests(unittest.TestCase):
    def setUp(self):
        patcher = patch.dict(os.environ, {"VIDFAST_API": "0", "VIDFAST_BROWSER": "0"})
        patcher.start()
        self.addCleanup(patcher.stop)
        self.session = Mock()
        self.html = FakeResponse('<video src="https://cdn.example.test/film.m3u8"></video>')
        self.manifest = FakeResponse("#EXTM3U\n#EXT-X-VERSION:3", "application/vnd.apple.mpegurl")
        self.session.get.side_effect = lambda url, **kw: self.manifest if url.endswith(".m3u8") else self.html
        self.resolver = VidFastResolver(session=self.session)

    def test_movie_verified_hls(self):
        result = json.loads(self.resolver.resolve("550"))
        self.assertEqual(result["status"], "success")
        self.assertEqual(result["playable_urls"][0]["type"], "hls")
        self.assertEqual(result["playable_urls"][0]["url"], "https://cdn.example.test/film.m3u8")
        self.assertIn("/movie/550", self.session.get.call_args_list[0].args[0])

    def test_tv_url(self):
        self.resolver.resolve("1396", "tv", 1, 2)
        self.assertIn("/tv/1396/1/2", self.session.get.call_args_list[0].args[0])

    def test_invalid_id_no_network(self):
        result = json.loads(self.resolver.resolve("../admin"))
        self.assertEqual(result["status"], "error")
        self.session.get.assert_not_called()

    def test_invalid_episode_no_network(self):
        result = json.loads(self.resolver.resolve("1396", "tv", 0, 1))
        self.assertEqual(result["status"], "error")
        self.session.get.assert_not_called()

    def test_no_direct_stream(self):
        self.session.get.side_effect = lambda url, **kw: FakeResponse('<iframe src="/player/550"></iframe>')
        result = json.loads(self.resolver.resolve("550"))
        self.assertEqual(result["status"], "error")
        self.assertIn("embed_url", result)

    def test_non_media_url_rejected(self):
        self.session.get.side_effect = lambda url, **kw: FakeResponse('<video src="https://cdn.example.test/thumbnail.jpg"></video>')
        result = json.loads(self.resolver.resolve("550"))
        self.assertEqual(result["status"], "error")

    def test_invalid_manifest_not_reported_playable(self):
        self.session.get.side_effect = lambda url, **kw: FakeResponse("not a manifest") if url.endswith(".m3u8") else self.html
        result = json.loads(self.resolver.resolve("550"))
        self.assertEqual(result["status"], "error")

    def test_verified_mp4(self):
        self.html = FakeResponse('<source src="https://cdn.example.test/film.mp4">')
        self.session.get.side_effect = lambda url, **kw: FakeResponse("", "video/mp4") if url.endswith(".mp4") else self.html
        result = json.loads(self.resolver.resolve("550"))
        self.assertEqual(result["playable_urls"][0]["type"], "mp4")

    def test_dash_not_returned_to_hls_only_player(self):
        self.session.get.side_effect = lambda url, **kw: FakeResponse('<source src="https://cdn.example.test/film.mpd">')
        result = json.loads(self.resolver.resolve("550"))
        self.assertEqual(result["status"], "error")

    def test_direct_api_full_handshake_and_server_decryption(self):
        """Simulate the published multi-stage VidFast protocol end-to-end."""
        def data(payload=None, text=""):
            response = Mock()
            response.json.return_value = payload
            response.text = text
            return response

        self.session.get.side_effect = [
            data(text='window.__NEXT_DATA__={\\"token\\":\\"page-token\\"}'),
            data({"status": 200, "result": {"stage1": "https://vidfast.vc/api/probe", "token": "csrf-1"}}),
            data({"status": 200, "result": {
                "servers": "https://vidfast.vc/api/servers",
                "stream": "https://vidfast.vc/api/stream",
                "token": "csrf-2",
            }}),
        ]
        self.session.post.side_effect = [
            data(text="probe-encrypted"),
            data(text="servers-encrypted"),
            data({"status": 200, "result": [{"name": "Alpha", "data": "server-token"}]}),
        ]
        worker_session = MagicMock()
        worker_session.post.side_effect = [
            data(text="stream-encrypted"),
            data({"status": 200, "result": {"url": "https://media.example.test/master.m3u8"}}),
        ]
        worker_session.__enter__.return_value = worker_session
        with patch.dict(os.environ, {"VIDFAST_API": "1"}), patch(
            "providers.vidfast.VidFastResolver._make_session", return_value=worker_session
        ):
            result = json.loads(self.resolver.resolve("550"))
        self.assertEqual(result["status"], "success")
        self.assertEqual(result["playable_urls"][0]["server"], "Alpha")
        self.assertEqual(result["playable_urls"][0]["type"], "hls")
        self.assertIn("/api/stream/server-token", worker_session.post.call_args_list[0].args[0])

    def test_browser_fallback_result_contract(self):
        self.session.get.side_effect = lambda url, **kw: FakeResponse("<div>dynamic player</div>")
        with patch.object(self.resolver, "_capture_browser_media", return_value=[{
            "url": "https://cdn.example.test/master.m3u8", "type": "hls",
            "quality": "Auto", "server": "VidFast",
            "headers": {"Referer": "https://vidfast.vc/movie/550"},
        }]) as browser:
            result = json.loads(self.resolver.resolve("550"))
        browser.assert_called_once()
        self.assertEqual(result["status"], "success")
        self.assertEqual(len(result["playable_urls"]), 1)


if __name__ == "__main__":
    unittest.main()
