// Story & Gallery — a shared photo pool (app.updates + the "photos" bucket)
// behind two tabs: Story (the card generator) and Gallery (pure upload/browse).
//
// Every burnable element (day counter, distance, climbing, elevation profile,
// route map, pace) has its OWN day-vs-trip scope, not one global switch. That
// mirrors the best version of the legacy card: a whole-trip route trace with
// today's progress lit up on it, next to a "Day 3 of 9" label — two different
// scopes on one card, which a single global toggle could never express.

const STORY_W = 1080, STORY_H = 1920;
// Instagram/Facebook Stories reserve their own chrome (profile chip + caption
// at the top, reply bar + reactions at the bottom) over roughly the top and
// bottom ~13% of a 9:16 frame. Every burned-in element is kept out of these
// bands on every card this module produces.
const STORY_SAFE_TOP = 250, STORY_SAFE_BOTTOM = 250;
const STORY_THEMES = {
  trail:  { bg: '#23261E', accent: '#7FB587', text: '#FBFAF6', dim: 'rgba(251,250,246,.72)' },
  ember:  { bg: '#2A1B12', accent: '#E08A54', text: '#FBFAF6', dim: 'rgba(251,250,246,.72)' },
  slate:  { bg: '#1B1D18', accent: '#86B4CC', text: '#FBFAF6', dim: 'rgba(251,250,246,.72)' },
};
const STORY_PRESETS_KEY = 'storyPresets'; // global — a look you like is worth reusing on the next trip

// Which "Show on the card" toggles carry their own day/trip scope pill.
// [key, label, hasScope]
const STORY_TOGGLES = [
  ['title', 'Trip name', false],
  ['day', 'Day counter', true],
  ['distance', 'Distance', true],
  ['elevation', 'Climbing', true],
  ['profile', 'Elevation profile', true],
  ['map', 'Route map', true],
  ['pace', 'Average pace', true],
  ['weather', "Today's weather", false],
  ['place', 'Photo location', false],
  ['stay', "Tonight's stay", false],
  ['url', 'Follow link', false],
];

let storyState = {
  photoUrl: null,          // background photo, or null for a gradient
  dayId: null,             // drives every day-scoped element, and the progress marker on trip-scoped ones
  theme: 'trail',
  show: { title: true, day: true, distance: true, elevation: true, profile: true, map: false,
          pace: false, weather: false, place: false, stay: false, url: true },
  // Per-element scope. Only keys with hasScope in STORY_TOGGLES are read.
  // Defaults recreate the old "whole trace, today's label" combination.
  scopeOf: { day: 'day', distance: 'day', elevation: 'day', profile: 'trip', map: 'trip', pace: 'day' },
  dim: 0.5,
  extraPhotoIds: [],       // additional gallery photos rendered as clean follow-on frames
};
let _storyDays = [], _storyPhotos = [], _storyProgress = {};

// ---- shared load (both tabs pull from the same pool) ----
async function loadPhotoPool() {
  const [{ data: updates }, { data: days }] = await Promise.all([
    db().from('updates').select('*').eq('trip_id', activeTrip.id).not('photo_url', 'is', null).order('created_at', { ascending: false }),
    db().from('trip_days').select('*').eq('trip_id', activeTrip.id).order('order_index'),
  ]);
  _storyPhotos = updates || [];
  _storyDays = days || [];
}

function _rerenderPhotoTab() {
  const route = parseRoute();
  if (route.view === 'trip' && route.section === 'gallery') renderGalleryModule();
  else renderStoryModule();
}

