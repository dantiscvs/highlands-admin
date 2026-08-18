// Route & Days tab — inline-editable grid (table or card view), autosave-on-blur,
// keyboard nav, day detail drawer. Card view is the default on narrow screens.
let gridDays = [];
let GRID_COLS = [];
let gridViewMode = localStorage.getItem('gridViewMode') || 'table';

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
    const { data: accs } = await db().from('accommodations').select('day_id, name, map_url').eq('trip_id', activeTrip.id);
    (accs || []).forEach(a => { if (a.day_id) accByDay[a.day_id] = a; });
  }
  const poiByDay = {};
  if (moduleOn('poi')) {
    const { data: pois } = await db().from('points_of_interest').select('day_id, name, category, url, icon').eq('trip_id', activeTrip.id).order('order_index');
    (pois || []).forEach(p => { (poiByDay[p.day_id] = poiByDay[p.day_id] || []).push(p); });
  }

  const main = document.getElementById('main');
  const viewToggle = `
    <div style="display:flex;gap:4px;background:var(--bg-recessed);border-radius:var(--radius-md);padding:3px;">
      <button class="btn btn-sm ${gridViewMode==='table'?'btn-primary':''}" onclick="setGridView('table')" title="Table view">≡ Table</button>
      <button class="btn btn-sm ${gridViewMode==='cards'?'btn-primary':''}" onclick="setGridView('cards')" title="Card view">⊟ Cards</button>
    </div>`;

  if (gridViewMode === 'cards') {
    main.innerHTML = `
      <div class="pagehead">
        <div><h1>Route &amp; Days</h1><div class="subtitle">Tap a day to expand. Click ⋯ to edit all details.</div></div>
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
          ${viewToggle}
          ${isEditor() ? `<button class="btn btn-sm" onclick="addGridDay()">+ Add day</button>` : ''}
        </div>
      </div>
      <div id="dayCardList" style="display:flex;flex-direction:column;gap:10px;">
        ${gridDays.map((d, i) => dayCardHtml(d, i, accByDay, poiByDay)).join('')}
        ${gridDays.length === 0 ? '<p class="muted">No days yet — add one above.</p>' : ''}
      </div>
    `;
  } else {
    const poiCountByDay = {};
    if (moduleOn('poi')) {
      Object.entries(poiByDay).forEach(([dayId, pois]) => {
        poiCountByDay[dayId] = { sight: pois.filter(p => p.category !== 'resupply' && p.category !== 'water').length, resupply: pois.filter(p => p.category === 'resupply' || p.category === 'water').length };
      });
    }
    main.innerHTML = `
      <div class="pagehead">
        <div><h1>Route &amp; Days</h1><div class="subtitle">Click any cell to edit. Tab/Enter/arrows move around. Changes save when you leave a cell.</div></div>
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
          <span id="gridSaveInd" class="saveIndicator"></span>
          ${viewToggle}
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
}

function setGridView(mode) {
  gridViewMode = mode;
  localStorage.setItem('gridViewMode', mode);
  renderDayGrid();
}

// ---- Card view ----

function dayCardHtml(d, i, accByDay, poiByDay) {
  const acc = accByDay[d.id];
  const pois = poiByDay[d.id] || [];
  const cfg = activityConfig(activeTrip);
  const meta = [];
  if (d.date) meta.push(fmtDate(d.date));
  if (d.distance_km) meta.push(d.distance_km + ' km');
  if (cfg.showAscent && d.ascent_m) meta.push('+' + d.ascent_m + ' m');
  if (cfg.showSurface && d.surface) meta.push(d.surface);
  if (d.is_rest_day) meta.push('Rest day');

  const sightPois = pois.filter(p => p.category !== 'resupply' && p.category !== 'water');
  const resupplyPois = pois.filter(p => p.category === 'resupply' || p.category === 'water');

  return `<details class="daycard ${d.is_rest_day ? 'daycard-rest' : ''}">
    <summary class="daycard-summary">
      <span class="daynum-chip">${i + 1}</span>
      <div style="flex:1;min-width:0;">
        <div class="daycard-title">${esc(d.title || 'Day ' + (i + 1))}</div>
        <div class="daycard-meta">${meta.join(' · ') || 'No details yet'}</div>
      </div>
      <div style="display:flex;gap:6px;align-items:center;flex-shrink:0;">
        ${d.start_point && d.end_point ? `<span class="muted" style="font-size:11px;">${esc(d.start_point)} → ${esc(d.end_point)}</span>` : ''}
        <button class="btn btn-sm" onclick="event.stopPropagation();openDayDrawer('${d.id}')" title="Edit day details">⋯</button>
        ${isEditor() ? `<button class="btn btn-sm btn-danger" onclick="event.stopPropagation();deleteGridDay('${d.id}')" title="Remove day">🗑</button>` : ''}
      </div>
    </summary>
    <div class="daycard-body">
      ${d.description ? `<p style="color:var(--text-secondary);font-size:var(--text-sm);margin-bottom:10px;">${esc(d.description)}</p>` : ''}
      ${d.notes ? `<p style="color:var(--text-tertiary);font-size:var(--text-sm);font-style:italic;margin-bottom:10px;">${esc(d.notes)}</p>` : ''}

      <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:${acc || pois.length ? '12px' : '0'};">
        ${d.start_point ? `<span class="muted" style="font-size:12px;">📍 Start: <strong style="color:var(--text-primary);">${esc(d.start_point)}</strong></span>` : ''}
        ${d.end_point ? `<span class="muted" style="font-size:12px;">🏁 End: <strong style="color:var(--text-primary);">${esc(d.end_point)}</strong></span>` : ''}
      </div>

      ${acc ? `<div style="padding:8px 12px;background:var(--bg-recessed);border-radius:var(--radius-md);margin-bottom:10px;font-size:var(--text-sm);">
        🏠 <strong>${esc(acc.name)}</strong>
        ${acc.map_url ? ` · <a href="${esc(acc.map_url)}" target="_blank" rel="noopener">Map ↗</a>` : ''}
      </div>` : ''}

      ${sightPois.length ? `<div style="margin-bottom:8px;">
        <div class="muted" style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px;">Sights</div>
        ${sightPois.map(p => `<div style="font-size:13px;padding:3px 0;">${esc(p.icon || '📍')} ${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.name)}</a>` : esc(p.name)}</div>`).join('')}
      </div>` : ''}

      ${resupplyPois.length ? `<div style="margin-bottom:8px;">
        <div class="muted" style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px;">Resupply / Water</div>
        ${resupplyPois.map(p => `<div style="font-size:13px;padding:3px 0;">${esc(p.icon || '🛒')} ${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.name)}</a>` : esc(p.name)}</div>`).join('')}
      </div>` : ''}

      ${d.map_embed_url ? `<div style="margin-top:8px;"><a href="${esc(d.map_embed_url)}" target="_blank" rel="noopener" class="btn btn-sm">🗺️ View map ↗</a></div>` : ''}
    </div>
  </details>`;
}

// ---- Table view ----

function gridRowHtml(d, i, accByDay, poiCountByDay) {
  const poi = poiCountByDay[d.id] || { sight: 0, resupply: 0 };
  const acc = accByDay[d.id];
  return `
    <tr class="${d.is_rest_day ? 'restday' : ''}" data-day-id="${d.id}">
      <td class="rownum">${i + 1}</td>
      ${GRID_COLS.map(c => `<td data-col="${c.key}">${gridCellHtml(d, c, i)}</td>`).join('')}
      ${moduleOn('accommodation') ? `<td><div class="cell muted" style="cursor:pointer;" onclick="goTrip(activeTrip.id,'accommodation')">${acc ? esc(acc.name) : '— none —'}</div></td>` : ''}
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
let lastGridEdit = null;
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
      <hr style="border-color:var(--border-hairline);margin:18px 0;">
      <h2>Sights &amp; resupply for this day</h2>
      <div id="drawerPoiList">${(pois||[]).map(p => poiRowHtml(p)).join('') || '<p class="muted" style="font-size:12px;">None yet.</p>'}</div>
      <button class="btn btn-sm" style="margin-top:8px;" onclick="addPoiFromDrawer('${dayId}')">+ Add place</button>
    ` : ''}
  `;
}
function poiRowHtml(p) {
  return `<div style="display:flex;gap:8px;align-items:flex-start;padding:6px 0;border-top:1px solid var(--border-hairline);">
    <span>${esc(p.icon||(p.category==='resupply'?'🛒':'📍'))}</span>
    <div style="flex:1;">
      <div style="font-weight:600;font-size:13px;">${esc(p.name)}</div>
      ${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener" style="font-size:11px;">${esc(p.url)}</a>` : ''}
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
  closeDayDrawer();
  openPoiModal(dayId, () => openDayDrawer(dayId));
}
async function deletePoi(id) {
  await db().from('points_of_interest').delete().eq('id', id);
  if (currentDrawerDayId) openDayDrawer(currentDrawerDayId);
}
