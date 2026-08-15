let activeTrip = null;
let activeMembership = null;

const MODULE_LABELS = {
  route: '🗺️ Route', gpx: 'GPX tracks', elevation: 'Elevation', weather: 'Weather',
  accommodation: '🏠 Accommodation', resupply: '🛒 Resupply', poi: '🏰 Sights',
  packing: '🎒 Packing', tasks: '✅ Tasks', expenses: '💸 Expenses',
  sightseeing: 'Sightseeing', transport: '✈️ Transport', live: '🔴 Live', overlays: 'Overlays',
};

async function loadTrip(tripId) {
  const { data: trip, error } = await db().from('trips').select('*').eq('id', tripId).single();
  if (error) return null;
  const { data: mem } = await db().from('trip_memberships').select('*').eq('trip_id', tripId).eq('user_id', currentUser.id).maybeSingle();
  activeTrip = trip;
  activeMembership = mem;
  return trip;
}
function isEditor() { return activeMembership && (activeMembership.role === 'owner' || activeMembership.role === 'editor'); }
function moduleOn(key) { return (activeTrip.enabled_modules || []).includes(key); }

async function renderTripShell(tripId, section) {
  const trip = await loadTrip(tripId);
  if (!trip) { document.getElementById('main').innerHTML = '<p>Trip not found or you do not have access.</p>'; return; }

  renderTripSidebar(section);
  const main = document.getElementById('main');

  const renderers = {
    overview: renderTripOverview,
    grid: renderDayGrid,
    logistics: renderLogistics,
    accommodation: () => renderAccommodationModule(),
    packing: () => renderChecklistModule('packing'),
    tasks: () => renderChecklistModule('tasks'),
    expenses: () => renderExpensesModule(),
    poi: () => renderPoiModule(),
    readiness: renderReadinessChecklist,
    share: renderShareSection,
    imports: renderImportsSection,
    settings: renderTripSettings,
  };
  const fn = renderers[section] || renderTripOverview;
  main.innerHTML = '<p class="muted">Loading…</p>';
  await fn();
}

function navRow(key, label, section, currentSection) {
  return `<div class="navitem ${section === currentSection ? 'on' : ''}" onclick="goTrip('${activeTrip.id}','${section}')">${label}</div>`;
}

function renderTripSidebar(section) {
  const modules = activeTrip.enabled_modules || [];
  document.getElementById('sidebar').innerHTML = `
    <div class="backlink"><a href="#/trips" onclick="event.preventDefault();goTrips();" class="muted" style="font-size:12px;">← All trips</a></div>
    <div class="brand" style="font-size:14px;flex-wrap:wrap;">${esc(activeTrip.name)}</div>
    <div style="padding:0 16px 12px;"><span class="badge ${activeTrip.status==='active'?'badge-green':activeTrip.status==='archived'?'badge-gray':'badge-blue'}">${activeTrip.status}</span></div>

    <div class="navgroup">Plan</div>
    ${navRow('overview','🏠 Overview','overview',section)}
    ${moduleOn('route') ? navRow('grid','📅 Route & Days','grid',section) : ''}
    ${moduleOn('transport') ? navRow('logistics','✈️ Logistics','logistics',section) : ''}

    <div class="navgroup">Modules</div>
    ${moduleOn('accommodation') ? navRow('accommodation','🏠 Accommodation','accommodation',section) : ''}
    ${moduleOn('poi') ? navRow('poi','🏰 Sights & resupply','poi',section) : ''}
    ${moduleOn('packing') ? navRow('packing','🎒 Packing','packing',section) : ''}
    ${moduleOn('tasks') ? navRow('tasks','✅ Tasks','tasks',section) : ''}
    ${moduleOn('expenses') ? navRow('expenses','💸 Expenses','expenses',section) : ''}

    <div class="navgroup">Trip health</div>
    ${navRow('readiness','☑️ Readiness','readiness',section)}
    ${navRow('share','🔗 Share & live','share',section)}
    ${navRow('imports','📥 Imports','imports',section)}
    ${isEditor() ? navRow('settings','⚙️ Settings','settings',section) : ''}

    <div style="flex:1;"></div>
    <div class="navitem" onclick="signOut()">↩️ Sign out</div>
  `;
}

