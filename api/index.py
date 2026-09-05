from http.server import BaseHTTPRequestHandler
from pathlib import Path

PUBLIC_DIR = Path(__file__).resolve().parents[1] / "public"
INDEX_FILE = PUBLIC_DIR / "index.html"


class handler(BaseHTTPRequestHandler):
    def _serve_index(self, include_body=True):
        try:
            body = INDEX_FILE.read_bytes()
        except OSError:
            body = b"SynPlayer API page is unavailable."
            self.send_response(500)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            if include_body:
                self.wfile.write(body)
            return

        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if include_body:
            self.wfile.write(body)

    def do_GET(self):
        self._serve_index(True)

    def do_HEAD(self):
        self._serve_index(False)