// ==================== STORY TAB ====================
async function renderStoryModule() {
  if (moduleGate('photos')) return;
  const main = document.getElementById('main');
  main.innerHTML = '<p class="muted">Loading…</p>';

  await loadPhotoPool();
  const { data: prog } = await db().from('day_progress').select('*').eq('trip_id', activeTrip.id);
  _storyProgress = {};
  (prog || []).forEach(p => { _storyProgress[p.day_id] = Number(p.ridden_km) || 0; });

  if (!storyState.dayId) {
    const iso = todayIso();
    const d = _storyDays.find(x => x.date === iso) || _storyDays.find(x => x.distance_km) || _storyDays[0];
    storyState.dayId = d ? d.id : null;
  }
  if (!storyState.photoUrl && _storyPhotos.length) storyState.photoUrl = _storyPhotos[0].photo_url;
  // Extra-card picks can go stale if a photo was deleted elsewhere.
  const liveIds = new Set(_storyPhotos.map(p => p.id));
  storyState.extraPhotoIds = storyState.extraPhotoIds.filter(id => liveIds.has(id));

  main.innerHTML = `
    <div class="pagehead">
      <div><h1>Story</h1><div class="subtitle">Shareable story cards built from the trip's photos. Uploads here land in Gallery too.</div></div>
    </div>

    <div class="storygrid">
      <div>
        <div class="card" style="margin-bottom:14px;">
          <h2>Story card</h2>
          <p class="muted" style="font-size:var(--text-sm);margin-bottom:14px;">
            1080 × 1920, sized for Instagram and WhatsApp stories, kept clear of both apps' safe zones (dashed
            lines in the preview). Rendered in your browser — the photo never leaves the page to make one.</p>

          <div class="field"><label>Day <span class="muted" style="font-weight:400;">(for day-scoped elements below, and the progress marker on trip-wide ones)</span></label>
            <select onchange="storySet('dayId', this.value)">
              ${_storyDays.map(d => `<option value="${d.id}" ${d.id === storyState.dayId ? 'selected' : ''}>Day ${d.day_number}${d.title ? ' — ' + esc(d.title) : ''}</option>`).join('')}
            </select>
          </div>

          <div class="field"><label>Background</label>
            <div class="storythumbs">
              <button class="storythumb ${!storyState.photoUrl ? 'on' : ''}" onclick="storySet('photoUrl', null)" title="No photo — gradient">
                <span class="grad"></span></button>
              ${_storyPhotos.slice(0, 11).map(p => `
                <button class="storythumb ${storyState.photoUrl === p.photo_url ? 'on' : ''}"
                  onclick="storySet('photoUrl','${esc(p.photo_url)}')" title="${esc(p.place_name || '')}">
                  <img src="${esc(p.photo_url)}" alt="" loading="lazy"></button>`).join('')}
            </div>
            ${!_storyPhotos.length ? '<div class="muted" style="font-size:var(--text-xs);margin-top:6px;">No photos yet — upload one below and it becomes available here.</div>' : ''}
          </div>

          <div class="field"><label>Theme</label>
            <div style="display:flex;gap:6px;">
              ${Object.keys(STORY_THEMES).map(k => `<button class="btn btn-sm storytheme ${storyState.theme === k ? 'btn-primary' : ''}" data-theme-btn="${k}" onclick="storySet('theme','${k}')" style="text-transform:capitalize;">${k}</button>`).join('')}
            </div>
          </div>

          <div class="field"><label>Photo dimming <span class="muted" style="font-weight:400;">(${Math.round(storyState.dim * 100)}%)</span></label>
            <input type="range" min="0" max="85" value="${Math.round(storyState.dim * 100)}"
              oninput="storySet('dim', this.value/100)" style="width:100%;" ${storyState.photoUrl ? '' : 'disabled'}>
          </div>

          <div class="field"><label>Show on the card</label>
            <div class="storytoggles">
              ${STORY_TOGGLES.map(([k, l, hasScope]) => `
                <div class="storytoggle-row">
                  <label><input type="checkbox" ${storyState.show[k] ? 'checked' : ''}
                    onchange="storyToggle('${k}', this.checked)"> ${l}</label>
                  ${hasScope ? `<div class="scopepill">
                    <button class="${storyState.scopeOf[k] === 'day' ? 'on' : ''}" onclick="storySetScope('${k}','day')">Day</button>
                    <button class="${storyState.scopeOf[k] === 'trip' ? 'on' : ''}" onclick="storySetScope('${k}','trip')">Trip</button>
                  </div>` : ''}
                </div>`).join('')}
            </div>
          </div>

          <div class="field"><label>Additional clean photos <span class="muted" style="font-weight:400;">(appended as simple follow-on frames — just a location pin and time, no stats panel)</span></label>
            <div class="storythumbs">
              ${_storyPhotos.map(p => `
                <button class="storythumb ${storyState.extraPhotoIds.includes(p.id) ? 'on' : ''}" onclick="storyToggleExtra('${p.id}')" title="${esc(p.place_name || '')}">
                  <img src="${esc(p.photo_url)}" alt="" loading="lazy"></button>`).join('') || '<span class="muted" style="font-size:12px;">Upload photos below to pick from them here.</span>'}
            </div>
          </div>

          <div class="field"><label>Presets</label>
            <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
              <select id="storyPresetSelect" style="flex:1;min-width:120px;">
                <option value="">Choose a preset…</option>
                ${storyPresets().map((p, i) => `<option value="${i}">${esc(p.name)}</option>`).join('')}
              </select>
              <button class="btn btn-sm" onclick="storyApplyPreset()">Apply</button>
              <button class="btn btn-sm" onclick="storySavePreset()">Save current…</button>
              <button class="btn btn-sm btn-danger" onclick="storyDeletePreset()">Delete</button>
            </div>
          </div>

          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:4px;">
            <button class="btn btn-primary" onclick="storyDownload()">⬇ Download main card</button>
            ${storyState.extraPhotoIds.length ? `<button class="btn" onclick="downloadAllFrames()">⬇ Download all (${storyState.extraPhotoIds.length + 1})</button>` : ''}
            <span id="storyMsg" class="saveIndicator"></span>
          </div>
        </div>
      </div>

      <div>
        <div class="storypreview">
          <canvas id="storyCanvas" width="${STORY_W}" height="${STORY_H}"></canvas>
          <div class="story-safeguide" style="top:${(STORY_SAFE_TOP / STORY_H * 100).toFixed(2)}%;"></div>
          <div class="story-safeguide" style="bottom:${(STORY_SAFE_BOTTOM / STORY_H * 100).toFixed(2)}%;"></div>
        </div>
        <div class="muted" style="font-size:var(--text-xs);text-align:center;margin-top:8px;">Live preview · dashed lines mark the IG/FB safe zone</div>
      </div>
    </div>

    <div id="storyExtraWrap" style="${storyState.extraPhotoIds.length ? '' : 'display:none;'}margin-top:20px;">
      <h2>Additional frames</h2>
      <p class="muted" style="font-size:var(--text-sm);margin-bottom:10px;">Post the main card first, then these — a clean sequence of photos with just a place pin and time.</p>
      <div id="storyExtraStrip" style="display:flex;gap:14px;overflow-x:auto;padding-bottom:6px;"></div>
    </div>

    ${photoUploadFormHtml()}

    <h2 style="margin-top:26px;">Gallery <span class="muted" style="font-weight:400;font-size:var(--text-sm);">(${_storyPhotos.length})</span></h2>
    ${photoGalleryGridHtml()}
    ${lightboxHtml()}
  `;
  drawStoryCard();
  renderExtraCards();
}

