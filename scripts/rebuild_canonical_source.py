from pathlib import Path
import base64
import gzip

ROOT = Path(__file__).resolve().parents[1]

parts = []
for i in range(1, 9):
    parts.append((ROOT / "payload" / f"v5-{i}.txt").read_text(encoding="utf-8").strip())

html = gzip.decompress(base64.b64decode("".join(parts))).decode("utf-8")

# 1) Canonical occupied-seat behavior lives in the source itself.
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
    raise RuntimeError(f"Expected exactly 2 base seat click handlers, found {count}.")
html = html.replace(old_handler, new_handler)

# 2) Reservation Details fields are part of the primary RezMagic import model.
old_init = '''        byRez.set(rezId, {
          rez_id:rezId,
          reservation_comments:"",
          guest_comments:"",
          requests:new Set(),
          guests:new Set()
        });'''
new_init = '''        byRez.set(rezId, {
          rez_id:rezId,
          reservation_comments:"",
          guest_comments:"",
          requests:new Set(),
          guests:new Set(),
          created_on:"",
          start_date:"",
          end_date:"",
          category_name:"",
          category_code:"",
          occupancy_number:null,
          night_count:null,
          seat_upgrade_status:""
        });'''
if old_init not in html:
    raise RuntimeError("Reservation import initializer was not found.")
html = html.replace(old_init, new_init, 1)

old_target = '''      const target = byRez.get(rezId);

      const guestName = String(source.PartyName || "").trim();'''
new_target = '''      const target = byRez.get(rezId);
      target.created_on = target.created_on || String(source.CreatedOn || "").trim();
      target.start_date = target.start_date || String(source.AdjStartDate || "").trim();
      target.end_date = target.end_date || String(source.AdjEndDate || "").trim();
      target.category_name = target.category_name || String(source.PrimaryCategoryName || source.CategoryName || source.PrimaryCategory || source.Category || "").trim();
      target.category_code = target.category_code || String(source.PrimaryCategoryCode || "").trim();
      if (target.occupancy_number === null) {
        const occupancy = Number(String(source.Occupancy || source.OccupancyNumber || source.OccupancyNo || source.OccupancyCount || "").trim());
        target.occupancy_number = Number.isFinite(occupancy) && occupancy > 0 ? occupancy : null;
      }
      if (target.night_count === null) {
        const nights = Number(String(source.NightCount || "").trim());
        target.night_count = Number.isFinite(nights) ? nights : null;
      }
      const upgradeCode = String(source.AddOnCategoryName || "").trim();
      const upgradeProduct = String(source.AddOnProductName || "").trim();
      if (upgradeCode === "SUP") {
        target.seat_upgrade_status = "YES on reservation";
      }

      const guestName = String(source.PartyName || "").trim();'''
if old_target not in html:
    raise RuntimeError("Reservation import target block was not found.")
html = html.replace(old_target, new_target, 1)

# Insert the enriched reservation fields into the base v5 upsert payload using the
# stable requests anchor. The compressed base source does not already contain the
# newer reservation-detail fields, so matching an enriched payload here is brittle.
payload_anchor = '''      requests:[...v.requests],
'''
payload_fields = '''      requests:[...v.requests],
      created_on:v.created_on || null,
      start_date:v.start_date || null,
      end_date:v.end_date || null,
      category_name:v.category_name || null,
      category_code:v.category_code || null,
      occupancy_number:v.occupancy_number,
      night_count:v.night_count,
      seat_upgrade_status:v.seat_upgrade_status || null,
'''
payload_count = html.count(payload_anchor)
if payload_count != 1:
    raise RuntimeError(f"Expected exactly one reservation upsert requests anchor, found {payload_count}.")
html = html.replace(payload_anchor, payload_fields, 1)

html = html.replace(
    '<b>Upload whitelist:</b> Rez number, guest name, seat, sanitized comments/requests. Raw CSV, email, phone, address, balance/payment, and unrelated RezMagic fields are not stored.',
    '<b>Upload whitelist:</b> Rez number, guest name, seat, sanitized comments/requests, category name, category code, occupancy number, reservation date, check-in, check-out, length of stay, and seat-upgrade presence. Raw CSV, email, phone, address, balance/payment, and unrelated RezMagic fields are not stored.'
)

# 3) Reservation Details renders directly from the canonical reservation record.
helpers = r'''
function formatReservationDetailDate(raw) {
  if (!raw) return "Not available";
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? String(raw) : d.toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"});
}
function reservationDetailField(label, value) {
  return '<div class="rightRezField"><span>' + esc(label) + '</span><b>' + esc(value || "Not available") + '</b></div>';
}
function selectedGuestDisplayName(gs) {
  const guest = gs.find(g => String(g.id) === String(selectedGuest)) || gs[0];
  return guest?.guest_name || "Reservation";
}
'''
marker = 'function renderDetails() {'
if marker not in html:
    raise RuntimeError("renderDetails source function was not found.")
html = html.replace(marker, helpers + '\n' + marker, 1)

old_host = '''  host.innerHTML =
    '<div class="detailLabel">Guest to seat</div>' +'''
