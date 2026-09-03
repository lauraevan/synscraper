from pathlib import Path


def replace_once(path: str, old: str, new: str):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise RuntimeError(f"patch marker missing in {path}: {old!r}")
    p.write_text(text.replace(old, new, 1))


replace_once(
    "backend/scraper.py",
    '    ("CineJoy", "cinejoy", ("providers.cinejoy", "CineJoyResolver")),\n    ("Vix", "vixsrc", ("providers.vixsrc", "VixSrcResolver")),',
    '    ("CineJoy", "cinejoy", ("providers.cinejoy", "CineJoyResolver")),\n    ("VidCore", "vidcore", ("providers.vidcore", "VidCoreResolver")),\n    ("Vix", "vixsrc", ("providers.vixsrc", "VixSrcResolver")),',
)

replace_once(
    "frontend/src/components/SynapsePlayer.jsx",
    '    { provider: "cinejoy", name: "Lisbon" },\n    { provider: "vixsrc", name: "Vix" },',
    '    { provider: "cinejoy", name: "Lisbon" },\n    { provider: "vidcore", name: "VidCore" },\n    { provider: "vixsrc", name: "Vix" },',
)

print("VidCore integration markers applied")