// ==================== GALLERY TAB ====================
async function renderGalleryModule() {
  if (moduleGate('photos')) return;
  const main = document.getElementById('main');
  main.innerHTML = '<p class="muted">Loading…</p>';
  await loadPhotoPool();

  main.innerHTML = `
    <div class="pagehead">
      <div><h1>Gallery</h1><div class="subtitle">Every photo from the trip. Upload here or from Story — both go to the same place.</div></div>
    </div>
    ${photoUploadFormHtml()}
    <h2 style="margin-top:20px;">${_storyPhotos.length} photo${_storyPhotos.length === 1 ? '' : 's'}</h2>
    ${photoGalleryGridHtml()}
    ${lightboxHtml()}
  `;
}

// ---- shared markup: upload form, gallery grid, lightbox ----
function photoUploadFormHtml() {
  if (!canPostPhotos()) return '';
  return `<div class="card" style="margin-top:20px;">
    <h2>Add a photo</h2>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;align-items:center;">
      <input id="photoFile" type="file" accept="image/*" style="flex:1;min-width:180px;">
      <select id="photoDay" style="width:150px;">
        <option value="">No day tag</option>
        ${_storyDays.map(d => `<option value="${d.id}">Day ${d.day_number}</option>`).join('')}
      </select>
    </div>
    <input id="photoCaption" type="text" placeholder="Caption (optional)" style="width:100%;margin-bottom:10px;">
    <button class="btn btn-primary" onclick="uploadPhoto()">Upload</button>
    <span id="photoStatus" class="saveIndicator" style="margin-left:10px;"></span>
    <div class="muted" style="font-size:11px;margin-top:8px;">If the photo has GPS data we'll tag it with a place name automatically.</div>
  </div>`;
}
function photoGalleryGridHtml() {
  return `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;">
    ${_storyPhotos.map(u => `
      <div class="card" style="padding:8px;position:relative;">
        <img src="${esc(u.photo_url)}" alt="${esc(u.caption || '')}" loading="lazy"
          style="width:100%;height:140px;object-fit:cover;border-radius:8px;display:block;cursor:zoom-in;"
          onclick="adminOpenLightbox('${esc(u.photo_url)}','${esc(u.caption || '')}')">
        ${u.place_name ? `<div style="font-size:11px;margin-top:6px;color:var(--text-secondary);">📍 ${esc(u.place_name)}</div>` : ''}
        ${u.caption ? `<div style="font-size:12px;margin-top:2px;color:var(--text-secondary);">${esc(u.caption)}</div>` : ''}
        <div style="font-size:11px;color:var(--text-tertiary);margin-top:3px;">${(u.taken_at || u.created_at) ? new Date(u.taken_at || u.created_at).toLocaleDateString() : ''}</div>
        <button class="btn btn-sm" style="position:absolute;top:8px;left:8px;padding:2px 7px;font-size:11px;"
          onclick="storySetPhoto('${esc(u.photo_url)}')" title="Use as story background">📲</button>
        ${(isEditor() || (activeMembership && u.membership_id === activeMembership.id))
          ? `<button class="btn btn-sm btn-danger" style="position:absolute;top:8px;right:8px;padding:2px 7px;font-size:11px;" onclick="deletePhoto('${u.id}','${esc(u.photo_url)}')">✕</button>` : ''}
      </div>`).join('') || '<p class="muted">No photos yet.</p>'}
  </div>`;
}
function lightboxHtml() {
  return `<div id="admin-lb" onclick="adminCloseLightbox()" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:9999;align-items:center;justify-content:center;cursor:zoom-out;flex-direction:column;gap:12px;">
    <img id="admin-lb-img" src="" style="max-width:90vw;max-height:85vh;border-radius:12px;object-fit:contain;">
    <div id="admin-lb-cap" style="color:#fff;font-size:14px;text-align:center;max-width:500px;opacity:.85;"></div>
  </div>`;
}

// ---- controls ----
function storySet(k, v) {
  storyState[k] = v;
  if (k === 'dayId' || k === 'photoUrl') renderStoryModule();
  else { drawStoryCard(); refreshStoryControls(); }
}
function storySetScope(k, scope) { storyState.scopeOf[k] = scope; renderStoryModule(); }
function storyToggle(k, on) { storyState.show[k] = on; drawStoryCard(); }
function storyToggleExtra(id) {
  const i = storyState.extraPhotoIds.indexOf(id);
  if (i === -1) storyState.extraPhotoIds.push(id); else storyState.extraPhotoIds.splice(i, 1);
  renderStoryModule();
}
function refreshStoryControls() {
  document.querySelectorAll('.storytheme').forEach(b => b.classList.toggle('btn-primary', b.dataset.themeBtn === storyState.theme));
}