new_host = '''  const detailLength = record?.night_count !== null && record?.night_count !== undefined && record?.night_count !== ""
    ? String(record.night_count) + " night" + (String(record.night_count) === "1" ? "" : "s")
    : "Not available";

  host.innerHTML =
    '<div class="rightRezGuestName"><span>Viewing Guest</span><b>' + esc(selectedGuestDisplayName(gs)) + '</b></div>' +
    '<div class="rightRezGrid">' +
      reservationDetailField("Category Name", record?.category_name || "Not available") +
      reservationDetailField("Category Code", record?.category_code || "Not available") +
      reservationDetailField("Occupancy #", record?.occupancy_number !== null && record?.occupancy_number !== undefined ? String(record.occupancy_number) : "Not available") +
      reservationDetailField("Seat Upgrade Fee", record?.seat_upgrade_status || "Not available") +
      reservationDetailField("Date of Reservation", formatReservationDetailDate(record?.created_on)) +
      reservationDetailField("Check-In", formatReservationDetailDate(record?.start_date)) +
      reservationDetailField("Check-Out", formatReservationDetailDate(record?.end_date)) +
      reservationDetailField("Length of Stay", detailLength) +
    '</div><div class="rule"></div>' +
    '<div class="detailLabel">Guest to seat</div>' +'''
if old_host not in html:
    raise RuntimeError("Reservation details render block was not found.")
html = html.replace(old_host, new_host, 1)

# The historical section gets a permanent source-level mount in the reservation details.
# It is recreated by every native renderDetails() call, so the historical module cannot be
# wiped out by the app's lexical renderAll() function.
notes_anchor = '''    '<div class="rule"></div>' +
    '<h3>CHRISTY + CATHY NOTES</h3>' +'''
notes_with_history_mount = '''    '<div id="history2025Mount"></div>' +
    '<div class="rule"></div>' +
    '<h3>CHRISTY + CATHY NOTES</h3>' +'''
if notes_anchor not in html:
    raise RuntimeError("Christy + Cathy notes anchor was not found for the 2025 history mount.")
html = html.replace(notes_anchor, notes_with_history_mount, 1)

source_css = '''
#rightReservationCoreFields{margin:7px 0 11px;padding-bottom:10px;border-bottom:1px solid var(--line)}
.rightRezGrid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:8px 0 11px}
.rightRezField{padding:7px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;min-width:0}
.rightRezField span{display:block;font-size:8px;line-height:1.2;text-transform:uppercase;letter-spacing:.04em;font-weight:800;color:var(--muted);margin-bottom:2px}
.rightRezField b{display:block;font-size:10px;line-height:1.3;color:var(--navy);word-break:break-word}
.rightRezGuestName{margin:0 0 8px;padding:8px 9px;background:#eef3ff;border:1px solid #cfdbf5;border-radius:7px}
.rightRezGuestName span{display:block;font-size:8px;text-transform:uppercase;letter-spacing:.05em;font-weight:800;color:var(--muted);margin-bottom:2px}
.rightRezGuestName b{display:block;font-size:13px;line-height:1.25;color:var(--navy)}
'''
html = html.replace('</style>', source_css + '\n</style>', 1)

# 4) Keep current approved workflow functionality, but compile it into index.html.
#    Runtime patch files are no longer referenced by the deployed app.
css_extra = (ROOT / 'patch' / 'v6.css').read_text(encoding='utf-8')
html = html.replace('</style>', '\n' + css_extra + '\n</style>', 1)
for version in range(6, 12):
    js = (ROOT / 'patch' / f'v{version}.js').read_text(encoding='utf-8')
    html = html.replace('</body>', '<script>\n' + js + '\n</script>\n</body>', 1)

# Native room-availability inventory module.
availability_js = (ROOT / 'src' / 'room_availability.js').read_text(encoding='utf-8')
html = html.replace('</body>', '<script data-canonical-source="room-availability">\n' + availability_js + '\n</script>\n</body>', 1)

# Button copy cleanup requested by Christy.
html = html.replace('Work Group Seating', 'Group Seating')
html = html.replace('Work Room Upgrades', 'Room Upgrades')
html = html.replace('Room Upgrade Requests', 'Room Upgrades')

# No patch assets may be referenced by the canonical app.
import re
html = re.sub(r'\s*<link[^>]+href="patch/[^"]+"[^>]*>', '', html)
html = re.sub(r'\s*<script[^>]+src="patch/[^"]+"[^>]*></script>', '', html)

marker_text = '<!-- CANONICAL SOURCE: standalone source; no runtime patches; reservation details imported natively -->\n'
html = html.replace('<!doctype html>\n', '<!doctype html>\n' + marker_text, 1)

assert 'patch/' not in html, 'Canonical index still references a patch asset.'
assert 'created_on:v.created_on || null' in html
assert 'category_name:v.category_name || null' in html
assert 'category_code:v.category_code || null' in html
assert 'occupancy_number:v.occupancy_number' in html
assert 'night_count:v.night_count' in html
assert 'seat_upgrade_status:v.seat_upgrade_status || null' in html
assert 'YES on reservation' in html
assert 'Viewing Guest' in html
assert 'Category Name' in html
assert 'Category Code' in html
assert 'Occupancy #' in html
assert 'Room Upgrades' in html
assert 'id="history2025Mount"' in html
assert 'fsjw_room_availability_v1' in html
assert 'Import Room Availability CSV' in html

(ROOT / 'index.html').write_text(html, encoding='utf-8')
print('Rebuilt standalone canonical index.html with category name, category code, occupancy, reservation details, and permanent 2025 history mount.')
