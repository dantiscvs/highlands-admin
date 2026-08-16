// The primary editing surface (spec 4.1): one row per day, inline editable,
// keyboard nav, autosave-on-blur. Clicking the drawer icon opens the detail
// drawer for the long-tail per-day fields.
let gridDays = [];
let GRID_COLS = [];
function buildGridCols() {
  const cfg = activityConfig(activeTrip);
  const cols = [
    { key: 'date', label: 'Date', type: 'date', w: 120 },
    { key: 'title', label: 'Title', type: 'text', w: 170 },
    { key: 'start_point', label: 'Start', type: 'text', w: 120 },
    { key: 'end_point', label: 'End', type: 'text', w: 120 },
    { key: 'distance_km', label: cfg.distanceLabel || 'Distance (km)', type: 'number', w: 90 },
  ];
  if (cfg.showAscent) cols.push({ key: 'ascent_m', label: cfg.ascentLabel || 'Ascent (m)', type: 'number', w: 90 });
  if (cfg.showSurface) cols.push({ key: 'surface', label: cfg.surfaceLabel || 'Surface', type: 'select', w: 110, options: ['', ...cfg.surfaceOptions] });
  return cols;
}

async function renderDayGrid() {
  GRID_COLS = buildGridCols();
  const { data, error } = await db().from('trip_days').select('*').eq('trip_id', activeTrip.id).order('order_index');
  gridDays = data || [];
  const accByDay = {};
  if (moduleOn('accommodation')) {
    const { data: accs } = await db().from('accommodations').select('day_id, name').eq('trip_id', activeTrip.id);
    (accs || []).forEach(a => { if (a.day_id) accByDay[a.day_id] = a.name; });
  }
  const poiCountByDay = {};
  if (moduleOn('poi')) {
    const { data: pois } = await db().from('points_of_interest').select('day_id, category').eq('trip_id', activeTrip.id);
    (pois || []).forEach(p => { poiCountByDay[p.day_id] = poiCountByDay[p.day_id] || { sight: 0, resupply: 0 }; poiCountByDay[p.day_id][p.category === 'resupply' || p.category === 'water' ? 'resupply' : 'sight']++; });
  }

  const main = document.getElementById('main');
  main.innerHTML = `
    <div class="pagehead">
      <div><h1>Route &amp; Days</h1><div class="subtitle">Click any cell to edit. Tab/Enter/arrows move around. Changes save when you leave a cell.</div></div>
      <div style="display:flex;align-items:center;gap:12px;">
        <span id="gridSaveInd" class="saveIndicator"></span>
        ${isEditor() ? `<button class="btn btn-sm" onclick="addGridDay()">+ Add day</button>` : ''}
      </div>
    </div>
    <div class="gridWrap">
      <table class="daygrid" id="dayGridTable">
        <thead><tr>
          <th class="rownum">#</th>
          ${GRID_COLS.map(c => `<th style="min-width:${c.w}px;">${c.label}</th>`).join('')}
          ${moduleOn('accommodation') ? '<th style="min-width:140px;">Accommodation</th>' : ''}
          ${moduleOn('poi') ? '<th style="min-width:90px;">Sights / Resupply</th>' : ''}
          <th class="opencol"></th>
          ${isEditor() ? '<th class="opencol"></th>' : ''}
        </tr></thead>
        <tbody>
          ${gridDays.map((d, i) => gridRowHtml(d, i, accByDay, poiCountByDay)).join('')}
        </tbody>
      </table>
    </div>
  `;
  wireGridEvents();
}