// ---- presets ----
function storyPresets() {
  try { return JSON.parse(localStorage.getItem(STORY_PRESETS_KEY) || '[]'); } catch (e) { return []; }
}
function storySavePreset() {
  const name = prompt('Name this preset:');
  if (!name) return;
  const presets = storyPresets();
  presets.push({ name, theme: storyState.theme, dim: storyState.dim, show: { ...storyState.show }, scopeOf: { ...storyState.scopeOf } });
  localStorage.setItem(STORY_PRESETS_KEY, JSON.stringify(presets));
  renderStoryModule();
}
function storyApplyPreset() {
  const sel = document.getElementById('storyPresetSelect');
  const p = storyPresets()[sel.value];
  if (!p) return;
  storyState.theme = p.theme; storyState.dim = p.dim;
  storyState.show = { ...storyState.show, ...p.show };
  storyState.scopeOf = { ...storyState.scopeOf, ...(p.scopeOf || {}) }; // older presets predate per-element scope — falls back to current defaults
  renderStoryModule();
}
function storyDeletePreset() {
  const sel = document.getElementById('storyPresetSelect');
  if (sel.value === '') return;
  const presets = storyPresets();
  presets.splice(+sel.value, 1);
  localStorage.setItem(STORY_PRESETS_KEY, JSON.stringify(presets));
  renderStoryModule();
}

// ---- data helpers (per-scope, not per-card) ----
// metricsFor('day') and metricsFor('trip') are both computed up front each
// draw; each element then reads whichever one its own scopeOf says to.
function metricsFor(scope) {
  const day = _storyDays.find(d => d.id === storyState.dayId);
  const idx = _storyDays.findIndex(d => d.id === storyState.dayId);
  if (scope === 'day') {
    const km = day ? Number(day.distance_km) || 0 : 0;
    const done = day ? (_storyProgress[day.id] || 0) : 0;
    return { day, idx, km, done, ascent: day ? Number(day.ascent_m) || 0 : 0, label: day ? day.title : '' };
  }
  const km = _storyDays.reduce((s, d) => s + (Number(d.distance_km) || 0), 0);
  const done = _storyDays.reduce((s, d) => s + (_storyProgress[d.id] || 0), 0);
  const ascent = _storyDays.reduce((s, d) => s + (Number(d.ascent_m) || 0), 0);
  return { day, idx, km, done, ascent, label: activeTrip.name };
}

// Merge every day's elevation profile end to end so "Trip" scope gets one
// continuous chart with cumulative distance, matching how Statistics does it.
async function storyTripProfile() {
  const gpxDays = _storyDays.filter(d => d.gpx_url);
  if (!gpxDays.length) return null;
  const profiles = await Promise.all(gpxDays.map(d => fetchProfile(d.gpx_url)));
  const good = profiles.map((p, i) => [p, gpxDays[i]]).filter(([p]) => p && p.hasEle);
  if (!good.length) return null;
  const merged = { dist: [], ele: [], gain: [] };
  let kmOff = 0, gainOff = 0;
  good.forEach(([p]) => {
    for (let i = 0; i < p.dist.length; i++) {
      merged.dist.push(kmOff + p.dist[i]); merged.ele.push(p.ele[i]); merged.gain.push(gainOff + p.gain[i]);
    }
    kmOff += p.totalKm; gainOff += p.totalGain;
  });
  merged.hasEle = true;
  merged.totalKm = kmOff; merged.totalGain = gainOff;
  merged.minEle = Math.min(...merged.ele); merged.maxEle = Math.max(...merged.ele);
  return merged;
}

// Distance-weighted average speed from the same pace engine Route & Days uses
// (js/trip-pace.js) — not a separate estimate.
function storyPaceKmh(scope) {
  const cfg = activityConfig(activeTrip);
  if (!cfg.paceKeys || !cfg.paceKeys.length) return null;
  if (scope === 'day') {
    const day = _storyDays.find(d => d.id === storyState.dayId);
    const p = day ? computeDayPace(day, activeTrip.pace_assumptions) : null;
    return p ? p.speedKmh : null;
  }
  const days = _storyDays.filter(d => d.distance_km);
  if (!days.length) return null;
  let totalKm = 0, totalHours = 0;
  days.forEach(d => {
    const p = computeDayPace(d, activeTrip.pace_assumptions);
    if (p) { totalKm += Number(d.distance_km); totalHours += p.movingHours; }
  });
  return totalHours ? totalKm / totalHours : null;
}

// Today's min/max temperature, reusing Weather's own cached fetch (js/trip-weather.js)
// — no separate API call pattern, no separate key.
async function storyWeather() {
  const day = _storyDays.find(d => d.id === storyState.dayId);
  if (!day || !day.date) return null;
  const coords = await wxCoordsFor(day);
  if (!coords) return null;
  const wx = await wxFetch(coords.lat, coords.lon);
  if (!wx || !wx.hourly || !wx.hourly.time) return null;
  const temps = wx.hourly.time.map((t, i) => t.startsWith(day.date) ? wx.hourly.temperature_2m[i] : null).filter(v => v != null);
  if (!temps.length) return null;
  return { min: Math.min(...temps), max: Math.max(...temps) };
}

