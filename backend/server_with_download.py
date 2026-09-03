"""SynScraper API with the 1080p serverless download routes mounted."""

from server import app
from download_worker import router as download_router

# Keep the existing API untouched and mount downloads alongside it.
app.include_router(download_router, prefix="/api")