function gridRowHtml(d, i, accByDay, poiCountByDay) {
  const poi = poiCountByDay[d.id] || { sight: 0, resupply: 0 };
  return `
    <tr class="${d.is_rest_day ? 'restday' : ''}" data-day-id="${d.id}">
      <td class="rownum">${i + 1}</td>
      ${GRID_COLS.map(c => `<td data-col="${c.key}">${gridCellHtml(d, c, i)}</td>`).join('')}
      ${moduleOn('accommodation') ? `<td><div class="cell muted" style="cursor:pointer;" onclick="goTrip(activeTrip.id,'accommodation')">${accByDay[d.id] ? esc(accByDay[d.id]) : '— none —'}</div></td>` : ''}
      ${moduleOn('poi') ? `<td><div class="cell muted" style="cursor:pointer;font-size:12px;" onclick="goTrip(activeTrip.id,'poi')">🏰${poi.sight} · 🛒${poi.resupply}</div></td>` : ''}
      <td class="opencol" title="Open day details" onclick="openDayDrawer('${d.id}')">⋯</td>
      ${isEditor() ? `<td class="opencol" title="Remove day" onclick="deleteGridDay('${d.id}')">🗑</td>` : ''}
    </tr>
  `;
}
function gridCellHtml(d, c, rowIdx) {
  const val = d[c.key] == null ? '' : d[c.key];
  const dis = isEditor() ? '' : 'disabled';
  if (c.type === 'select') {
    return `<select data-row="${rowIdx}" data-field="${c.key}" ${dis}>${c.options.map(o => `<option value="${o}" ${o===val?'selected':''}>${o||'—'}</option>`).join('')}</select>`;
  }
  return `<input type="${c.type}" data-row="${rowIdx}" data-field="${c.key}" value="${esc(val)}" ${dis}>`;
}

function wireGridEvents() {
  const table = document.getElementById('dayGridTable');
  table.querySelectorAll('input, select').forEach(el => {
    el.addEventListener('blur', onGridCellCommit);
    el.addEventListener('keydown', onGridCellKeydown);
  });
}
let lastGridEdit = null; // {dayId, field, prevValue} for a tiny one-step undo
async function onGridCellCommit(e) {
  const el = e.target;
  const rowIdx = +el.dataset.row, field = el.dataset.field;
  const day = gridDays[rowIdx];
  if (!day || !isEditor()) return;
  let val = el.value;
  if (field === 'distance_km' || field === 'ascent_m') val = val === '' ? null : Number(val);
  if (val === (day[field] ?? '')) return;
  const prevValue = day[field];
  const ind = document.getElementById('gridSaveInd');
  ind.textContent = 'Saving…'; ind.className = 'saveIndicator saving';
  const { error } = await db().from('trip_days').update({ [field]: val }).eq('id', day.id);
  if (error) { ind.textContent = 'Save failed: ' + error.message; ind.className = 'saveIndicator'; return; }
  day[field] = val;
  lastGridEdit = { dayId: day.id, field, prevValue };
  ind.textContent = '✓ Saved'; ind.className = 'saveIndicator saved';
  setTimeout(() => { if (ind.textContent === '✓ Saved') ind.textContent = ''; }, 2000);
  if (field === 'date') syncTripDateRange();
}

// Fix for reported bug: the trip's start/end date were only ever set once at
// creation time and never followed actual per-day dates entered afterwards
// (e.g. creating "5 days" then dating out a 7-day span). Whenever a day's date
// changes or the day count changes, re-derive the trip's date range from the
// actual trip_days rows instead of leaving the stale creation-time guess.
async function syncTripDateRange() {
  const dates = gridDays.map(d => d.date).filter(Boolean).sort();
  if (!dates.length) return;
  const start = dates[0], end = dates[dates.length - 1];
  if (start === activeTrip.start_date && end === activeTrip.end_date) return;
  const { error } = await db().from('trips').update({ start_date: start, end_date: end }).eq('id', activeTrip.id);
  if (!error) { activeTrip.start_date = start; activeTrip.end_date = end; }
}
function onGridCellKeydown(e) {
  const el = e.target;
  const rowIdx = +el.dataset.row, field = el.dataset.field;
  const colIdx = GRID_COLS.findIndex(c => c.key === field);
  const moveTo = (r, c) => {
    if (r < 0 || r >= gridDays.length || c < 0 || c >= GRID_COLS.length) return;
    const target = document.querySelector(`[data-row="${r}"][data-field="${GRID_COLS[c].key}"]`);
    if (target) { target.focus(); if (target.select) target.select(); }
  };
  if (e.key === 'Enter') { e.preventDefault(); el.blur(); moveTo(rowIdx + 1, colIdx); }
  else if (e.key === 'ArrowDown' && (el.tagName === 'SELECT' || el.selectionStart === el.value.length)) { moveTo(rowIdx + 1, colIdx); }
  else if (e.key === 'ArrowUp' && (el.tagName === 'SELECT' || el.selectionStart === 0)) { moveTo(rowIdx - 1, colIdx); }
  else if (e.key === 'Escape') { el.blur(); }
  else if ((e.metaKey || e.ctrlKey) && e.key === 'z' && lastGridEdit) {
    e.preventDefault();
    db().from('trip_days').update({ [lastGridEdit.field]: lastGridEdit.prevValue }).eq('id', lastGridEdit.dayId).then(() => renderDayGrid());
    lastGridEdit = null;
  }
}