function currentPhotoRow() { return _storyPhotos.find(p => p.photo_url === storyState.photoUrl) || null; }

// ---- route trace (the legacy "watermark map") ----
// Projects every day's GPX onto one canvas region with an equirectangular
// projection corrected for latitude, fit to the trip's own bounding box —
// there is no hard-coded basemap here since the app is not tied to one trip.
function storyProjector(allPoints, w, h, pad) {
  let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
  allPoints.forEach(pts => pts.forEach(([lat, lon]) => {
    if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat;
    if (lon < minLon) minLon = lon; if (lon > maxLon) maxLon = lon;
  }));
  const midLat = (minLat + maxLat) / 2;
  const latCos = Math.cos(midLat * Math.PI / 180) || 0.5;
  const spanLon = (maxLon - minLon) * latCos || 0.0001;
  const spanLat = (maxLat - minLat) || 0.0001;
  const innerW = w - pad * 2, innerH = h - pad * 2;
  const scale = Math.min(innerW / spanLon, innerH / spanLat);
  const drawW = spanLon * scale, drawH = spanLat * scale;
  const offX = pad + (innerW - drawW) / 2, offY = pad + (innerH - drawH) / 2;
  return ([lat, lon]) => [
    offX + (lon - minLon) * latCos * scale,
    offY + (maxLat - lat) * scale,
  ];
}

async function routeDaysFor(scope) {
  // Trip scope: every day with a track. Day scope: just the selected one —
  // still drawn through the same projector so a single stage reads as a
  // clean, well-framed line rather than a tiny squiggle in a trip-sized box.
  if (scope === 'trip') return _storyDays.filter(d => d.gpx_url);
  const day = _storyDays.find(d => d.id === storyState.dayId);
  return day && day.gpx_url ? [day] : [];
}

async function drawStoryTrace(ctx, x, y, w, h, scope) {
  const routeDays = await routeDaysFor(scope);
  if (!routeDays.length) return 0;
  const profiles = await Promise.all(routeDays.map(d => fetchProfile(d.gpx_url)));
  const withPts = routeDays.map((d, i) => [d, profiles[i]]).filter(([, p]) => p && p.latlon && p.latlon.length > 1);
  if (!withPts.length) return 0;

  const project = storyProjector(withPts.map(([, p]) => p.latlon), w, h, 36);
  const currentIdx = _storyDays.findIndex(d => d.id === storyState.dayId);

  withPts.forEach(([d, p], i) => {
    const dIdx = _storyDays.findIndex(x2 => x2.id === d.id);
    const color = DAY_TRACK_COLORS[i % DAY_TRACK_COLORS.length];
    const pix = p.latlon.map(project);

    // Dim full line underneath everything — the "watermark".
    ctx.beginPath();
    pix.forEach(([px, py], j) => { const X = x + px, Y = y + py; j === 0 ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y); });
    ctx.strokeStyle = '#FFFFFF'; ctx.globalAlpha = 0.16; ctx.lineWidth = 7; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();

    // Lit portion: fully done days solid, the current day lit up to progress,
    // days ahead left dim. Day scope always lights the whole line since there
    // is only the one day and the number above already shows how far into it.
    let litFrac = 0;
    if (scope === 'day') litFrac = 1;
    else if (dIdx < currentIdx) litFrac = 1;
    else if (dIdx === currentIdx) { const km = Number(d.distance_km) || 0; litFrac = km ? Math.min(1, (_storyProgress[d.id] || 0) / km) : 0; }
    const litCount = Math.max(0, Math.round(pix.length * litFrac));
    if (litCount > 1) {
      ctx.beginPath();
      pix.slice(0, litCount).forEach(([px, py], j) => { const X = x + px, Y = y + py; j === 0 ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y); });
      ctx.strokeStyle = color; ctx.globalAlpha = 0.95; ctx.lineWidth = 10; ctx.stroke();
      // marker at the point reached
      const [mx, my] = pix[litCount - 1];
      ctx.beginPath(); ctx.arc(x + mx, y + my, 12, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke();
    }
  });
  ctx.globalAlpha = 1;
  return h;
}

// ---- canvas ----
function loadImg(src) {
  return new Promise((res, rej) => {
    const i = new Image();
    i.crossOrigin = 'anonymous';   // Supabase storage sends permissive CORS
    i.onload = () => res(i);
    i.onerror = () => rej(new Error('image load failed'));
    i.src = src;
  });
}

