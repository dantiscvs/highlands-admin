function renderSidebarTripsList() {
  const isAccount = parseRoute().view === 'account';
  document.getElementById('sidebar').innerHTML = `
    <div class="brand">🗺️ Trip Tracker</div>
    <div class="navitem ${isAccount ? '' : 'on'}" onclick="goTrips()"><span class="navicon">${NAV_ICONS.overview}</span><span>My trips</span></div>
    <div class="sidebar-foot">
      ${themeToggleHtml()}
      <div class="navitem ${isAccount ? 'on' : ''}" onclick="goAccount()"><span class="navicon">${NAV_ICONS.account}</span><span>Account</span></div>
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

// ---- Import a route — spreadsheet or GPX ----
// Spreadsheet (CSV/XLSX): one row per day, heuristic column mapping.
// GPX multi-day: one file, split by <trkseg> elements — each segment = one day.
//   Dates detected from <time> tags; file stored in Supabase Storage (bucket: trip-gpx).
// GPX per-day: multiple files, one per day. Each assigned to a date (detected or user-set).
//   Each file stored individually; URL written to trip_days.gpx_url.

let _importState = {};

function openImportRouteModal() {
  _importState = { tab: 'spreadsheet', gpxMode: 'multiday', segments: null, gpxFile: null, perDayFiles: [], perDayFileObjects: [], tripName: '', activityType: 'cycling' };
  showModal(`<div id="imc"></div><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;"><button class="btn" onclick="closeAnyModal()">Cancel</button><button class="btn btn-primary" id="importSubmitBtn" onclick="doImportRoute()">Import & create trip</button></div>`);
  _renderIM();
}

function _saveIM() {
  const n = document.getElementById('mName'), t = document.getElementById('mActivityType');
  if (n) _importState.tripName = n.value;
  if (t) _importState.activityType = t.value;
}

function _importTab(tab) {
  _saveIM();
  if (_importState.tab !== tab) { _importState.segments = null; _importState.gpxFile = null; _importState.perDayFiles = []; _importState.perDayFileObjects = []; }
  _importState.tab = tab; _renderIM();
}

function _importGpxMode(mode) {
  _saveIM();
  if (_importState.gpxMode !== mode) { _importState.segments = null; _importState.gpxFile = null; _importState.perDayFiles = []; _importState.perDayFileObjects = []; }
  _importState.gpxMode = mode; _renderIM();
}

function _renderIM() {
  const s = _importState;
  const tabCls = (t) => `btn btn-sm${s.tab === t ? ' btn-primary' : ''}`;
  document.getElementById('imc').innerHTML = `
    <h2 style="margin-bottom:14px;">Import a route</h2>
    <div style="display:flex;gap:6px;margin-bottom:14px;">
      <button class="${tabCls('spreadsheet')}" onclick="_importTab('spreadsheet')">📄 Spreadsheet</button>
      <button class="${tabCls('gpx')}" onclick="_importTab('gpx')">🛰️ GPX</button>
    </div>
    <div class="field"><label>Trip name</label><input id="mName" type="text" value="${esc(s.tripName)}" placeholder="e.g. Peaks Loop 2027"></div>
    <div class="field"><label>Trip type</label><select id="mActivityType">${activityTypeOptionsHtml(s.activityType || 'cycling')}</select></div>
    ${s.tab === 'spreadsheet' ? _imcSheet() : _imcGpx()}
  `;
}

function _imcSheet() {
  return `
    <div class="field"><label>File (CSV or XLSX)</label><input id="mSheet" type="file" accept=".csv,.xlsx,.xls"></div>
    <div id="iPreview" class="muted" style="font-size:12px;margin-top:4px;"></div>
    <p class="muted" style="font-size:11px;margin-top:10px;">Expected columns: day · date · title · distance · ascent · accommodation · notes</p>
  `;
}

