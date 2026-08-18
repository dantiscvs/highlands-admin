// Story — the photo gallery plus a story-card generator.
//
// The legacy PWA could export one fixed 1080x1920 image with a hard-coded
// Highlands basemap. This version keeps the idea and makes it general and
// configurable: pick a background photo, pick whether the card is about one
// day or the whole trip (that choice now consistently drives every number and
// chart on it, which the previous version did not), toggle which elements are
// burned in, and save the combination as a reusable preset.

const STORY_W = 1080, STORY_H = 1920;
const STORY_THEMES = {
  trail:  { bg: '#23261E', accent: '#7FB587', text: '#FBFAF6', dim: 'rgba(251,250,246,.72)' },
  ember:  { bg: '#2A1B12', accent: '#E08A54', text: '#FBFAF6', dim: 'rgba(251,250,246,.72)' },
  slate:  { bg: '#1B1D18', accent: '#86B4CC', text: '#FBFAF6', dim: 'rgba(251,250,246,.72)' },
};
const STORY_PRESETS_KEY = 'storyPresets'; // global — a look you like is worth reusing on the next trip

let storyState = {
  photoUrl: null,          // background photo, or null for a gradient
  dayId: null,
  scope: 'day',             // 'day' | 'trip' — drives every stat and chart consistently
  theme: 'trail',
  show: { title: true, day: true, distance: true, elevation: true, profile: true, map: false, stay: false, url: true },
  dim: 0.5,
};
let _storyDays = [], _storyPhotos = [], _storyProgress = {};

async function renderStoryModule() {
  if (moduleGate('photos')) return;
  const main = document.getElementById('main');
  main.innerHTML = '<p class="muted">Loading…</p>';

  const [{ data: updates }, { data: days }, { data: prog }] = await Promise.all([
    db().from('updates').select('*').eq('trip_id', activeTrip.id).not('photo_url', 'is', null).order('created_at', { ascending: false }),
    db().from('trip_days').select('*').eq('trip_id', activeTrip.id).order('order_index'),
    db().from('day_progress').select('*').eq('trip_id', activeTrip.id),
  ]);
  _storyPhotos = updates || [];
  _storyDays = days || [];
  _storyProgress = {};
  (prog || []).forEach(p => { _storyProgress[p.day_id] = Number(p.ridden_km) || 0; });

  if (!storyState.dayId) {
    const iso = todayIso();
    const d = _storyDays.find(x => x.date === iso) || _storyDays.find(x => x.distance_km) || _storyDays[0];
    storyState.dayId = d ? d.id : null;
  }
  if (!storyState.photoUrl && _storyPhotos.length) storyState.photoUrl = _storyPhotos[0].photo_url;

  main.innerHTML = `
    <div class="pagehead">
      <div><h1>Story</h1><div class="subtitle">The trip's photo gallery, and shareable story cards built from it.</div></div>
    </div>

    <div class="storygrid">
      <div>
        <div class="card" style="margin-bottom:14px;">
          <h2>Story card</h2>
          <p class="muted" style="font-size:var(--text-sm);margin-bottom:14px;">
            1080 × 1920, sized for Instagram and WhatsApp stories. Rendered in your browser — the photo
            never leaves the page to make one.</p>

          <div class="field"><label>About</label>
            <div class="storyscope">
              <button class="btn btn-sm ${storyState.scope === 'day' ? 'btn-primary' : ''}" onclick="storySet('scope','day')">This day</button>
              <button class="btn btn-sm ${storyState.scope === 'trip' ? 'btn-primary' : ''}" onclick="storySet('scope','trip')">Whole trip</button>
            </div>
          </div>

          <div class="field"><label>${storyState.scope === 'trip' ? 'Progress marker on' : 'Day'}</label>
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
                  onclick="storySetPhoto('${esc(p.photo_url)}')">
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
              ${[['title','Trip name'],['day','Day counter'],['distance','Distance'],['elevation','Climbing'],
                 ['profile','Elevation profile'],['map', storyState.scope === 'trip' ? 'Route map (all days)' : 'Route map (this day)'],
                 ['stay','Tonight\'s stay'],['url','Follow link']]
                .map(([k, l]) => `<label><input type="checkbox" ${storyState.show[k] ? 'checked' : ''}
                  onchange="storyToggle('${k}', this.checked)"> ${l}</label>`).join('')}
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
            <button class="btn btn-primary" onclick="storyDownload()">⬇ Download story</button>
            <span id="storyMsg" class="saveIndicator"></span>
          </div>
        </div>
      </div>

      <div>
        <div class="storypreview"><canvas id="storyCanvas" width="${STORY_W}" height="${STORY_H}"></canvas></div>
        <div class="muted" style="font-size:var(--text-xs);text-align:center;margin-top:8px;" id="storyPreviewCap">Live preview</div>
      </div>
    </div>

    ${canPostPhotos() ? `<div class="card" style="margin-top:20px;">
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
    </div>` : ''}

    <h2 style="margin-top:26px;">Gallery</h2>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;">
      ${_storyPhotos.map(u => `
        <div class="card" style="padding:8px;position:relative;">
          <img src="${esc(u.photo_url)}" alt="${esc(u.caption || '')}" loading="lazy"
            style="width:100%;height:140px;object-fit:cover;border-radius:8px;display:block;cursor:zoom-in;"
            onclick="adminOpenLightbox('${esc(u.photo_url)}','${esc(u.caption || '')}')">
          ${u.caption ? `<div style="font-size:12px;margin-top:6px;color:var(--text-secondary);">${esc(u.caption)}</div>` : ''}
          <div style="font-size:11px;color:var(--text-tertiary);margin-top:3px;">${u.created_at ? new Date(u.created_at).toLocaleDateString() : ''}</div>
          <button class="btn btn-sm" style="position:absolute;top:8px;left:8px;padding:2px 7px;font-size:11px;"
            onclick="storySetPhoto('${esc(u.photo_url)}')" title="Use as story background">📲</button>
          ${(isEditor() || (activeMembership && u.membership_id === activeMembership.id))
            ? `<button class="btn btn-sm btn-danger" style="position:absolute;top:8px;right:8px;padding:2px 7px;font-size:11px;" onclick="deletePhoto('${u.id}','${esc(u.photo_url)}')">✕</button>` : ''}
        </div>`).join('') || '<p class="muted">No photos yet.</p>'}
    </div>

    <div id="admin-lb" onclick="adminCloseLightbox()" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:9999;align-items:center;justify-content:center;cursor:zoom-out;flex-direction:column;gap:12px;">
      <img id="admin-lb-img" src="" style="max-width:90vw;max-height:85vh;border-radius:12px;object-fit:contain;">
      <div id="admin-lb-cap" style="color:#fff;font-size:14px;text-align:center;max-width:500px;opacity:.85;"></div>
    </div>
  `;
  drawStoryCard();
}

