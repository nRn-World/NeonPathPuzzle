"""Builds the CrazyGames archive: crazygames-upload/neon-path-puzzle-crazygames.zip

    python script/build-crazygames.py

Differences from the web build, all required by CrazyGames:
- CrazyGames SDK v3 instead of the Playgama bridge (no ads: Basic Launch forbids them)
- no Google sign-in script (VITE_GOOGLE_CLIENT_ID left empty)
- no service worker, so a new upload is never hidden behind a cached old one
"""
import os
import re
import shutil
import subprocess
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "dist-crazygames"
ZIP = ROOT / "crazygames-upload" / "neon-path-puzzle-crazygames.zip"
SDK = '<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>'

env = {**os.environ, "VITE_GOOGLE_CLIENT_ID": ""}
subprocess.run("npx vite build --outDir ../dist-crazygames --emptyOutDir", cwd=ROOT, env=env, shell=True, check=True)

index = OUT_DIR / "index.html"
html = index.read_text(encoding="utf-8")
html, removed = re.subn(r'\s*<script src="https://bridge\.playgama\.com[^"]*"></script>', "", html)
assert removed == 1, "Playgama bridge tag not found"
html = html.replace("</title>", "</title>\n    " + SDK, 1)
assert SDK in html
assert "accounts.google.com" not in html, "Google sign-in must stay out"
index.write_text(html, encoding="utf-8")
(OUT_DIR / "sw.js").unlink(missing_ok=True)

# Python zipfile, forward slashes: PowerShell's archiver writes backslash paths that portals reject.
ZIP.parent.mkdir(exist_ok=True)
ZIP.unlink(missing_ok=True)
with zipfile.ZipFile(ZIP, "w", zipfile.ZIP_DEFLATED) as archive:
    for file in sorted(OUT_DIR.rglob("*")):
        if file.is_file():
            archive.write(file, file.relative_to(OUT_DIR).as_posix())
names = zipfile.ZipFile(ZIP).namelist()
assert "index.html" in names and not any("\\" in name for name in names)
print(f"{ZIP} ({ZIP.stat().st_size / 1e6:.1f} MB, {len(names)} files)")
shutil.rmtree(OUT_DIR / ".vite", ignore_errors=True)
