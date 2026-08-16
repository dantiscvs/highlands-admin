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
        <div class="desc">Upload a GPX file — we'll build the day skeleton from it. The fastest way to get a populated trip.</div>
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

// ---- Import a route (GPX) ----
// Simplified vs. the full spec: splits evenly by distance into N days rather
// than detecting multi-day stage boundaries or named waypoints. Flagged as a
// known limitation in the delivery report.
function openImportRouteModal() {
  showModal(`
    <h2>Import a route</h2>
    <p class="muted" style="margin-bottom:14px;font-size:12px;">Upload a GPX file. We'll compute distance and elevation and split it evenly across the number of days you choose. You can adjust everything afterwards in the grid.</p>
    <div class="field"><label>Trip name</label><input id="mName" type="text" placeholder="e.g. Peaks Loop 2027"></div>
    <div class="field"><label>Trip type</label><select id="mActivityType">${activityTypeOptionsHtml('cycling')}</select></div>
    <div class="field"><label>GPX file</label><input id="mGpx" type="file" accept=".gpx"></div>
    <div class="field"><label>Split into how many days?</label><input id="mDays" type="number" value="5" min="1" max="60"></div>
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
async function doImportRoute() {
  const name = document.getElementById('mName').value.trim() || 'Untitled trip';
  const activity_type = document.getElementById('mActivityType').value;
  const file = document.getElementById('mGpx').files[0];
  const days = Math.max(1, parseInt(document.getElementById('mDays').value, 10) || 1);
  if (!file) { alert('Choose a GPX file'); return; }
  const text = await file.text();
  const parsed = parseGpx(text);
  if (parsed.pts.length < 2) { alert('Could not read any track points from this file.'); return; }

  const { data: trip, error } = await db().from('trips').insert({ owner_id: currentUser.id, name, activity_type, slug: slugify(name), status: 'draft', enabled_modules: ['route','gpx','elevation','accommodation','resupply'] }).select('id').single();
  if (error) { alert(error.message); return; }

  const kmPerDay = parsed.totalKm / days;
  const ascentPerDay = parsed.totalAscent / days;
  const dayRows = Array.from({ length: days }, (_, i) => ({
    trip_id: trip.id, day_number: i + 1, title: `Day ${i + 1}`, order_index: i + 1,
    distance_km: Math.round(kmPerDay * 10) / 10, ascent_m: Math.round(ascentPerDay),
  }));
  await db().from('trip_days').insert(dayRows);
  closeAnyModal(); goTrip(trip.id);
}
document.addEventListener('change', (e) => {
  if (e.target && e.target.id === 'mGpx' && e.target.files[0]) {
    e.target.files[0].text().then(t => {
      const p = parseGpx(t);
      const el = document.getElementById('gpxPreview');
      if (el) el.textContent = p.pts.length ? `${p.totalKm.toFixed(1)} km · ${p.totalAscent} m ascent · ${p.pts.length} points` : 'No track points found.';
    });
  }
});
