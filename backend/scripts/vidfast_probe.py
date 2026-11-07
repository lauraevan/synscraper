"""Diagnostic network probe; prints no CDN URLs, cookies, tokens or manifests."""
import os
from collections import Counter
from urllib.parse import urlparse
import requests
from playwright.sync_api import sync_playwright

url = os.environ.get("VIDFAST_TEST_URL", "https://vidfast.vc/movie/550?autoPlay=true")
try:
    r = requests.get(url, timeout=8)
    print("plain_http_status:", r.status_code, "bytes:", len(r.content))
except Exception as e:
    print("plain_http_failure:", type(e).__name__)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=os.environ.get("VIDFAST_HEADFUL") != "1")
    try:
        ctx = browser.new_context(user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
        page = ctx.new_page()
        stats = Counter()
        sampled = set()
        page.on("response", lambda response: (
            stats.update([f"{response.status} {urlparse(response.url).hostname}"]),
            sampled.add((response.status, urlparse(response.url).hostname, urlparse(response.url).path.split("/")[-1][:28]))
        ))
        try:
            response = page.goto(url, wait_until="domcontentloaded", timeout=16000)
            print("navigation_status:", response.status if response else None)
        except Exception as e:
            print("navigation_error:", type(e).__name__, str(e)[:160])
        page.wait_for_timeout(3000)
        print("document_title:", repr(page.title()[:90]))
        print("video_elements:", page.locator("video").count())
        print("iframe_elements:", page.locator("iframe").count())
        print("button_elements:", page.locator("button").count())
        try:
            page.mouse.click(640, 360)
        except Exception:
            pass
        page.wait_for_timeout(6500)
        print("frame_count:", len(page.frames))
        print("response_status_host_counts:", stats.most_common(12))
        print("response_paths_sample:", sorted(sampled)[:30])
        print("current_host:", urlparse(page.url).hostname)
    finally:
        browser.close()
