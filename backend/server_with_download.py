"""SynScraper API with the 1080p serverless download routes mounted."""

from server import app
from download_worker_v2 import router as download_router
from jumpscares import router as jumpscare_router
from stremio_proxy import router as stremio_router

# Keep the existing API untouched and mount downloads, lightweight metadata,
# and the guarded Stremio protocol bridge alongside it.
app.include_router(download_router, prefix="/api")
app.include_router(jumpscare_router, prefix="/api")
app.include_router(stremio_router, prefix="/api")
