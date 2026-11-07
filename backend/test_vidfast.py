"""Offline contract tests for the VidFast resolver."""
import json
import unittest
from unittest.mock import Mock

from providers.vidfast import VidFastResolver


class VidFastResolverTests(unittest.TestCase):
    def setUp(self):
        self.session = Mock()
        self.session.get.return_value = Mock(
            content=b'<video src="https://cdn.example.test/film.m3u8"></video>',
            text='<video src="https://cdn.example.test/film.m3u8"></video>',
        )
        self.resolver = VidFastResolver(session=self.session)

    def test_movie_media(self):
        result = json.loads(self.resolver.resolve("550"))
        self.assertEqual(result["status"], "success")
        self.assertEqual(result["playable_urls"][0]["type"], "hls")
        self.assertEqual(result["playable_urls"][0]["url"], "https://cdn.example.test/film.m3u8")
        self.assertIn("/movie/550", self.session.get.call_args.args[0])

    def test_tv_url(self):
        self.resolver.resolve("1396", "tv", 1, 2)
        self.assertIn("/tv/1396/1/2", self.session.get.call_args.args[0])

    def test_invalid_id_no_network(self):
        result = json.loads(self.resolver.resolve("../admin"))
        self.assertEqual(result["status"], "error")
        self.session.get.assert_not_called()

    def test_invalid_episode_no_network(self):
        result = json.loads(self.resolver.resolve("1396", "tv", 0, 1))
        self.assertEqual(result["status"], "error")
        self.session.get.assert_not_called()

    def test_no_direct_stream(self):
        self.session.get.return_value.text = '<iframe src="/player/550"></iframe>'
        self.session.get.return_value.content = b'<iframe src="/player/550"></iframe>'
        result = json.loads(self.resolver.resolve("550"))
        self.assertEqual(result["status"], "error")
        self.assertIn("embed_url", result)

    def test_non_media_url_rejected(self):
        self.session.get.return_value.text = '<video src="https://cdn.example.test/thumbnail.jpg"></video>'
        self.session.get.return_value.content = b'x'
        result = json.loads(self.resolver.resolve("550"))
        self.assertEqual(result["status"], "error")


if __name__ == "__main__":
    unittest.main()