async function addGridDay() {
  const nextNum = gridDays.length ? Math.max(...gridDays.map(d => d.day_number)) + 1 : 1;
  const { error } = await db().from('trip_days').insert({ trip_id: activeTrip.id, day_number: nextNum, title: `Day ${nextNum}`, order_index: nextNum });
  if (error) { alert(error.message); return; }
  renderDayGrid();
}
async function deleteGridDay(dayId) {
  const day = gridDays.find(d => d.id === dayId);
  if (!day) return;
  if (!confirm(`Remove Day ${day.day_number}${day.title ? ' — ' + day.title : ''}? Linked accommodation/sights lose their day link but aren't deleted.`)) return;
  const { error } = await db().from('trip_days').delete().eq('id', dayId);
  if (error) { alert(error.message); return; }
  gridDays = gridDays.filter(d => d.id !== dayId);
  await syncTripDateRange();
  renderDayGrid();
}

// ---- Detail drawer: long-tail per-day fields + POIs for that day ----
let currentDrawerDayId = null;
async function openDayDrawer(dayId) {
  const day = gridDays.find(d => d.id === dayId);
  if (!day) return;
  currentDrawerDayId = dayId;
  const overlay = document.getElementById('drawerOverlay');
  const drawer = document.getElementById('drawer');
  overlay.classList.add('show'); drawer.classList.add('show');
  drawer.innerHTML = `<p class="muted">Loading…</p>`;

  const { data: pois } = moduleOn('poi') ? await db().from('points_of_interest').select('*').eq('day_id', dayId).order('order_index') : { data: [] };

  drawer.innerHTML = `
    <div class="drawerhead">
      <h2 style="margin:0;">Day ${day.day_number}${day.date ? ' · ' + fmtDate(day.date) : ''}</h2>
      <button class="btn btn-sm" onclick="closeDayDrawer()">✕</button>
    </div>
    <div class="field"><label>Title (EN)</label><input id="dwTitleEn" type="text" value="${esc(day.title_en||'')}"></div>
    <div class="field"><label>Description</label><textarea id="dwDesc">${esc(day.description||'')}</textarea></div>
    <div class="field"><label>Map embed URL</label><input id="dwMap" type="url" value="${esc(day.map_embed_url||'')}" placeholder="https://...">
      <div class="muted" style="font-size:11px;margin-top:4px;">Paste a Komoot/RideWithGPS/Google Maps link — we detect the provider automatically. <a href="#" onclick="event.preventDefault();alert('Embed help: open your route on the provider, look for a Share or Embed button, and copy the link it gives you.')">How do I get this?</a></div>
    </div>
    <div class="field"><label>GPX URL</label><input id="dwGpx" type="text" value="${esc(day.gpx_url||'')}"></div>
    <div class="field"><label>Actual/planned start time</label><input id="dwStart" type="time" value="${esc(day.actual_start_time||'')}"></div>
    <div class="field"><label>Pace &amp; ETA</label><div class="card" style="padding:10px;">${paceSummaryHtml(day)}</div></div>
    <div class="field"><label>Notes</label><textarea id="dwNotes">${esc(day.notes||'')}</textarea></div>
    <div class="field">
      <label><input type="checkbox" id="dwRest" ${day.is_rest_day?'checked':''}> Rest / transfer day (no riding)</label>
    </div>
    <div class="field">
      <label style="display:flex;align-items:center;gap:6px;">
        <input type="checkbox" id="dwLockTitle" ${(day.locked_fields||[]).includes('title')?'checked':''}>
        🔒 Lock title/description against import overwrites
      </label>
    </div>
    <button class="btn btn-primary" onclick="saveDayDrawer('${dayId}')">Save</button>
    <span id="drawerSaveInd" class="saveIndicator"></span>

    ${moduleOn('poi') ? `
      <hr style="border-color:var(--bg3);margin:18px 0;">
      <h2>Sights &amp; resupply for this day</h2>
      <div id="drawerPoiList">${(pois||[]).map(p => poiRowHtml(p)).join('') || '<p class="muted" style="font-size:12px;">None yet.</p>'}</div>
      <button class="btn btn-sm" style="margin-top:8px;" onclick="addPoiFromDrawer('${dayId}')">+ Add place</button>
    ` : ''}
  `;
}
function poiRowHtml(p) {
  return `<div style="display:flex;gap:8px;align-items:flex-start;padding:6px 0;border-top:1px solid var(--bg3);">
    <span>${esc(p.icon||(p.category==='resupply'?'🛒':'📍'))}</span>
    <div style="flex:1;">
      <div style="font-weight:600;font-size:13px;">${esc(p.name)}</div>
      <div class="muted" style="font-size:11px;">${esc(p.description||'')}</div>
    </div>
    <button class="btn btn-sm" onclick="deletePoi('${p.id}')">✕</button>
  </div>`;
}
function closeDayDrawer() {
  document.getElementById('drawerOverlay').classList.remove('show');
  document.getElementById('drawer').classList.remove('show');
  currentDrawerDayId = null;
}
async function saveDayDrawer(dayId) {
  const ind = document.getElementById('drawerSaveInd');
  ind.textContent = 'Saving…'; ind.className = 'saveIndicator saving';
  const day = gridDays.find(d => d.id === dayId);
  const lockTitle = document.getElementById('dwLockTitle').checked;
  let locked = new Set(day.locked_fields || []);
  if (lockTitle) { locked.add('title'); locked.add('description'); } else { locked.delete('title'); locked.delete('description'); }
  const patch = {
    title_en: document.getElementById('dwTitleEn').value.trim() || null,
    description: document.getElementById('dwDesc').value.trim() || null,
    map_embed_url: document.getElementById('dwMap').value.trim() || null,
    gpx_url: document.getElementById('dwGpx').value.trim() || null,
    notes: document.getElementById('dwNotes').value.trim() || null,
    is_rest_day: document.getElementById('dwRest').checked,
    actual_start_time: document.getElementById('dwStart').value || null,
    locked_fields: Array.from(locked),
  };
  const { error } = await db().from('trip_days').update(patch).eq('id', dayId);
  if (error) { ind.textContent = 'Failed: ' + error.message; ind.className = 'saveIndicator'; return; }
  Object.assign(day, patch);
  ind.textContent = '✓ Saved'; ind.className = 'saveIndicator saved';
}
async function addPoiFromDrawer(dayId) {
  const name = prompt('Place name:'); if (!name) return;
  const category = confirm('Is this a resupply stop (shop/water)? Cancel = sight.') ? 'resupply' : 'sight';
  await db().from('points_of_interest').insert({ trip_id: activeTrip.id, day_id: dayId, name, category, order_index: 999 });
  openDayDrawer(dayId);
}
async function deletePoi(id) {
  await db().from('points_of_interest').delete().eq('id', id);
  if (currentDrawerDayId) openDayDrawer(currentDrawerDayId);
}
