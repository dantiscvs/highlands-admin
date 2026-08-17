function renderSidebarTripsList() {
  document.getElementById('sidebar').innerHTML = `
    <div class="brand">🗺️ Trip Tracker</div>
    <div class="navitem on" onclick="goTrips()"><span class="navicon">${NAV_ICONS.overview}</span><span>My trips</span></div>
    <div class="sidebar-foot">
      ${themeToggleHtml()}
      <div class="navitem" onclick="signOut()"><span class="navicon">${NAV_ICONS.logout}</span><span>Sign out</span></div>
    </div>
  `;
}

async function renderTripsListPage() {
  const main = document.getElementById('main');
  main.innerHTML = `<div class="pagehead"><div><h1>My trips</h1><div class="subtitle">Everything you organize or ride.</div></div></div><div id="tripsListBody">Loading…</div>`;

  const { data: memberships, error } = await db().from('trip_memberships').select('trip_id, role').eq('user_id', currentUser.id);
  if (error) { document.getElementById('tripsListBody').textContent = 'Failed to load trips: ' + error.message; return; }
  const tripIds = memberships.map(m => m.trip_id);
  let trips = [];
  if (tripIds.length) {
    const { data } = await db().from('trips').select('*').in('id', tripIds).order('created_at', { ascending: false });
    trips = data || [];
  }
  const roleByTrip = {}; memberships.forEach(m => roleByTrip[m.trip_id] = m.role);

  const body = document.getElementById('tripsListBody');
  body.innerHTML = `
    ${trips.length ? `<div class="tripgrid" style="margin-bottom:28px;">
      ${trips.map(t => `
        <div class="tripcard" onclick="goTrip('${t.id}')">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <div style="font-weight:700;font-size:15px;">${esc(t.name)}</div>
            <span class="badge ${t.status==='active'?'badge-green':t.status==='archived'?'badge-gray':'badge-blue'}">${t.status}</span>
          </div>
          <div class="muted" style="font-size:12px;margin-top:6px;">${t.start_date ? fmtDate(t.start_date) + ' – ' + fmtDate(t.end_date) : 'No dates set'}</div>
          <div style="margin-top:8px;">${activityBadgeHtml(t)}</div>
          <div class="muted" style="font-size:11px;margin-top:8px;">Role: ${roleByTrip[t.id]}</div>
        </div>
      `).join('')}
    </div>` : `<p class="muted" style="margin-bottom:24px;">No trips yet — start with one of the options below.</p>`}

    <h2>Start a new trip</h2>
    <div class="entrypoints">
      <button class="entrypoint primary" onclick="openImportRouteModal()">
        <div class="ico">🛰️</div><div class="ttl">Import a route</div>
        <div class="desc">Upload any GPX or spreadsheet (CSV or XLSX) to start populating the data in Trip Tracker. The fastest way to get a populated trip.</div>
      </button>
      ${trips.length ? `<button class="entrypoint" onclick="openDuplicateModal(${JSON.stringify(trips.filter(t=>roleByTrip[t.id]==='owner'||roleByTrip[t.id]==='editor')).replace(/"/g,'&quot;')})">
        <div class="ico">📑</div><div class="ttl">Duplicate a previous trip</div>
        <div class="desc">Same structure, route and packing list. Cleared dates, bookings and expenses.</div>
      </button>` : ''}
      <button class="entrypoint" onclick="openTemplateModal()">
        <div class="ico">📐</div><div class="ttl">Start from a template</div>
        <div class="desc">3-day weekend, 7-day toured trip, or 14-day expedition. Seeds structure, not geography.</div>
      </button>
      <button class="entrypoint" onclick="openBlankModal()">
        <div class="ico">➕</div><div class="ttl">Start blank</div>
        <div class="desc">For when nothing above fits.</div>
      </button>
    </div>
  `;
}

function closeAnyModal() {
  const el = document.getElementById('genericModal');
  if (el) el.remove();
}
function showModal(html) {
  closeAnyModal();
  const wrap = document.createElement('div');
  wrap.id = 'genericModal';
  wrap.className = 'modal-ov';
  wrap.innerHTML = `<div class="modal">${html}</div>`;
  wrap.addEventListener('click', (e) => { if (e.target === wrap) closeAnyModal(); });
  document.body.appendChild(wrap);
}

