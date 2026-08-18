// Weather — a meteogram per trip day, rebuilt from the legacy Highlands PWA
// in the Trip Tracker design language.
//
// Two things changed from the original. The legacy version hard-coded a
// lat/lon per day for one specific trip; here the location is derived from the
// end of that day's GPX track (where you will actually be that evening) and
// cached on the day, with a manual fallback. And the panels use the app's
// tokens so the chart sits in the page rather than on it.
//
// Data: Open-Meteo, no API key. Cached in localStorage for three hours so
// flicking between days is instant and a flaky connection still shows
// something.

const WX_MODELS = [
  { id: 'best_match',   label: 'Auto (best available)' },
  { id: 'gfs_seamless', label: 'GFS (NOAA)' },
  { id: 'ukmo_seamless',label: 'UK Met Office' },
  { id: 'ecmwf_ifs025', label: 'ECMWF' },
  { id: 'icon_seamless',label: 'ICON (DWD)' },
];
const WX_HOURLY = ['temperature_2m','apparent_temperature','dew_point_2m','precipitation',
  'precipitation_probability','relative_humidity_2m','wind_speed_10m','wind_gusts_10m',
  'wind_direction_10m','cloud_cover_low','cloud_cover_mid','cloud_cover_high'];

let wxModel = localStorage.getItem('wxModel') || 'best_match';
let wxDayId = null;
let wxWindowStart = 0;
let wxKeepWindow = false;
let wxMaxStart = 0;
let _wxDays = [];

function wxFillNulls(a) { let last = 0; return (a || []).map(v => { if (v == null) return last; last = v; return v; }); }

async function wxFetch(lat, lon, force) {
  const key = `wx_${lat.toFixed(3)}_${lon.toFixed(3)}_${wxModel}`;
  let cached = null;
  try { cached = JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) {}
  const fresh = cached && (Date.now() - cached.fetchedAt < 3 * 60 * 60 * 1000);
  if (fresh && !force) return cached;
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`
      + `&hourly=${WX_HOURLY.join(',')}&daily=sunrise,sunset&timezone=auto&forecast_days=16&models=${wxModel}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const j = await res.json();
    WX_HOURLY.forEach(k => { if (j.hourly[k]) j.hourly[k] = wxFillNulls(j.hourly[k]); });
    const out = { fetchedAt: Date.now(), hourly: j.hourly, daily: j.daily };
    try { localStorage.setItem(key, JSON.stringify(out)); } catch (e) {} // quota — fine, just uncached
    return out;
  } catch (e) {
    return cached; // stale beats nothing
  }
}

// Where is this day? Stored coords win; otherwise take the end of the GPX
// track and write it back so we only pay for that once.
async function wxCoordsFor(day) {
  if (day.lat != null && day.lon != null) return { lat: day.lat, lon: day.lon, derived: false };
  if (!day.gpx_url) return null;
  const p = await fetchProfile(day.gpx_url);
  if (!p || !p.endLatLon) return null;
  const [lat, lon] = p.endLatLon;
  day.lat = lat; day.lon = lon;
  if (isEditor()) db().from('trip_days').update({ lat, lon }).eq('id', day.id).then(() => {});
  return { lat, lon, derived: true };
}

