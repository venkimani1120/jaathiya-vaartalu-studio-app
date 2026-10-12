# After editing build_locations.py (or locations.json), run:  python3 shared/sync_locations.py
# Copies the data to the server, the mobile app and the e-paper studio.
import json, re, shutil, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
src = root / "shared" / "locations.json"
shutil.copy(src, root / "server/src/config/locations.json")
shutil.copy(src, root / "mobile/src/locations.json")
studio = root / "server/public/epaper-studio.html"
data = json.dumps(json.load(open(src)), ensure_ascii=False, separators=(",", ":"))
html = studio.read_text()
html, n = re.subn(r"/\*LOCATIONS\*/.*?/\*END_LOCATIONS\*/", lambda m: f"/*LOCATIONS*/{data}/*END_LOCATIONS*/", html, flags=re.S)
assert n == 1, "studio marker not found"
studio.write_text(html)
print("Synced locations to server, mobile and studio")