let _storyDrawSeq = 0;
async function drawStoryCard() {
  const c = document.getElementById('storyCanvas');
  if (!c) return;
  const seq = ++_storyDrawSeq; // guard against overlapping redraws from rapid toggle clicks
  const ctx = c.getContext('2d');
  const th = STORY_THEMES[storyState.theme] || STORY_THEMES.trail;
  const mDay = metricsFor('day'), mTrip = metricsFor('trip');
  const mFor = k => storyState.scopeOf[k] === 'trip' ? mTrip : mDay;

  ctx.clearRect(0, 0, STORY_W, STORY_H);

  // background: photo (cover + dim) or a vertical gradient
  let drew = false;
  if (storyState.photoUrl) {
    try {
      const img = await loadImg(storyState.photoUrl);
      if (seq !== _storyDrawSeq) return;
      const sc = Math.max(STORY_W / img.width, STORY_H / img.height);
      const w = img.width * sc, h = img.height * sc;
      ctx.drawImage(img, (STORY_W - w) / 2, (STORY_H - h) / 2, w, h);
      ctx.fillStyle = `rgba(20,21,15,${storyState.dim})`;
      ctx.fillRect(0, 0, STORY_W, STORY_H);
      drew = true;
    } catch (e) { /* fall through to the gradient */ }
  }
  if (!drew) {
    const g = ctx.createLinearGradient(0, 0, 0, STORY_H);
    g.addColorStop(0, th.bg);
    g.addColorStop(1, th.accent + '33');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, STORY_W, STORY_H);
  }

  ctx.textAlign = 'center';
  const bottomLimit = STORY_H - STORY_SAFE_BOTTOM;
  let y = STORY_SAFE_TOP + 50;
  const room = need => y + need <= bottomLimit;

  if (storyState.show.title && room(74)) {
    ctx.fillStyle = th.text;
    ctx.font = '800 62px Manrope, -apple-system, Segoe UI, sans-serif';
    wrapText(ctx, activeTrip.name.toUpperCase(), STORY_W / 2, y, 900, 74);
    y += 120;
  }
  if (storyState.show.day && room(70)) {
    const m = mFor('day');
    ctx.fillStyle = th.dim;
    ctx.font = '600 40px Manrope, -apple-system, Segoe UI, sans-serif';
    ctx.fillText(storyState.scopeOf.day === 'trip'
      ? `${_storyDays.length} DAYS`
      : `DAY ${m.idx + 1} OF ${_storyDays.length}`, STORY_W / 2, y);
    y += 70;
    if (m.label && room(56)) {
      ctx.fillStyle = th.text;
      ctx.font = '700 46px Manrope, -apple-system, Segoe ui, sans-serif';
      wrapText(ctx, m.label, STORY_W / 2, y, 900, 56);
      y += 90;
    }
  }

  if (storyState.show.profile && room(310)) {
    const scope = storyState.scopeOf.profile;
    const m = mFor('profile');
    const p = scope === 'trip' ? await storyTripProfile() : (m.day && m.day.gpx_url ? await fetchProfile(m.day.gpx_url) : null);
    if (seq !== _storyDrawSeq) return;
    if (p && p.hasEle) {
      const px = 110, pw = STORY_W - 220, ph = 220, py = y;
      const minE = p.minEle, spanE = (p.maxEle - p.minEle) || 1;
      ctx.beginPath();
      const step = Math.max(1, Math.floor(p.dist.length / 200));
      for (let i = 0; i < p.dist.length; i += step) {
        const X = px + (p.dist[i] / p.totalKm) * pw;
        const Y = py + ph - ((p.ele[i] - minE) / spanE) * ph;
        i === 0 ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y);
      }
      ctx.strokeStyle = th.accent; ctx.lineWidth = 6; ctx.lineJoin = 'round'; ctx.stroke();
      ctx.lineTo(px + pw, py + ph); ctx.lineTo(px, py + ph); ctx.closePath();
      ctx.fillStyle = th.accent + '2E'; ctx.fill();
      if (m.done > 0 && p.totalKm) {
        const fx = px + Math.min(1, m.done / p.totalKm) * pw;
        ctx.beginPath(); ctx.moveTo(fx, py - 10); ctx.lineTo(fx, py + ph);
        ctx.strokeStyle = th.text; ctx.lineWidth = 4; ctx.setLineDash([12, 10]); ctx.stroke(); ctx.setLineDash([]);
        ctx.beginPath(); ctx.arc(fx, py + ph, 16, 0, Math.PI * 2); ctx.fillStyle = th.text; ctx.fill();
      }
      y += ph + 90;
    }
  }

  if (storyState.show.map && room(200)) {
    const scope = storyState.scopeOf.map;
    const boxH = Math.min(460, bottomLimit - y);
    const consumed = await drawStoryTrace(ctx, 60, y, STORY_W - 120, boxH, scope);
    if (seq !== _storyDrawSeq) return;
    if (consumed) y += consumed + 50;
  }

  if (storyState.show.distance && room(90)) {
    const m = mFor('distance');
    ctx.fillStyle = th.accent;
    ctx.font = '800 110px Manrope, -apple-system, Segoe UI, sans-serif';
    ctx.fillText(m.km ? `${Math.round(m.done)} / ${Math.round(m.km)} km` : `${Math.round(m.done)} km`, STORY_W / 2, y);
    y += 80;
  }
  if (storyState.show.elevation && room(66)) {
    const m = mFor('elevation');
    if (m.ascent) {
      ctx.fillStyle = th.dim;
      ctx.font = '500 42px Manrope, -apple-system, Segoe UI, sans-serif';
      ctx.fillText(`+${Math.round(m.ascent)} m climbed${storyState.scopeOf.elevation === 'trip' ? ' in total' : ' today'}`, STORY_W / 2, y);
      y += 66;
    }
  }
  if (storyState.show.pace && room(60)) {
    const kmh = storyPaceKmh(storyState.scopeOf.pace);
    if (kmh) {
      ctx.fillStyle = th.dim;
      ctx.font = '500 38px Manrope, -apple-system, Segoe UI, sans-serif';
      ctx.fillText(`⚡ ${kmh.toFixed(1)} km/h avg`, STORY_W / 2, y);
      y += 60;
    }
  }
  if (storyState.show.weather && room(60)) {
    const wx = await storyWeather();
    if (seq !== _storyDrawSeq) return;
    if (wx) {
      ctx.fillStyle = th.dim;
      ctx.font = '500 38px Manrope, -apple-system, Segoe UI, sans-serif';
      ctx.fillText(`🌡 ${Math.round(wx.min)}–${Math.round(wx.max)}°C`, STORY_W / 2, y);
      y += 60;
    }
  }
  if (storyState.show.place && room(52)) {
    const row = currentPhotoRow();
    if (row && row.place_name) {
      ctx.fillStyle = th.dim;
      ctx.font = '500 36px Manrope, -apple-system, Segoe UI, sans-serif';
      ctx.fillText(`📍 ${row.place_name}`, STORY_W / 2, y);
      y += 52;
    }
  }
  if (storyState.show.stay && room(60)) {
    ctx.fillStyle = th.dim;
    ctx.font = '500 38px Manrope, -apple-system, Segoe UI, sans-serif';
    ctx.fillText('🏠 tonight', STORY_W / 2, y);
    y += 60;
  }
  if (storyState.show.url) {
    ctx.fillStyle = th.dim;
    ctx.font = '600 34px Manrope, -apple-system, Segoe UI, sans-serif';
    ctx.fillText('triptracker.cc', STORY_W / 2, bottomLimit - 40);
  }
}