// ---- controls ----
function storySet(k, v) {
  storyState[k] = v;
  if (k === 'dayId' || k === 'photoUrl' || k === 'scope') renderStoryModule();
  else { drawStoryCard(); refreshStoryControls(); }
}
function storySetPhoto(url) { storyState.photoUrl = url; renderStoryModule(); }
function storyToggle(k, on) { storyState.show[k] = on; drawStoryCard(); }
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
  presets.push({ name, theme: storyState.theme, dim: storyState.dim, scope: storyState.scope, show: { ...storyState.show } });
  localStorage.setItem(STORY_PRESETS_KEY, JSON.stringify(presets));
  renderStoryModule();
}
function storyApplyPreset() {
  const sel = document.getElementById('storyPresetSelect');
  const p = storyPresets()[sel.value];
  if (!p) return;
  storyState.theme = p.theme; storyState.dim = p.dim; storyState.scope = p.scope;
  storyState.show = { ...storyState.show, ...p.show };
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

// ---- data helpers (scope-consistent) ----
// Every number and chart on the card reads from this one object, so "This
// day" vs "Whole trip" can never disagree with itself the way the first
// version did (a single day's elevation profile next to the whole trip's km).
function storyMetrics() {
  const day = _storyDays.find(d => d.id === storyState.dayId);
  const idx = _storyDays.findIndex(d => d.id === storyState.dayId);
  if (storyState.scope === 'day') {
    const km = day ? Number(day.distance_km) || 0 : 0;
    const done = day ? (_storyProgress[day.id] || 0) : 0;
    return { day, idx, km, done, ascent: day ? Number(day.ascent_m) || 0 : 0, label: day ? day.title : '' };
  }
  const km = _storyDays.reduce((s, d) => s + (Number(d.distance_km) || 0), 0);
  const done = _storyDays.reduce((s, d) => s + (_storyProgress[d.id] || 0), 0);
  const ascent = _storyDays.reduce((s, d) => s + (Number(d.ascent_m) || 0), 0);
  return { day, idx, km, done, ascent, label: activeTrip.name };
}

// Merge every day's elevation profile end to end so "Whole trip" gets one
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

async function storyRouteDays() {
  // Trip scope: every day with a track. Day scope: just the selected one —
  // still drawn through the same projector so a single stage reads as a
  // clean, well-framed line rather than a tiny squiggle in a trip-sized box.
  if (storyState.scope === 'trip') return _storyDays.filter(d => d.gpx_url);
  const day = _storyDays.find(d => d.id === storyState.dayId);
  return day && day.gpx_url ? [day] : [];
}

async function drawStoryTrace(ctx, x, y, w, h) {
  const routeDays = await storyRouteDays();
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
    if (storyState.scope === 'day') litFrac = 1;
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
  const m = storyMetrics();

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
  let y = 300;

  if (storyState.show.title) {
    ctx.fillStyle = th.text;
    ctx.font = '800 62px Manrope, -apple-system, Segoe UI, sans-serif';
    wrapText(ctx, activeTrip.name.toUpperCase(), STORY_W / 2, y, 900, 74);
    y += 120;
  }
  if (storyState.show.day) {
    ctx.fillStyle = th.dim;
    ctx.font = '600 40px Manrope, -apple-system, Segoe UI, sans-serif';
    ctx.fillText(storyState.scope === 'trip'
      ? `${_storyDays.length} DAYS`
      : `DAY ${m.idx + 1} OF ${_storyDays.length}`, STORY_W / 2, y);
    y += 70;
    if (m.label) {
      ctx.fillStyle = th.text;
      ctx.font = '700 46px Manrope, -apple-system, Segoe ui, sans-serif';
      wrapText(ctx, m.label, STORY_W / 2, y, 900, 56);
      y += 90;
    }
  }

  if (storyState.show.profile) {
    const p = storyState.scope === 'trip' ? await storyTripProfile() : (m.day && m.day.gpx_url ? await fetchProfile(m.day.gpx_url) : null);
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

  if (storyState.show.map) {
    const boxH = 460;
    const consumed = await drawStoryTrace(ctx, 60, y, STORY_W - 120, boxH);
    if (seq !== _storyDrawSeq) return;
    if (consumed) y += boxH + 50;
  }

  if (storyState.show.distance) {
    ctx.fillStyle = th.accent;
    ctx.font = '800 110px Manrope, -apple-system, Segoe UI, sans-serif';
    ctx.fillText(m.km ? `${Math.round(m.done)} / ${Math.round(m.km)} km` : `${Math.round(m.done)} km`, STORY_W / 2, y);
    y += 80;
  }
  if (storyState.show.elevation && m.ascent) {
    ctx.fillStyle = th.dim;
    ctx.font = '500 42px Manrope, -apple-system, Segoe UI, sans-serif';
    ctx.fillText(`+${Math.round(m.ascent)} m climbed${storyState.scope === 'trip' ? ' in total' : ' today'}`, STORY_W / 2, y);
    y += 66;
  }
  if (storyState.show.stay) {
    ctx.fillStyle = th.dim;
    ctx.font = '500 38px Manrope, -apple-system, Segoe UI, sans-serif';
    ctx.fillText('🏠 tonight', STORY_W / 2, y);
    y += 60;
  }
  if (storyState.show.url) {
    ctx.fillStyle = th.dim;
    ctx.font = '600 34px Manrope, -apple-system, Segoe UI, sans-serif';
    ctx.fillText('triptracker.cc', STORY_W / 2, STORY_H - 110);
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
  msg.textContent = 'Rendering…'; msg.className = 'saveIndicator saving';
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
      msg.textContent = '✓ Downloaded'; msg.className = 'saveIndicator saved';
    }, 'image/png');
  } catch (e) {
    // A photo served without CORS headers taints the canvas and blocks export.
    msg.textContent = 'Could not export — try a different background photo.';
    msg.className = 'saveIndicator';
  }
}

