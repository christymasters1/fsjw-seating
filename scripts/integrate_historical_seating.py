from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
SOURCE = ROOT / "src" / "historical_seating.js"

html = INDEX.read_text(encoding="utf-8")
js = SOURCE.read_text(encoding="utf-8")

# Historical seating is a canonical source module compiled into the standalone app.
# Remove a prior compiled copy so this build step is idempotent.
html = re.sub(
    r'\n?<script data-canonical-source="historical-seating">.*?</script>\n?',
    '\n',
    html,
    flags=re.S,
)

block = '<script data-canonical-source="historical-seating">\n' + js + '\n</script>\n'
if "</body>" not in html:
    raise RuntimeError("index.html is missing </body>.")
html = html.replace("</body>", block + "</body>", 1)

# Legacy 2025 logic may still be compiled from the old v9 source for unrelated
# workbench behavior. The native historical module owns the button, display,
# data tables and map overlay, and removes any legacy historical panel at render.

required = [
    'data-canonical-source="historical-seating"',
    'historical_guest_records',
    'historical_links',
    'Show 2025 Seating',
    '2025 Seating',
    '2025 Comments',
    '2025 Linked Guests',
    'Import 2025 Seating',
]
for token in required:
    if token not in html:
        raise RuntimeError(f"Historical seating integration missing: {token}")

INDEX.write_text(html, encoding="utf-8")
print("Integrated native historical seating source into canonical index.html.")