function _imcGpx() {
  const s = _importState;
  const modeCls = (m) => `btn btn-sm${s.gpxMode === m ? ' btn-primary' : ''}`;
  return `
    <div style="display:flex;gap:6px;margin-bottom:12px;">
      <button class="${modeCls('multiday')}" onclick="_importGpxMode('multiday')">Full multi-day route</button>
      <button class="${modeCls('perday')}" onclick="_importGpxMode('perday')">Day-by-day files</button>
    </div>
    ${s.gpxMode === 'multiday' ? _imcGpxMultiday() : _imcGpxPerday()}
  `;
}

function _imcGpxMultiday() {
  const segs = _importState.segments || [];
  return `
    <p class="muted" style="font-size:12px;margin-bottom:10px;">One GPX file for the whole trip. Each <code>&lt;trkseg&gt;</code> becomes a day. Dates are detected from <code>&lt;time&gt;</code> tags — edit below if needed.</p>
    <div class="field"><label>GPX file</label><input id="mGpxSingle" type="file" accept=".gpx"></div>
    ${segs.length ? `
      <div style="margin-top:12px;font-size:12px;font-weight:600;margin-bottom:6px;">${segs.length} segment${segs.length !== 1 ? 's' : ''} detected — ${segs.reduce((a, s) => a + s.totalKm, 0).toFixed(1)} km total</div>
      <div style="display:grid;gap:4px;max-height:260px;overflow-y:auto;">
        ${segs.map((seg, i) => `
          <div style="display:grid;grid-template-columns:52px 1fr 60px 60px;gap:8px;align-items:center;font-size:12px;background:var(--bg-recessed);border-radius:6px;padding:8px;">
            <span class="muted">Day ${i + 1}</span>
            <input type="date" value="${seg.date || ''}" oninput="_importState.segments[${i}].date=this.value" style="font-size:12px;width:100%;">
            <span class="muted" style="text-align:right;">${seg.totalKm} km</span>
            <span class="muted" style="text-align:right;">${seg.totalAscent} m ↑</span>
          </div>
        `).join('')}
      </div>
    ` : `<div id="iPreview" class="muted" style="font-size:12px;margin-top:8px;"></div>`}
  `;
}

function _imcGpxPerday() {
  const files = _importState.perDayFiles || [];
  return `
    <p class="muted" style="font-size:12px;margin-bottom:10px;">One GPX per day — select multiple files at once. Dates are detected from track timestamps; edit below if needed. Each file is stored and linked to its day.</p>
    <div class="field"><label>GPX files</label><input id="mGpxMulti" type="file" accept=".gpx" multiple></div>
    ${files.length ? `
      <div style="margin-top:12px;font-size:12px;font-weight:600;margin-bottom:6px;">${files.length} file${files.length !== 1 ? 's' : ''}</div>
      <div style="display:grid;gap:4px;max-height:260px;overflow-y:auto;">
        ${files.map((f, i) => `
          <div style="display:grid;grid-template-columns:1fr 130px 55px 55px;gap:8px;align-items:center;font-size:12px;background:var(--bg-recessed);border-radius:6px;padding:8px;">
            <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${esc(f.name)}">${esc(f.name)}</span>
            <input type="date" value="${f.date || ''}" oninput="_importState.perDayFiles[${i}].date=this.value" style="font-size:12px;width:100%;">
            <span class="muted" style="text-align:right;">${f.totalKm} km</span>
            <span class="muted" style="text-align:right;">${f.totalAscent} m ↑</span>
          </div>
        `).join('')}
      </div>
    ` : ''}
  `;
}

// ---- GPX parsing ----
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