async function renderWeatherSection() {
  if (moduleGate('weather')) return;
  const main = document.getElementById('main');
  main.innerHTML = '<p class="muted">Loading forecast…</p>';

  const { data: days } = await db().from('trip_days').select('*').eq('trip_id', activeTrip.id).order('order_index');
  _wxDays = days || [];
  if (!_wxDays.length) {
    main.innerHTML = `<div class="pagehead"><div><h1>Weather</h1></div></div>
      <div class="empty-state"><div class="empty-title">No days yet</div>
      <div class="empty-desc">Add days in <a href="#" onclick="event.preventDefault();goTrip(activeTrip.id,'grid');">Route &amp; Days</a> first.</div></div>`;
    return;
  }

  // Default to today's stage if the trip is running, else the first day.
  if (!wxDayId || !_wxDays.some(d => d.id === wxDayId)) {
    const iso = todayIso();
    wxDayId = (_wxDays.find(d => d.date === iso) || _wxDays[0]).id;
  }
  const day = _wxDays.find(d => d.id === wxDayId);
  const coords = await wxCoordsFor(day);

  const head = `
    <div class="pagehead">
      <div><h1>Weather</h1><div class="subtitle">Hourly forecast for where each stage ends.</div></div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <select onchange="wxSelectModel(this.value)" title="Forecast model">
          ${WX_MODELS.map(m => `<option value="${m.id}" ${m.id === wxModel ? 'selected' : ''}>${esc(m.label)}</option>`).join('')}
        </select>
        <button class="btn btn-sm" onclick="wxRefresh()">↻ Refresh</button>
      </div>
    </div>
    <div class="wxdays">
      ${_wxDays.map(d => `<button class="wxday ${d.id === wxDayId ? 'on' : ''}" onclick="wxSelectDay('${d.id}')">
        <b>Day ${d.day_number}</b><span>${d.date ? fmtDate(d.date) : '—'}</span>
      </button>`).join('')}
    </div>`;

  if (!coords) {
    main.innerHTML = head + `
      <div class="empty-state" style="margin-top:16px;">
        <div class="empty-title">No location for this day</div>
        <div class="empty-desc">Weather needs a point to forecast for. Attach a GPX track to this day
          ${isEditor() ? '(Route &amp; Days → ⋯ → upload) and the end of the stage is used automatically' : ''},
          or set coordinates below.</div>
        ${isEditor() ? `<div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap;justify-content:center;">
          <input id="wxLat" type="number" step="0.0001" placeholder="Latitude" style="width:130px;">
          <input id="wxLon" type="number" step="0.0001" placeholder="Longitude" style="width:130px;">
          <button class="btn btn-primary btn-sm" onclick="wxSaveCoords('${day.id}')">Save</button>
        </div>` : ''}
      </div>`;
    return;
  }

  const data = await wxFetch(coords.lat, coords.lon);
  if (!data) {
    main.innerHTML = head + `<div class="empty-state" style="margin-top:16px;">
      <div class="empty-title">Forecast unavailable</div>
      <div class="empty-desc">Could not reach the forecast service, and nothing is cached for this
        point yet. It needs a connection the first time.</div></div>`;
    return;
  }

  // Open the window a few hours before the stage starts, unless the user has
  // paged forward or back and we are just re-rendering.
  if (!wxKeepWindow) {
    const target = day.date || (data.hourly.time[0] || '').slice(0, 10);
    const idx = data.hourly.time.findIndex(t => t.startsWith(target));
    wxWindowStart = idx === -1 ? 0 : Math.max(0, idx - 3);
  }
  wxKeepWindow = false;
  wxMaxStart = Math.max(0, data.hourly.time.length - 48);
  wxWindowStart = Math.min(wxWindowStart, wxMaxStart);

  main.innerHTML = head + wxBodyHtml(data, day, coords);
}