// Clean follow-on frame: full-bleed photo, no dim, just a pin+time strip
// tucked above the bottom safe line.
async function drawCleanCard(canvas, photoRow) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, STORY_W, STORY_H);
  try {
    const img = await loadImg(photoRow.photo_url);
    const sc = Math.max(STORY_W / img.width, STORY_H / img.height);
    const w = img.width * sc, h = img.height * sc;
    ctx.drawImage(img, (STORY_W - w) / 2, (STORY_H - h) / 2, w, h);
  } catch (e) {
    ctx.fillStyle = '#23261E'; ctx.fillRect(0, 0, STORY_W, STORY_H);
  }

  const hasPlace = !!photoRow.place_name;
  const hasTime = !!(photoRow.taken_at || photoRow.created_at);
  if (!hasPlace && !hasTime) return;

  const bandH = 190, bandY = STORY_H - STORY_SAFE_BOTTOM - bandH;
  const g = ctx.createLinearGradient(0, bandY, 0, bandY + bandH);
  g.addColorStop(0, 'rgba(10,10,8,0)'); g.addColorStop(1, 'rgba(10,10,8,.6)');
  ctx.fillStyle = g; ctx.fillRect(0, bandY, STORY_W, bandH);

  ctx.textAlign = 'left';
  let ty = bandY + bandH - 46;
  if (hasTime) {
    const d = new Date(photoRow.taken_at || photoRow.created_at);
    ctx.font = '500 32px Manrope, -apple-system, Segoe UI, sans-serif';
    ctx.fillStyle = 'rgba(251,250,246,.85)';
    ctx.fillText(d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }), 60, ty);
    ty -= 52;
  }
  if (hasPlace) {
    ctx.font = '700 40px Manrope, -apple-system, Segoe UI, sans-serif';
    ctx.fillStyle = '#FBFAF6';
    ctx.fillText('📍 ' + photoRow.place_name, 60, ty);
  }
}

async function renderExtraCards() {
  const strip = document.getElementById('storyExtraStrip');
  if (!strip || !storyState.extraPhotoIds.length) return;
  strip.innerHTML = storyState.extraPhotoIds.map(id => `
    <div style="flex:none;text-align:center;">
      <canvas id="extraCanvas_${id}" width="${STORY_W}" height="${STORY_H}" style="width:130px;height:auto;border-radius:10px;box-shadow:var(--shadow-e2);display:block;"></canvas>
      <button class="btn btn-sm" style="margin-top:6px;" onclick="downloadExtraCard('${id}')">⬇</button>
    </div>`).join('');
  for (const id of storyState.extraPhotoIds) {
    const row = _storyPhotos.find(p => p.id === id);
    const canvas = document.getElementById('extraCanvas_' + id);
    if (row && canvas) await drawCleanCard(canvas, row);
  }
}
function downloadExtraCard(id) {
  const canvas = document.getElementById('extraCanvas_' + id);
  if (!canvas) return;
  canvas.toBlob(b => {
    const url = URL.createObjectURL(b);
    const a = document.createElement('a');
    a.href = url; a.download = `${(activeTrip.slug || 'trip')}-frame-${id.slice(0, 8)}.png`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'image/png');
}
async function downloadAllFrames() {
  await storyDownload();
  for (const id of storyState.extraPhotoIds) {
    await new Promise(r => setTimeout(r, 350)); // stagger — back-to-back downloads get blocked by some browsers
    downloadExtraCard(id);
  }
}

function wrapText(ctx, text, x, y, maxW, lh) {
  const words = String(text || '').split(' ');
  let line = '', yy = y;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, yy); line = w; yy += lh; }
    else line = test;
  }
  if (line) ctx.fillText(line, x, yy);
}