function openBlankModal() {
  showModal(`
    <h2>Start blank</h2>
    <div class="field"><label>Trip name</label><input id="mName" type="text" placeholder="e.g. Peaks Loop 2027"></div>
    <div class="field"><label>Trip type</label><select id="mActivityType">${activityTypeOptionsHtml('cycling')}</select></div>
    <div class="field"><label>Number of days</label><input id="mDays" type="number" value="5" min="1" max="60"></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;">
      <button class="btn" onclick="closeAnyModal()">Cancel</button>
      <button class="btn btn-primary" onclick="createBlankTrip()">Create</button>
    </div>
  `);
}
async function createBlankTrip() {
  const name = document.getElementById('mName').value.trim() || 'Untitled trip';
  const activity_type = document.getElementById('mActivityType').value;
  const days = Math.max(1, parseInt(document.getElementById('mDays').value, 10) || 1);
  const { data: trip, error } = await db().from('trips').insert({ owner_id: currentUser.id, name, activity_type, slug: slugify(name), status: 'draft', enabled_modules: ['route','accommodation','resupply'] }).select('id').single();
  if (error) { alert(error.message); return; }
  const dayRows = Array.from({ length: days }, (_, i) => ({ trip_id: trip.id, day_number: i + 1, title: `Day ${i + 1}`, order_index: i + 1 }));
  await db().from('trip_days').insert(dayRows);
  closeAnyModal(); goTrip(trip.id);
}
function slugify(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Math.random().toString(36).slice(2, 8); }

function openTemplateModal() {
  showModal(`
    <h2>Start from a template</h2>
    <div class="field"><label>Trip name</label><input id="mName" type="text" placeholder="e.g. Autumn Weekend"></div>
    <div class="field">
      <label>Template</label>
      <select id="mTemplate">
        <option value="weekend">3-day weekend</option>
        <option value="toured">7-day toured trip (booked accommodation)</option>
        <option value="expedition">14-day expedition (camping + resupply)</option>
      </select>
    </div>
    <div class="field"><label>Trip type</label><select id="mActivityType">${activityTypeOptionsHtml('cycling')}</select></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;">
      <button class="btn" onclick="closeAnyModal()">Cancel</button>
      <button class="btn btn-primary" onclick="createFromTemplate()">Create</button>
    </div>
  `);
}
async function createFromTemplate() {
  const name = document.getElementById('mName').value.trim() || 'Untitled trip';
  const template = document.getElementById('mTemplate').value;
  const activity_type = document.getElementById('mActivityType').value;
  try {
    const { data: tripId, error } = await db().rpc('create_trip_from_template', { p_template: template, p_name: name });
    if (error) throw error;
    await db().from('trips').update({ activity_type }).eq('id', tripId);
    closeAnyModal(); goTrip(tripId);
  } catch (e) { alert(e.message); }
}

function openDuplicateModal(trips) {
  showModal(`
    <h2>Duplicate a trip</h2>
    <div class="field">
      <label>Source trip</label>
      <select id="mSource">${trips.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select>
    </div>
    <div class="field"><label>New trip name</label><input id="mName" type="text" placeholder="e.g. Highlands 2027"></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;">
      <button class="btn" onclick="closeAnyModal()">Cancel</button>
      <button class="btn btn-primary" onclick="doDuplicate()">Duplicate</button>
    </div>
  `);
}
async function doDuplicate() {
  const sourceId = document.getElementById('mSource').value;
  const name = document.getElementById('mName').value.trim() || 'Untitled trip (copy)';
  try {
    const { data: tripId, error } = await db().rpc('duplicate_trip', { p_source_trip_id: sourceId, p_new_name: name });
    if (error) throw error;
    closeAnyModal(); goTrip(tripId);
  } catch (e) { alert(e.message); }
}