async function renderTripOverview() {
  const [{ data: days }, { count: photoCount }] = await Promise.all([
    db().from('trip_days').select('*').eq('trip_id', activeTrip.id).order('order_index'),
    db().from('updates').select('*', { count: 'exact', head: true }).eq('trip_id', activeTrip.id),
  ]);
  const totalKm = (days || []).reduce((s, d) => s + (Number(d.distance_km) || 0), 0);
  const totalEl = (days || []).reduce((s, d) => s + (Number(d.ascent_m) || 0), 0);
  const readiness = await db().rpc('trip_readiness', { p_trip_id: activeTrip.id });
  const pct = readiness.data ? readiness.data.completePct : 0;

  document.getElementById('main').innerHTML = `
    <div class="pagehead">
      <div><h1>${esc(activeTrip.name)}</h1><div class="subtitle">${activeTrip.start_date ? fmtDate(activeTrip.start_date) + ' – ' + fmtDate(activeTrip.end_date) : 'No dates set yet'} · ${activeTrip.timezone}</div></div>
      <div style="display:flex;gap:8px;">
        <button class="btn" onclick="goTrip(activeTrip.id,'settings')">⚙️ Settings</button>
        <button class="btn" onclick="goTrip(activeTrip.id,'share')">🔗 Share</button>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:24px;">
      <div class="card" style="text-align:center;"><div style="font-size:22px;font-weight:800;">${(days||[]).length}</div><div class="muted" style="font-size:12px;">days</div></div>
      <div class="card" style="text-align:center;"><div style="font-size:22px;font-weight:800;">${totalKm.toFixed(0)}</div><div class="muted" style="font-size:12px;">km</div></div>
      <div class="card" style="text-align:center;"><div style="font-size:22px;font-weight:800;">${totalEl.toFixed(0)}</div><div class="muted" style="font-size:12px;">m ascent</div></div>
      <div class="card" style="text-align:center;"><div style="font-size:22px;font-weight:800;">${pct}%</div><div class="muted" style="font-size:12px;">ready</div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div class="card">
        <h2>Enabled modules</h2>
        <div style="display:flex;flex-wrap:wrap;gap:6px;">
          ${(activeTrip.enabled_modules || []).map(m => `<span class="badge badge-gray">${MODULE_LABELS[m] || m}</span>`).join('') || '<span class="muted">None yet</span>'}
        </div>
        <button class="btn btn-sm" style="margin-top:12px;" onclick="goTrip(activeTrip.id,'settings')">Manage modules</button>
      </div>
      <div class="card">
        <h2>Quick links</h2>
        <div style="display:flex;flex-direction:column;gap:8px;">
          <a href="#" onclick="event.preventDefault();goTrip(activeTrip.id,'grid');">📅 Open the day grid</a>
          <a href="#" onclick="event.preventDefault();goTrip(activeTrip.id,'readiness');">☑️ Review readiness checklist</a>
          <a href="#" onclick="event.preventDefault();goTrip(activeTrip.id,'imports');">📥 Import bookings from email/document</a>
        </div>
      </div>
    </div>
  `;
}

