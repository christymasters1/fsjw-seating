from pathlib import Path
import base64
import gzip

ROOT = Path(__file__).resolve().parents[1]

parts = []
for i in range(1, 9):
    path = ROOT / "payload" / f"v5-{i}.txt"
    parts.append(path.read_text(encoding="utf-8").strip())

packed = base64.b64decode("".join(parts))
html = gzip.decompress(packed).decode("utf-8")

old_handler = 'button.addEventListener("click", () => moveSelectedGuest(code));'
new_handler = '''button.addEventListener("click", () => {
    if (occupant) {
      selectedRez = String(occupant.rez_id);
      selectedGuest = occupant.guest_id || null;
      renderAll();
      setStatus("Opened " + occupant.guest_name + " · Rez #" + occupant.rez_id + " from " + code + ".", "ok");
      return;
    }
    moveSelectedGuest(code);
  });'''

count = html.count(old_handler)
if count != 2:
    raise RuntimeError(f"Expected exactly 2 base seat click handlers, found {count}. Refusing to rewrite source.")

html = html.replace(old_handler, new_handler)

# Preserve the existing non-seat workflow/detail enhancements while removing
# the v15 DOM seat-click interceptor. The base seat renderer now owns seat clicks.
existing_enhancements = (
    '<link rel="stylesheet" href="patch/v6.css?v=6">\n'
    '<script src="patch/v6.js?v=6"></script>\n'
    '<script src="patch/v7.js?v=7"></script>\n'
    '<script src="patch/v8.js?v=8"></script>\n'
    '<script src="patch/v9.js?v=9"></script>\n'
    '<script src="patch/v10.js?v=10"></script>\n'
    '<script src="patch/v11.js?v=11"></script>\n'
    '<script src="patch/v12.js?v=13"></script>\n'
    '<script src="patch/v13.js?v=13"></script>\n'
)

if "patch/v15.js" in html:
    raise RuntimeError("Compressed base unexpectedly contains v15; refusing to create mixed source.")

html = html.replace("</head>", '<link rel="stylesheet" href="patch/v6.css?v=6">\n</head>', 1)
script_enhancements = "".join(existing_enhancements.splitlines(keepends=True)[1:])
html = html.replace("</body>", script_enhancements + "</body>", 1)

marker = "<!-- CANONICAL SOURCE: occupied seats open their reservation; open seats move selected guest -->\n"
html = html.replace("<!doctype html>\n", "<!doctype html>\n" + marker, 1)

(ROOT / "index.html").write_text(html, encoding="utf-8")
print("Rebuilt canonical index.html from v5 payload with direct occupied-seat navigation.")