function _gpxSegmentStats(segText) {
  const re = /<trkpt\s+lat="(-?[\d.]+)"\s+lon="(-?[\d.]+)"[^>]*>([\s\S]*?)<\/trkpt>/g;
  const pts = []; let m;
  while ((m = re.exec(segText))) {
    const inner = m[3];
    const eleM = inner.match(/<ele>(-?[\d.]+)<\/ele>/);
    const timeM = inner.match(/<time>([^<]+)<\/time>/);
    pts.push({ lat: parseFloat(m[1]), lon: parseFloat(m[2]), ele: eleM ? parseFloat(eleM[1]) : 0, time: timeM ? timeM[1] : null });
  }
  if (!pts.length) return null;
  let dist = 0, ascent = 0;
  for (let i = 1; i < pts.length; i++) {
    dist += haversineKm(pts[i-1].lat, pts[i-1].lon, pts[i].lat, pts[i].lon);
    const dEl = pts[i].ele - pts[i-1].ele;
    if (dEl > 0) ascent += dEl;
  }
  const date = (pts.find(p => p.time) || {}).time;
  return { totalKm: Math.round(dist * 10) / 10, totalAscent: Math.round(ascent), date: date ? date.slice(0, 10) : null };
}

function parseGpxSegments(text) {
  const segRe = /<trkseg>([\s\S]*?)<\/trkseg>/g;
  const segments = []; let sm;
  while ((sm = segRe.exec(text))) {
    const stats = _gpxSegmentStats(sm[1]);
    if (stats) segments.push(stats);
  }
  if (!segments.length) {
    const fallback = _gpxSegmentStats(text);
    if (fallback) segments.push(fallback);
  }
  return segments;
}

function parseGpxSingle(text) {
  const segs = parseGpxSegments(text);
  if (!segs.length) return { totalKm: 0, totalAscent: 0, date: null };
  return {
    totalKm: Math.round(segs.reduce((a, s) => a + s.totalKm, 0) * 10) / 10,
    totalAscent: Math.round(segs.reduce((a, s) => a + s.totalAscent, 0)),
    date: segs[0].date,
  };
}