function wxBodyHtml(data, day, coords) {
  const HOURS = 48;
  const H = data.hourly;
  const s = wxWindowStart;
  const slice = k => (H[k] || []).slice(s, s + HOURS);
  const times = slice('time');
  if (!times.length) return '<p class="muted">No forecast data in this range.</p>';

  const temp = slice('temperature_2m'), app = slice('apparent_temperature'), dew = slice('dew_point_2m');
  const precip = slice('precipitation'), pprob = slice('precipitation_probability');
  const wind = slice('wind_speed_10m'), gust = slice('wind_gusts_10m'), wdir = slice('wind_direction_10m');
  const cLow = slice('cloud_cover_low'), cMid = slice('cloud_cover_mid'), cHi = slice('cloud_cover_high');

  const sun = {};
  (data.daily.time || []).forEach((d, i) => { sun[d] = { rise: data.daily.sunrise[i], set: data.daily.sunset[i] }; });
  const isNight = iso => { const k = sun[iso.slice(0, 10)]; return k ? (iso < k.rise || iso > k.set) : false; };

  // ---- geometry ----
  const colW = 30, padL = 44, padR = 12;
  const W = padL + padR + times.length * colW;
  const hHdr = 24, gap = 12, hT = 130, hP = 88, hW = 78, hC = 64, hAxis = 20;
  const yT = hHdr, yP = yT + hT + gap, yWi = yP + hP + gap, yC = yWi + hW + gap, yAx = yC + hC;
  const total = yAx + hAxis;
  const x = i => padL + i * colW + colW / 2;

  const scale = (min, max, top, h) => { const sp = (max - min) || 1; return v => top + h - ((v - min) / sp) * h; };
  const path = (arr, f) => arr.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${f(v).toFixed(1)}`).join(' ');
  const niceStep = r => { for (const c of [1, 2, 5, 10, 20, 50]) if (r / c <= 6) return c; return 100; };

  // night shading + day separators
  let bands = '', hdrs = '';
  for (let i = 0; i < times.length; i++) {
    if (isNight(times[i])) bands += `<rect x="${padL + i * colW}" y="${hHdr}" width="${colW}" height="${total - hAxis - hHdr}" fill="var(--wx-night)"/>`;
  }
  for (let i = 0; i < times.length;) {
    const d = times[i].slice(0, 10); let j = i;
    while (j < times.length && times[j].slice(0, 10) === d) j++;
    const cx = padL + (i + (j - i) / 2) * colW;
    const lbl = new Date(d + 'T12:00:00').toLocaleDateString([], { weekday: 'short', day: '2-digit', month: 'short' });
    hdrs += `<text x="${cx}" y="16" text-anchor="middle" font-size="11" font-weight="700" fill="var(--text-secondary)">${lbl}</text>`;
    if (i > 0) hdrs += `<line x1="${padL + i * colW}" y1="${hHdr}" x2="${padL + i * colW}" y2="${total - hAxis}" stroke="var(--border-strong)"/>`;
    i = j;
  }

  // ---- temperature ----
  const tAll = [...temp, ...app, ...dew];
  const tMin = Math.floor(Math.min(...tAll) - 2), tMax = Math.ceil(Math.max(...tAll) + 2);
  const fT = scale(tMin, tMax, yT, hT);
  const tStep = niceStep(tMax - tMin);
  let tGrid = '';
  for (let v = Math.ceil(tMin / tStep) * tStep; v <= tMax; v += tStep) {
    tGrid += `<line x1="${padL}" y1="${fT(v).toFixed(1)}" x2="${W - padR}" y2="${fT(v).toFixed(1)}" stroke="${v === 0 ? 'var(--color-info)' : 'var(--border-hairline)'}" stroke-width="1"/>`
           + `<text x="${padL - 6}" y="${(fT(v) + 3).toFixed(1)}" text-anchor="end" font-size="10" fill="var(--text-tertiary)">${v}°</text>`;
  }

  // ---- precipitation (bars) + probability (line) ----
  const pMax = Math.max(2, Math.ceil(Math.max(...precip) * 1.3));
  const fP = scale(0, pMax, yP, hP * .78), fProb = scale(0, 100, yP, hP);
  let pBars = '';
  for (let i = 0; i < times.length; i++) {
    if (precip[i] > 0) {
      const y = fP(precip[i]);
      pBars += `<rect x="${padL + i * colW + 4}" y="${y.toFixed(1)}" width="${colW - 8}" height="${(yP + hP * .78 - y).toFixed(1)}" rx="2" fill="var(--color-info)" opacity=".8"><title>${precip[i]} mm</title></rect>`;
    }
  }
  let pGrid = '';
  for (const v of [0, pMax / 2, pMax]) {
    pGrid += `<line x1="${padL}" y1="${fP(v).toFixed(1)}" x2="${W - padR}" y2="${fP(v).toFixed(1)}" stroke="var(--border-hairline)"/>`
           + `<text x="${padL - 6}" y="${(fP(v) + 3).toFixed(1)}" text-anchor="end" font-size="10" fill="var(--text-tertiary)">${v.toFixed(v < 10 ? 1 : 0)}</text>`;
  }

  // ---- wind + gusts ----
  const wMax = Math.ceil(Math.max(...gust, ...wind, 10) * 1.15);
  const fW = scale(0, wMax, yWi, hW);
  let wGrid = '';
  for (const v of [0, Math.round(wMax / 2), wMax]) {
    wGrid += `<line x1="${padL}" y1="${fW(v).toFixed(1)}" x2="${W - padR}" y2="${fW(v).toFixed(1)}" stroke="var(--border-hairline)"/>`
           + `<text x="${padL - 6}" y="${(fW(v) + 3).toFixed(1)}" text-anchor="end" font-size="10" fill="var(--text-tertiary)">${v}</text>`;
  }
  // arrows every 3h — direction the wind blows toward
  let arrows = '';
  for (let i = 0; i < times.length; i += 3) {
    arrows += `<g transform="translate(${x(i).toFixed(1)},${(yWi + hW + 10).toFixed(1)}) rotate(${(wdir[i] + 180) % 360})">
      <path d="M0,-5 L3,4 L0,2 L-3,4 Z" fill="var(--text-tertiary)"/></g>`;
  }

  // ---- cloud cover, three bands ----
  let clouds = '';
  const bandH = hC / 3;
  [[cHi, 0, 'High'], [cMid, 1, 'Mid'], [cLow, 2, 'Low']].forEach(([arr, row, label]) => {
    for (let i = 0; i < times.length; i++) {
      const o = Math.max(0, Math.min(100, arr[i])) / 100;
      if (o > 0.02) clouds += `<rect x="${padL + i * colW}" y="${(yC + row * bandH).toFixed(1)}" width="${colW}" height="${bandH.toFixed(1)}" fill="var(--text-secondary)" opacity="${(o * .72).toFixed(2)}"/>`;
    }
    clouds += `<text x="${padL - 6}" y="${(yC + row * bandH + bandH / 2 + 3).toFixed(1)}" text-anchor="end" font-size="9" fill="var(--text-tertiary)">${label}</text>`;
  });

  // ---- hour axis ----
  let axis = '';
  for (let i = 0; i < times.length; i += 3) {
    axis += `<text x="${x(i).toFixed(1)}" y="${(yAx + 14).toFixed(1)}" text-anchor="middle" font-size="10" fill="var(--text-tertiary)">${times[i].slice(11, 16)}</text>`;
  }

  // ---- summary for the stage's own day ----
  const dayRows = times.map((t, i) => ({ t, i })).filter(r => r.t.slice(0, 10) === day.date);
  let summary = '';
  if (dayRows.length) {
    const ii = dayRows.map(r => r.i);
    const tmin = Math.min(...ii.map(i => temp[i])), tmax = Math.max(...ii.map(i => temp[i]));
    const rain = ii.reduce((a, i) => a + precip[i], 0);
    const maxGust = Math.max(...ii.map(i => gust[i]));
    const maxProb = Math.max(...ii.map(i => pprob[i] || 0));
    const sr = sun[day.date];
    summary = `<div class="statgrid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px;">
      <div class="statcard"><div class="stat-value">${tmin.toFixed(0)}–${tmax.toFixed(0)}°</div><div class="stat-label">Temperature</div></div>
      <div class="statcard"><div class="stat-value">${rain.toFixed(1)}<span style="font-size:14px;"> mm</span></div><div class="stat-label">Rain · ${maxProb}% peak</div></div>
      <div class="statcard"><div class="stat-value">${maxGust.toFixed(0)}<span style="font-size:14px;"> km/h</span></div><div class="stat-label">Max gust</div></div>
      <div class="statcard"><div class="stat-value" style="font-size:var(--text-md);">${sr ? sr.rise.slice(11, 16) + '–' + sr.set.slice(11, 16) : '—'}</div><div class="stat-label">Daylight</div></div>
    </div>`;
  }

  const age = Math.round((Date.now() - data.fetchedAt) / 60000);
  return `
    ${summary}
    <div class="card" style="padding:16px;">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px;">
        <div>
          <strong>${esc(day.title || 'Day ' + day.day_number)}</strong>
          <span class="muted" style="font-size:var(--text-xs);"> · ${coords.lat.toFixed(3)}, ${coords.lon.toFixed(3)}${coords.derived ? ' (from GPX)' : ''}</span>
        </div>
        <div style="display:flex;gap:6px;align-items:center;">
          <button class="btn btn-sm" onclick="wxShift(-24)">← earlier</button>
          <button class="btn btn-sm" onclick="wxShift(24)">later →</button>
        </div>
      </div>
      <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;">
        <svg viewBox="0 0 ${W} ${total}" width="${W}" height="${total}" style="display:block;min-width:${W}px;">
          ${bands}${hdrs}
          ${tGrid}
          <path d="${path(dew, fT)}" fill="none" stroke="var(--color-success)" stroke-width="1.4" stroke-dasharray="3,3" opacity=".8"/>
          <path d="${path(app, fT)}" fill="none" stroke="var(--accent-secondary)" stroke-width="1.6" opacity=".75"/>
          <path d="${path(temp, fT)}" fill="none" stroke="var(--accent-primary)" stroke-width="2.2"/>
          ${pGrid}${pBars}
          <path d="${path(pprob.map(v => v || 0), fProb)}" fill="none" stroke="var(--color-info)" stroke-width="1.2" stroke-dasharray="2,3" opacity=".7"/>
          ${wGrid}
          <path d="${path(gust, fW)}" fill="none" stroke="var(--color-warning)" stroke-width="1.4" stroke-dasharray="3,2"/>
          <path d="${path(wind, fW)}" fill="none" stroke="var(--color-warning)" stroke-width="2"/>
          ${arrows}
          ${clouds}
          ${axis}
        </svg>
      </div>
      <div class="wxlegend">
        <span><i style="background:var(--accent-primary);"></i>Temperature</span>
        <span><i style="background:var(--accent-secondary);"></i>Feels like</span>
        <span><i style="background:var(--color-success);"></i>Dew point</span>
        <span><i style="background:var(--color-info);"></i>Precipitation</span>
        <span><i style="background:var(--color-warning);"></i>Wind &amp; gusts (km/h)</span>
        <span><i style="background:var(--text-secondary);opacity:.6;"></i>Cloud cover</span>
      </div>
      <div class="muted" style="font-size:var(--text-xs);margin-top:8px;">
        Open-Meteo · ${esc((WX_MODELS.find(m => m.id === wxModel) || {}).label || wxModel)} ·
        updated ${age < 1 ? 'just now' : age + ' min ago'} · shaded columns are night
      </div>
    </div>`;
}

function wxSelectDay(id) { wxDayId = id; renderWeatherSection(); }
function wxSelectModel(m) { wxModel = m; localStorage.setItem('wxModel', m); renderWeatherSection(); }
function wxShift(h) {
  wxWindowStart = Math.max(0, Math.min(wxMaxStart, wxWindowStart + h));
  wxKeepWindow = true;
  renderWeatherSection();
}
async function wxRefresh() {
  const day = _wxDays.find(d => d.id === wxDayId);
  const c = await wxCoordsFor(day);
  if (!c) return;
  await wxFetch(c.lat, c.lon, true);
  renderWeatherSection();
}
async function wxSaveCoords(dayId) {
  const lat = parseFloat(document.getElementById('wxLat').value);
  const lon = parseFloat(document.getElementById('wxLon').value);
  if (isNaN(lat) || isNaN(lon)) { alert('Enter both a latitude and a longitude.'); return; }
  const { error } = await db().from('trip_days').update({ lat, lon }).eq('id', dayId);
  if (error) { alert(error.message); return; }
  const d = _wxDays.find(x => x.id === dayId);
  if (d) { d.lat = lat; d.lon = lon; }
  renderWeatherSection();
}