async function renderTripSettings() {
  const t = activeTrip;
  const ALL_MODULES = ['route','gpx','elevation','weather','accommodation','resupply','poi','packing','tasks','expenses','transport','live'];
  document.getElementById('main').innerHTML = `
    <div class="pagehead"><div><h1>Trip settings</h1><div class="subtitle">Trip-level configuration.</div></div></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div class="card">
        <h2>Basics</h2>
        <div class="field"><label>Name</label><input id="sName" type="text" value="${esc(t.name)}"></div>
        <div class="field"><label>Status</label>
          <select id="sStatus">${['draft','active','archived'].map(s=>`<option value="${s}" ${s===t.status?'selected':''}>${s}</option>`).join('')}</select>
        </div>
        <div class="field"><label>Start date</label><input id="sStart" type="date" value="${t.start_date||''}"></div>
        <div class="field"><label>End date</label><input id="sEnd" type="date" value="${t.end_date||''}"></div>
        <div class="field"><label>Timezone</label><input id="sTz" type="text" value="${esc(t.timezone)}"></div>
        <div class="field"><label>Default currency</label><input id="sCur" type="text" value="${esc(t.default_currency)}" maxlength="3" style="width:80px;"></div>
        <button class="btn btn-primary" onclick="saveTripSettings()">Save</button>
        <span id="settingsSaved" class="saveIndicator"></span>
      </div>
      <div class="card">
        <h2>Modules</h2>
        <p class="muted" style="font-size:12px;margin-bottom:10px;">A disabled module is hidden everywhere — nav, grid columns, and the participant view.</p>
        ${ALL_MODULES.map(m => `
          <label style="display:flex;align-items:center;gap:8px;padding:5px 0;cursor:pointer;">
            <input type="checkbox" data-mod="${m}" ${moduleOn(m)?'checked':''} onchange="toggleModule('${m}', this.checked)">
            ${MODULE_LABELS[m] || m}
          </label>
        `).join('')}
      </div>
      <div class="card">
        <h2>Pace assumptions</h2>
        <p class="muted" style="font-size:12px;margin-bottom:10px;">Used by the readiness/ETA calculations on each day. Editable any time.</p>
        ${renderPaceForm(t.pace_assumptions)}
        <button class="btn btn-primary" style="margin-top:10px;" onclick="savePaceAssumptions()">Save pace assumptions</button>
      </div>
    </div>
  `;
}
function renderPaceForm(p) {
  p = p || { flatKmh: {}, climbMPerHour: 400, stopOverheadMin: 15, dayOverheadMin: 30 };
  const f = p.flatKmh || {};
  return `
    <div class="field"><label>Flat speed — tarmac (km/h)</label><input id="pTarmac" type="number" value="${f.tarmac ?? 18}"></div>
    <div class="field"><label>Flat speed — gravel (km/h)</label><input id="pGravel" type="number" value="${f.gravel ?? 14}"></div>
    <div class="field"><label>Flat speed — singletrack (km/h)</label><input id="pSingle" type="number" value="${f.singletrack ?? 8}"></div>
    <div class="field"><label>Climbing rate (m/h)</label><input id="pClimb" type="number" value="${p.climbMPerHour ?? 400}"></div>
    <div class="field"><label>Overhead per stop (min)</label><input id="pStopOh" type="number" value="${p.stopOverheadMin ?? 15}"></div>
    <div class="field"><label>Overhead per day (min)</label><input id="pDayOh" type="number" value="${p.dayOverheadMin ?? 30}"></div>
  `;
}
async function savePaceAssumptions() {
  const pace = {
    flatKmh: { tarmac: +document.getElementById('pTarmac').value, gravel: +document.getElementById('pGravel').value, singletrack: +document.getElementById('pSingle').value, hikeABike: 3 },
    climbMPerHour: +document.getElementById('pClimb').value,
    stopOverheadMin: +document.getElementById('pStopOh').value,
    dayOverheadMin: +document.getElementById('pDayOh').value,
  };
  const { error } = await db().from('trips').update({ pace_assumptions: pace }).eq('id', activeTrip.id);
  activeTrip.pace_assumptions = pace;
  if (error) alert(error.message);
}
async function toggleModule(mod, on) {
  let mods = new Set(activeTrip.enabled_modules || []);
  if (on) mods.add(mod); else mods.delete(mod);
  activeTrip.enabled_modules = Array.from(mods);
  await db().from('trips').update({ enabled_modules: activeTrip.enabled_modules }).eq('id', activeTrip.id);
  renderTripSidebar('settings');
}
async function saveTripSettings() {
  const ind = document.getElementById('settingsSaved');
  ind.textContent = 'Saving…'; ind.className = 'saveIndicator saving';
  const patch = {
    name: document.getElementById('sName').value.trim(),
    status: document.getElementById('sStatus').value,
    start_date: document.getElementById('sStart').value || null,
    end_date: document.getElementById('sEnd').value || null,
    timezone: document.getElementById('sTz').value.trim(),
    default_currency: document.getElementById('sCur').value.trim().toUpperCase(),
  };
  const { error } = await db().from('trips').update(patch).eq('id', activeTrip.id);
  if (error) { ind.textContent = 'Failed: ' + error.message; ind.className = 'saveIndicator'; return; }
  Object.assign(activeTrip, patch);
  ind.textContent = '✓ Saved'; ind.className = 'saveIndicator saved';
  renderTripSidebar('settings');
}