async function storyDownload() {
  const msg = document.getElementById('storyMsg');
  if (msg) { msg.textContent = 'Rendering…'; msg.className = 'saveIndicator saving'; }
  try {
    await drawStoryCard();
    const c = document.getElementById('storyCanvas');
    c.toBlob(b => {
      const url = URL.createObjectURL(b);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(activeTrip.slug || 'trip')}-story-${Date.now()}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      if (msg) { msg.textContent = '✓ Downloaded'; msg.className = 'saveIndicator saved'; }
    }, 'image/png');
  } catch (e) {
    // A photo served without CORS headers taints the canvas and blocks export.
    if (msg) { msg.textContent = 'Could not export — try a different background photo.'; msg.className = 'saveIndicator'; }
  }
}

// ---- gallery: upload, delete, lightbox ----
async function uploadPhoto() {
  const file = document.getElementById('photoFile').files[0];
  if (!file) { alert('Pick a file first.'); return; }
  const status = document.getElementById('photoStatus');
  status.textContent = 'Reading photo…'; status.className = 'saveIndicator saving';

  // GPS + capture time read client-side from EXIF (exifr, no backend). Place
  // name is a best-effort reverse-geocode against the free OSM Nominatim API
  // (no key) — it resolves to the nearest named settlement/area, so it won't
  // always surface an unnamed landmark, but costs nothing and needs no infra.
  let lat = null, lon = null, takenAt = null, placeName = null;
  if (typeof exifr !== 'undefined') {
    try {
      const gps = await exifr.gps(file);
      if (gps && gps.latitude != null) { lat = gps.latitude; lon = gps.longitude; }
    } catch (e) { /* no GPS block in this photo — fine */ }
    try {
      const tags = await exifr.parse(file, { pick: ['DateTimeOriginal'] });
      if (tags && tags.DateTimeOriginal) takenAt = new Date(tags.DateTimeOriginal).toISOString();
    } catch (e) { /* no EXIF at all — fine */ }
  }
  if (lat != null && lon != null) {
    status.textContent = 'Looking up location…';
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=14&accept-language=en`);
      if (res.ok) {
        const j = await res.json();
        const a = j.address || {};
        placeName = a.hamlet || a.village || a.town || a.suburb || a.city_district || a.city
          || a.county || (j.display_name ? j.display_name.split(',')[0] : null);
      }
    } catch (e) { /* offline or rate-limited — not fatal, just no place name */ }
  }

  status.textContent = 'Uploading…'; status.className = 'saveIndicator saving';
  const ext = file.name.split('.').pop().toLowerCase();
  const path = `trips/${activeTrip.id}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
  const { error: upErr } = await sb.storage.from('photos').upload(path, file, { cacheControl: '3600' });
  if (upErr) { status.textContent = 'Upload failed: ' + upErr.message; status.className = 'saveIndicator'; return; }
  const { data: { publicUrl } } = sb.storage.from('photos').getPublicUrl(path);
  const dayId = document.getElementById('photoDay').value || null;
  const caption = document.getElementById('photoCaption').value.trim() || null;
  const { error: insErr } = await db().from('updates').insert({
    trip_id: activeTrip.id, day_id: dayId,
    membership_id: activeMembership?.id || null,
    caption, photo_url: publicUrl,
    lat, lon, place_name: placeName, taken_at: takenAt,
  });
  if (insErr) { status.textContent = 'DB error: ' + insErr.message; status.className = 'saveIndicator'; return; }
  status.textContent = '✓ Uploaded' + (placeName ? ` — 📍 ${placeName}` : ''); status.className = 'saveIndicator saved';
  _rerenderPhotoTab();
}
async function deletePhoto(id, url) {
  if (!confirm('Delete this photo? This cannot be undone.')) return;
  const storagePath = url.split('/photos/').slice(1).join('/photos/');
  if (storagePath) await sb.storage.from('photos').remove([storagePath]);
  await db().from('updates').delete().eq('id', id);
  _rerenderPhotoTab();
}
function storySetPhoto(url) {
  storyState.photoUrl = url;
  const route = parseRoute();
  if (route.view === 'trip' && route.section === 'gallery') goTrip(activeTrip.id, 'photos');
  else renderStoryModule();
}
function adminOpenLightbox(url, caption) {
  const lb = document.getElementById('admin-lb');
  document.getElementById('admin-lb-img').src = url;
  document.getElementById('admin-lb-cap').textContent = caption || '';
  lb.style.display = 'flex';
  document.addEventListener('keydown', adminLbKey);
}
function adminCloseLightbox() {
  document.getElementById('admin-lb').style.display = 'none';
  document.removeEventListener('keydown', adminLbKey);
}
function adminLbKey(e) { if (e.key === 'Escape') adminCloseLightbox(); }