// ---- Import a route (GPX, or a CSV/XLSX spreadsheet) ----
// GPX path: simplified vs. the full spec — splits evenly by distance into N
// days rather than detecting multi-day stage boundaries or named waypoints.
// CSV/XLSX path: one row per day, heuristic column mapping (day/date/title/
// distance/ascent/accommodation/notes) — same column names the Imports tab's
// document-import heuristic understands, so the two stay predictable together.
// Flagged as a known limitation in the delivery report.
function openImportRouteModal() {
  showModal(`
    <h2>Import a route</h2>
    <p class="muted" style="margin-bottom:14px;font-size:12px;">Upload a GPX track, or a CSV/XLSX spreadsheet with one row per day (columns: day, date, title, distance, ascent, accommodation, notes). You can adjust everything afterwards in the grid.</p>
    <div class="field"><label>Trip name</label><input id="mName" type="text" placeholder="e.g. Peaks Loop 2027"></div>
    <div class="field"><label>Trip type</label><select id="mActivityType">${activityTypeOptionsHtml('cycling')}</select></div>
    <div class="field"><label>File (GPX, CSV or XLSX)</label><input id="mGpx" type="file" accept=".gpx,.csv,.xlsx,.xls"></div>
    <div class="field" id="mDaysField"><label>Split into how many days? <span class="muted" style="font-weight:400;">(GPX only — spreadsheets use one row per day)</span></label><input id="mDays" type="number" value="5" min="1" max="60"></div>
    <div id="gpxPreview" class="muted" style="font-size:12px;margin-bottom:10px;"></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;">
      <button class="btn" onclick="closeAnyModal()">Cancel</button>
      <button class="btn btn-primary" onclick="doImportRoute()">Import & create trip</button>
    </div>
  `);
}
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371, toRad = x => x * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
function parseGpx(text) {
  const re = /<trkpt\s+lat="(-?[\d.]+)"\s+lon="(-?[\d.]+)"[^>]*>\s*<ele>(-?[\d.]+)<\/ele>/g;
  const pts = []; let m;
  while ((m = re.exec(text))) pts.push({ lat: parseFloat(m[1]), lon: parseFloat(m[2]), ele: parseFloat(m[3]) });
  let dist = 0, ascent = 0;
  for (let i = 1; i < pts.length; i++) {
    dist += haversineKm(pts[i-1].lat, pts[i-1].lon, pts[i].lat, pts[i].lon);
    const diff = pts[i].ele - pts[i-1].ele;
    if (diff > 0) ascent += diff;
  }
  return { pts, totalKm: dist, totalAscent: Math.round(ascent) };
}
function fileKind(name) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (ext === 'gpx') return 'gpx';
  if (ext === 'xlsx' || ext === 'xls') return 'xlsx';
  return 'csv';
}
function splitDelimited(line) {
  // Heuristic delimiter pick per line rather than a single sniff, so ragged
  // CSV/TSV exports (mixed quoting, trailing commas) don't derail every row.
  if (line.includes('\t')) return line.split('\t');
  const semi = (line.match(/;/g) || []).length, comma = (line.match(/,/g) || []).length;
  return line.split(semi > comma ? ';' : ',');
}
function parseCsvRows(text) {
  return text.split(/\r?\n/).filter(l => l.trim()).map(l => splitDelimited(l).map(c => c.trim().replace(/^"|"$/g, '')));
}
async function parseXlsxRows(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: '', raw: false })
    .map(row => row.map(c => String(c == null ? '' : c).trim()))
    .filter(row => row.some(c => c));
}
// Same column vocabulary as the Imports tab's document-import heuristic
// (functions/import-extract), so a spreadsheet works predictably whichever
// entry point you use it from.
const TABULAR_COL_MAP = {
  day: 'dayNumber', 'day number': 'dayNumber', '#': 'dayNumber',
  date: 'date', title: 'title', name: 'title', route: 'title',
  distance: 'distance_km', 'distance (km)': 'distance_km', km: 'distance_km',
  ascent: 'ascent_m', elevation: 'ascent_m', 'elevation (m)': 'ascent_m',
  accommodation: 'accommodation_name', hotel: 'accommodation_name', stay: 'accommodation_name',
  notes: 'notes', description: 'description',
};
function normalizeDateStr(s) {
  if (!s) return null;
  s = String(s).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; // assumes D/M/Y
  const d = new Date(s);
  return isNaN(d) ? null : d.toISOString().slice(0, 10); // unrecognized format — skip rather than risk a failed insert
}
function rowsToDays(rows) {
  if (rows.length < 2) return [];
  const headers = rows[0].map(h => String(h || '').trim().toLowerCase());
  const days = [];
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    if (!cells.some(c => String(c || '').trim())) continue;
    const day = { day_number: days.length + 1, title: null, date: null, distance_km: null, ascent_m: null, accommodation_name: null, notes: null };
    headers.forEach((h, i) => {
      const field = TABULAR_COL_MAP[h];
      const raw = cells[i] == null ? '' : String(cells[i]).trim();
      if (!field || !raw) return;
      if (field === 'dayNumber') { const n = parseInt(raw, 10); if (!isNaN(n)) day.day_number = n; }
      else if (field === 'distance_km' || field === 'ascent_m') { const n = parseFloat(raw.replace(',', '.')); if (!isNaN(n)) day[field] = n; }
      else if (field === 'date') day.date = normalizeDateStr(raw);
      else day[field] = raw;
    });
    days.push(day);
  }
  return days;
}
async function parseTabularFile(file) {
  const rows = fileKind(file.name) === 'xlsx' ? await parseXlsxRows(file) : parseCsvRows(await file.text());
  return rowsToDays(rows);
}
async function doImportRoute() {
  const name = document.getElementById('mName').value.trim() || 'Untitled trip';
  const activity_type = document.getElementById('mActivityType').value;
  const file = document.getElementById('mGpx').files[0];
  if (!file) { alert('Choose a file first.'); return; }
  const kind = fileKind(file.name);

  let dayRows;
  let modules = ['route', 'accommodation', 'resupply'];
  if (kind === 'gpx') {
    const days = Math.max(1, parseInt(document.getElementById('mDays').value, 10) || 1);
    const parsed = parseGpx(await file.text());
    if (parsed.pts.length < 2) { alert('Could not read any track points from this file.'); return; }
    const kmPerDay = parsed.totalKm / days, ascentPerDay = parsed.totalAscent / days;
    dayRows = Array.from({ length: days }, (_, i) => ({
      day_number: i + 1, title: `Day ${i + 1}`, order_index: i + 1,
      distance_km: Math.round(kmPerDay * 10) / 10, ascent_m: Math.round(ascentPerDay),
    }));
    modules = ['route', 'gpx', 'elevation', 'accommodation', 'resupply'];
  } else {
    const parsedDays = await parseTabularFile(file);
    if (!parsedDays.length) { alert('Could not find any day rows in this file. Expected a header row with columns like day/date/title/distance/ascent/accommodation/notes.'); return; }
    dayRows = parsedDays.map((d, i) => ({
      day_number: d.day_number || i + 1, order_index: d.day_number || i + 1,
      title: d.title || `Day ${d.day_number || i + 1}`, date: d.date || null,
      distance_km: d.distance_km, ascent_m: d.ascent_m, notes: d.notes || d.description || null,
    }));
  }

  const { data: trip, error } = await db().from('trips').insert({ owner_id: currentUser.id, name, activity_type, slug: slugify(name), status: 'draft', enabled_modules: modules }).select('id').single();
  if (error) { alert(error.message); return; }

  const { data: insertedDays } = await db().from('trip_days').insert(dayRows.map(d => ({ ...d, trip_id: trip.id }))).select('id, day_number');
  if (kind !== 'gpx' && insertedDays) {
    const byNumber = {}; insertedDays.forEach(d => byNumber[d.day_number] = d.id);
    const stays = (await parseTabularFile(file)).filter(d => d.accommodation_name).map(d => ({
      trip_id: trip.id, day_id: byNumber[d.day_number], name: d.accommodation_name,
    })).filter(s => s.day_id);
    if (stays.length) await db().from('accommodations').insert(stays);
  }
  closeAnyModal(); goTrip(trip.id);
}
document.addEventListener('change', (e) => {
  if (!(e.target && e.target.id === 'mGpx' && e.target.files[0])) return;
  const file = e.target.files[0];
  const kind = fileKind(file.name);
  const el = document.getElementById('gpxPreview');
  const daysField = document.getElementById('mDaysField');
  if (daysField) daysField.style.display = kind === 'gpx' ? '' : 'none';
  if (kind === 'gpx') {
    file.text().then(t => {
      const p = parseGpx(t);
      if (el) el.textContent = p.pts.length ? `${p.totalKm.toFixed(1)} km · ${p.totalAscent} m ascent · ${p.pts.length} points` : 'No track points found.';
    });
  } else {
    parseTabularFile(file).then(days => {
      if (el) el.textContent = days.length ? `${days.length} day row(s) found.` : 'No day rows recognized — check the header row has columns like day/date/title/distance.';
    }).catch(err => { if (el) el.textContent = 'Could not read this file: ' + err.message; });
  }
});