// ---- Spreadsheet parsing ----
function fileKind(name) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (ext === 'gpx') return 'gpx';
  if (ext === 'xlsx' || ext === 'xls') return 'xlsx';
  return 'csv';
}
function splitDelimited(line) {
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
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const d = new Date(s);
  return isNaN(d) ? null : d.toISOString().slice(0, 10);
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

// ---- Import execution ----
async function doImportRoute() {
  _saveIM();
  const s = _importState;
  const name = s.tripName || 'Untitled trip';
  const activity_type = s.activityType || 'cycling';
  const btn = document.getElementById('importSubmitBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Importing…'; }

  try {
    if (s.tab === 'spreadsheet') {
      const file = document.getElementById('mSheet') && document.getElementById('mSheet').files[0];
      if (!file) throw new Error('Choose a file first.');
      const parsedDays = await parseTabularFile(file);
      if (!parsedDays.length) throw new Error('No day rows found — check the header row has columns like day/date/title/distance.');
      const dayRows = parsedDays.map((d, i) => ({
        day_number: d.day_number || i + 1, order_index: d.day_number || i + 1,
        title: d.title || `Day ${d.day_number || i + 1}`, date: d.date || null,
        distance_km: d.distance_km, ascent_m: d.ascent_m, notes: d.notes || d.description || null,
      }));
      const { data: trip, error } = await db().from('trips').insert({ owner_id: currentUser.id, name, activity_type, slug: slugify(name), status: 'draft', enabled_modules: ['route','accommodation','resupply'] }).select('id').single();
      if (error) throw error;
      const { data: insertedDays } = await db().from('trip_days').insert(dayRows.map(d => ({ ...d, trip_id: trip.id }))).select('id, day_number');
      if (insertedDays) {
        const byNumber = {}; insertedDays.forEach(d => byNumber[d.day_number] = d.id);
        const stays = parsedDays.filter(d => d.accommodation_name).map(d => ({ trip_id: trip.id, day_id: byNumber[d.day_number], name: d.accommodation_name })).filter(st => st.day_id);
        if (stays.length) await db().from('accommodations').insert(stays);
      }
      closeAnyModal(); goTrip(trip.id);

    } else if (s.tab === 'gpx' && s.gpxMode === 'multiday') {
      if (!s.segments || !s.segments.length) throw new Error('Upload a GPX file first.');
      const { data: trip, error } = await db().from('trips').insert({ owner_id: currentUser.id, name, activity_type, slug: slugify(name), status: 'draft', enabled_modules: ['route','gpx','elevation','accommodation','resupply'] }).select('id').single();
      if (error) throw error;

      let gpxUrl = null;
      if (s.gpxFile) {
        const path = `${trip.id}/route.gpx`;
        const { error: upErr } = await db().storage.from('trip-gpx').upload(path, s.gpxFile, { contentType: 'application/gpx+xml', upsert: true });
        if (!upErr) {
          const { data: ud } = db().storage.from('trip-gpx').getPublicUrl(path);
          gpxUrl = ud ? ud.publicUrl : null;
        }
      }

      await db().from('trip_days').insert(
        s.segments.map((seg, i) => ({ trip_id: trip.id, day_number: i + 1, order_index: i + 1, title: `Day ${i + 1}`, date: seg.date || null, distance_km: seg.totalKm, ascent_m: seg.totalAscent, gpx_url: gpxUrl }))
      );
      closeAnyModal(); goTrip(trip.id);

    } else if (s.tab === 'gpx' && s.gpxMode === 'perday') {
      if (!s.perDayFiles || !s.perDayFiles.length) throw new Error('Upload GPX files first.');
      const { data: trip, error } = await db().from('trips').insert({ owner_id: currentUser.id, name, activity_type, slug: slugify(name), status: 'draft', enabled_modules: ['route','gpx','elevation','accommodation','resupply'] }).select('id').single();
      if (error) throw error;

      const dayRows = s.perDayFiles.map((f, i) => ({
        trip_id: trip.id, day_number: i + 1, order_index: i + 1,
        title: f.name.replace(/\.gpx$/i, '').replace(/[-_]+/g, ' ').trim() || `Day ${i + 1}`,
        date: f.date || null, distance_km: f.totalKm, ascent_m: f.totalAscent,
      }));
      const { data: insertedDays } = await db().from('trip_days').insert(dayRows).select('id, day_number');

      if (insertedDays && s.perDayFileObjects && s.perDayFileObjects.length) {
        const byNumber = {}; insertedDays.forEach(d => byNumber[d.day_number] = d.id);
        await Promise.all(s.perDayFileObjects.map(async (file, i) => {
          const dayNum = i + 1;
          const path = `${trip.id}/day-${dayNum}.gpx`;
          const { error: upErr } = await db().storage.from('trip-gpx').upload(path, file, { contentType: 'application/gpx+xml', upsert: true });
          if (!upErr && byNumber[dayNum]) {
            const { data: ud } = db().storage.from('trip-gpx').getPublicUrl(path);
            if (ud && ud.publicUrl) await db().from('trip_days').update({ gpx_url: ud.publicUrl }).eq('id', byNumber[dayNum]);
          }
        }));
      }
      closeAnyModal(); goTrip(trip.id);
    }
  } catch (e) {
    alert('Import failed: ' + e.message);
    if (btn) { btn.disabled = false; btn.textContent = 'Import & create trip'; }
  }
}

document.addEventListener('change', async (e) => {
  if (!e.target) return;

  if (e.target.id === 'mSheet' && e.target.files[0]) {
    const days = await parseTabularFile(e.target.files[0]).catch(() => []);
    const el = document.getElementById('iPreview');
    if (el) el.textContent = days.length ? `${days.length} day row(s) found.` : 'No day rows recognized — check the header row.';
  }

  if (e.target.id === 'mGpxSingle' && e.target.files[0]) {
    const file = e.target.files[0];
    const text = await file.text();
    _importState.gpxFile = file;
    _importState.segments = parseGpxSegments(text);
    _saveIM(); _renderIM();
  }

  if (e.target.id === 'mGpxMulti' && e.target.files.length) {
    const files = Array.from(e.target.files);
    _importState.perDayFileObjects = files;
    _importState.perDayFiles = await Promise.all(files.map(async file => {
      const stats = parseGpxSingle(await file.text());
      return { name: file.name, ...stats };
    }));
    _saveIM(); _renderIM();
  }
});