// ---- gallery: upload, delete, lightbox ----
async function uploadPhoto() {
  const file = document.getElementById('photoFile').files[0];
  if (!file) { alert('Pick a file first.'); return; }
  const status = document.getElementById('photoStatus');
  status.textContent = 'Uploading…'; status.className = 'saveIndicator saving';
  const ext = file.name.split('.').pop().toLowerCase();
  const path = `trips/${activeTrip.id}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
  const { error: upErr } = await db().storage.from('photos').upload(path, file, { cacheControl: '3600' });
  if (upErr) { status.textContent = 'Upload failed: ' + upErr.message; status.className = 'saveIndicator'; return; }
  const { data: { publicUrl } } = db().storage.from('photos').getPublicUrl(path);
  const dayId = document.getElementById('photoDay').value || null;
  const caption = document.getElementById('photoCaption').value.trim() || null;
  const { error: insErr } = await db().from('updates').insert({
    trip_id: activeTrip.id, day_id: dayId,
    membership_id: activeMembership?.id || null,
    caption, photo_url: publicUrl,
  });
  if (insErr) { status.textContent = 'DB error: ' + insErr.message; status.className = 'saveIndicator'; return; }
  status.textContent = '✓ Uploaded'; status.className = 'saveIndicator saved';
  renderStoryModule();
}
async function deletePhoto(id, url) {
  if (!confirm('Delete this photo? This cannot be undone.')) return;
  const storagePath = url.split('/photos/').slice(1).join('/photos/');
  if (storagePath) await db().storage.from('photos').remove([storagePath]);
  await db().from('updates').delete().eq('id', id);
  renderStoryModule();
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
