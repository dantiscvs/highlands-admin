// Effort / pace model and the Statistics tab, ported from the legacy Highlands
// PWA. The formulas are the legacy ones (effort = km + ascent/100, /12, capped
// at 10); what changed is that the stage window is read from per-day fields
// instead of being hard-coded to that one Scotland trip.

const EFFORT_BANDS = [
  { max: 3,   label: 'Very easy', color: 'var(--color-success)' },
  { max: 5,   label: 'Easy',      color: '#5A9367' },
  { max: 7,   label: 'Moderate',  color: 'var(--color-info)' },
  { max: 8.5, label: 'Hard',      color: 'var(--color-warning)' },
  { max: 9.5, label: 'Very hard', color: 'var(--color-danger)' },
  { max: 99,  label: 'Extreme',   color: '#7B2D26' },
];
function effortScore(km, ascentM) {
  const eff = (Number(km) || 0) + (Number(ascentM) || 0) / 100;
  const score = Math.min(10, Math.max(0, eff / 12));
  const band = EFFORT_BANDS.find(b => score < b.max) || EFFORT_BANDS[EFFORT_BANDS.length - 1];
  return { eff, score, label: band.label, color: band.color };
}

function bandColor(v, thresholds) { // thresholds: [[limit,color],…] last is fallback
  for (const [limit, color] of thresholds) if (v < limit) return color;
  return thresholds[thresholds.length - 1][1];
}
const MOVING_PACE_BANDS = [[12,'var(--color-success)'],[14,'var(--color-info)'],[16,'var(--color-warning)'],[Infinity,'var(--color-danger)']];
const OVERALL_PACE_BANDS = [[8,'var(--color-success)'],[10,'var(--color-info)'],[12,'var(--color-warning)'],[Infinity,'var(--color-danger)']];

function hhmmToMin(s) { if (!s) return null; const [h, m] = s.split(':').map(Number); return h * 60 + (m || 0); }
function minToHhmm(t) { t = ((t % 1440) + 1440) % 1440; return String(Math.floor(t / 60)).padStart(2,'0') + ':' + String(Math.round(t % 60)).padStart(2,'0'); }

// Full per-day stat bundle. `required*` values only exist when the day has a
// real start+end window; otherwise we fall back to the pace-assumption model.
function dayStats(day, trip) {
  const km = Number(day.distance_km) || 0;
  if (!km) return null;
  const score = effortScore(km, day.ascent_m);
  const pace = computeDayPace(day, trip.pace_assumptions);
  const stopOverheadH = ((trip.pace_assumptions || {}).dayOverheadMin || 30) / 60;

  const startMin = hhmmToMin(day.actual_start_time);
  const endMin = hhmmToMin(day.target_end_time);
  let elapsedH = null, movingH = null, requiredMoving = null, requiredOverall = null;
  if (startMin != null && endMin != null && endMin > startMin) {
    elapsedH = (endMin - startMin) / 60;
    movingH = Math.max(0.25, elapsedH - stopOverheadH);
    requiredMoving = km / movingH;
    requiredOverall = km / elapsedH;
  }
  return {
    km, ascent: Number(day.ascent_m) || 0, score, pace,
    elapsedH, movingH, requiredMoving, requiredOverall,
    assumedSpeed: pace ? pace.speedKmh : null,
    estTotalH: pace ? pace.totalHours : null,
    hasWindow: requiredMoving != null,
  };
}

// ---- Small inline bar chart (no chart lib; matches the legacy look) ----
function statBarChart(rows, max, unit) {
  if (!rows.length) return '<p class="muted" style="font-size:12px;">No data yet.</p>';
  return `<div class="barchart">
      ${rows.map(r => {
        const h = max > 0 ? Math.round((r.value / max) * 100) : 0;
        return `<div class="barcol" title="${esc(r.day)}: ${esc(String(r.label))}${unit ? ' ' + unit : ''}">
          <div class="barval" style="color:${r.color};">${esc(String(r.label))}</div>
          <div class="barfill" style="background:${r.color};height:${h}%;"></div>
        </div>`;
      }).join('')}
    </div>
    <div class="barlabels">${rows.map(r => `<div>${esc(r.day)}</div>`).join('')}</div>`;
}

async function renderStatsSection() {
  const { data: days } = await db().from('trip_days').select('*').eq('trip_id', activeTrip.id).order('order_index');
  const cfg = activityConfig(activeTrip);
  const active = (days || []).filter(d => !d.is_rest_day && Number(d.distance_km) > 0);

  if (!active.length) {
    document.getElementById('main').innerHTML = `
      <div class="pagehead"><div><h1>Statistics</h1><div class="subtitle">Daily effort, pace and elevation across the trip.</div></div></div>
      <div class="empty-state">
        <div class="empty-title">Nothing to chart yet</div>
        <div class="empty-desc">Add distances to your days in <a href="#" onclick="event.preventDefault();goTrip(activeTrip.id,'grid');">Route &amp; Days</a> and the effort, pace and elevation charts will appear here.</div>
      </div>`;
    return;
  }

  const stats = active.map(d => ({ d, s: dayStats(d, activeTrip) })).filter(x => x.s);
  const label = d => d.date ? new Date(d.date).toLocaleDateString([], { day: 'numeric', month: 'short' }) : 'D' + d.day_number;

  const totalKm = stats.reduce((s, x) => s + x.s.km, 0);
  const totalEl = stats.reduce((s, x) => s + x.s.ascent, 0);
  const avgEffort = stats.reduce((s, x) => s + x.s.score.score, 0) / stats.length;
  const withWindow = stats.filter(x => x.s.hasWindow);
  const avgMoving = withWindow.length ? withWindow.reduce((s, x) => s + x.s.requiredMoving, 0) / withWindow.length : null;
  const avgOverall = withWindow.length ? withWindow.reduce((s, x) => s + x.s.requiredOverall, 0) / withWindow.length : null;
  const avgAssumed = stats.filter(x => x.s.assumedSpeed).length
    ? stats.filter(x => x.s.assumedSpeed).reduce((s, x) => s + x.s.assumedSpeed, 0) / stats.filter(x => x.s.assumedSpeed).length : null;

  const kmRows = stats.map(x => ({ day: label(x.d), label: x.s.km, value: x.s.km,
    color: bandColor(x.s.km, [[70,'var(--color-success)'],[95,'var(--color-info)'],[105,'var(--color-warning)'],[Infinity,'var(--color-danger)']]) }));
  const elRows = stats.map(x => ({ day: label(x.d), label: x.s.ascent, value: x.s.ascent,
    color: bandColor(x.s.ascent, [[700,'var(--color-success)'],[1000,'var(--color-info)'],[1150,'var(--color-warning)'],[Infinity,'var(--color-danger)']]) }));
  const effRows = stats.map(x => ({ day: label(x.d), label: x.s.score.score.toFixed(1), value: x.s.score.score, color: x.s.score.color }));
  const movRows = withWindow.map(x => ({ day: label(x.d), label: x.s.requiredMoving.toFixed(1), value: x.s.requiredMoving, color: bandColor(x.s.requiredMoving, MOVING_PACE_BANDS) }));
  const ovrRows = withWindow.map(x => ({ day: label(x.d), label: x.s.requiredOverall.toFixed(1), value: x.s.requiredOverall, color: bandColor(x.s.requiredOverall, OVERALL_PACE_BANDS) }));

  const maxOf = rows => Math.max(...rows.map(r => r.value), 1) * 1.08;
  const gpxDays = (days || []).filter(d => d.gpx_url);
  _elevDays = gpxDays;

  document.getElementById('main').innerHTML = `
    <div class="pagehead"><div><h1>Statistics</h1><div class="subtitle">Daily effort, pace and elevation across the trip.</div></div></div>

    <div class="card" style="margin-bottom:18px;font-size:var(--text-sm);color:var(--text-secondary);line-height:1.55;">
      <strong style="color:var(--text-primary);">Effort 0–10</strong> combines distance and climbing — <code>km + m/100</code>, divided by 12.
      ${withWindow.length ? `<br><strong style="color:var(--text-primary);">Required pace</strong> is your distance over the real stage window (start → target finish). <em>Moving</em> excludes the daily overhead; <em>overall</em> includes it, which is the number to check your watch against during the day.`
        : `<br><span style="color:var(--color-warning);">Set a start and target finish time on a day (Route &amp; Days → ⋯) to unlock the required-pace charts.</span>`}
    </div>

    <div class="statgrid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:10px;">
      <div class="statcard"><div class="stat-value">${totalKm.toFixed(0)}</div><div class="stat-label">km total</div></div>
      <div class="statcard"><div class="stat-value">${totalEl.toFixed(0)}</div><div class="stat-label">m climbed</div></div>
      <div class="statcard"><div class="stat-value">${avgEffort.toFixed(1)}<span style="font-size:14px;color:var(--text-tertiary);">/10</span></div><div class="stat-label">avg effort</div></div>
    </div>
    <div class="statgrid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:24px;">
      <div class="statcard"><div class="stat-value">${stats.length}</div><div class="stat-label">active days</div></div>
      <div class="statcard"><div class="stat-value">${avgMoving ? avgMoving.toFixed(1) : (avgAssumed ? avgAssumed.toFixed(1) : '—')}</div><div class="stat-label">km/h ${avgMoving ? 'req. moving' : 'assumed'}</div></div>
      <div class="statcard"><div class="stat-value">${avgOverall ? avgOverall.toFixed(1) : '—'}</div><div class="stat-label">km/h overall</div></div>
    </div>

    <div class="card" style="margin-bottom:16px;">
      <h2>🚴 Distance per day (km)</h2>
      ${statBarChart(kmRows, maxOf(kmRows), 'km')}
    </div>

    ${cfg.showAscent ? `<div class="card" style="margin-bottom:16px;">
      <h2>⛰️ Climbing per day (m)</h2>
      ${statBarChart(elRows, maxOf(elRows), 'm')}
    </div>` : ''}

    <div class="card" style="margin-bottom:16px;">
      <h2>💪 Stage difficulty (0–10)</h2>
      ${statBarChart(effRows, 10, '')}
      <div class="chartnote">&lt;3 very easy · 3–5 easy · 5–7 moderate · 7–8.5 hard · 8.5–9.5 very hard · 9.5+ extreme</div>
    </div>

    ${movRows.length ? `<div class="card" style="margin-bottom:16px;">
      <h2>⚡ Required moving pace (km/h)</h2>
      ${statBarChart(movRows, maxOf(movRows), '')}
      <div class="chartnote">&lt;12 relaxed · 12–14 solid · 14–16 fast · 16+ you'll need to push</div>
    </div>` : ''}

    ${ovrRows.length ? `<div class="card" style="margin-bottom:16px;">
      <h2>🕐 Required overall pace (km/h, incl. stops)</h2>
      ${statBarChart(ovrRows, maxOf(ovrRows), '')}
      <div class="chartnote">Distance across the whole stage window, so you can sanity-check progress mid-day.<br>&lt;8 relaxed · 8–10 solid · 10–12 watch the clock · 12+ risk of running late</div>
    </div>` : ''}

    ${gpxDays.length ? `
      <div class="card" style="margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px;">
          <h2 style="margin:0;">📈 Elevation profile</h2>
          <div style="display:flex;gap:6px;flex-wrap:wrap;" id="elevDayBtns">
            <button class="btn btn-sm btn-primary" data-elev="all" onclick="showElevProfile('all')">Whole trip</button>
            ${gpxDays.map(d => `<button class="btn btn-sm" data-elev="${d.id}" onclick="showElevProfile('${d.id}')">Day ${d.day_number}</button>`).join('')}
          </div>
        </div>
        <div id="elevMeta" class="muted" style="font-size:var(--text-xs);margin-bottom:8px;">Loading tracks…</div>
        <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;"><div id="elevChart"></div></div>
      </div>
    ` : `
      <div class="card" style="margin-bottom:16px;">
        <h2>📈 Elevation profile</h2>
        <p class="muted" style="font-size:var(--text-sm);">No GPX tracks attached yet. Add one per day in <a href="#" onclick="event.preventDefault();goTrip(activeTrip.id,'grid');">Route &amp; Days</a> (open a day with ⋯ and upload a .gpx) and the real elevation profile will appear here.</p>
      </div>
    `}

    <h2 style="margin-top:24px;">Daily breakdown</h2>
    <div style="display:flex;flex-direction:column;gap:10px;">
      ${stats.map(x => dailyBreakdownCard(x.d, x.s)).join('')}
    </div>
  `;

  if (gpxDays.length) showElevProfile('all');
}

// ---- Elevation profile switcher ----
let _elevDays = [];
async function showElevProfile(which) {
  const chart = document.getElementById('elevChart');
  const meta = document.getElementById('elevMeta');
  if (!chart) return;
  document.querySelectorAll('#elevDayBtns [data-elev]').forEach(b => {
    b.classList.toggle('btn-primary', b.dataset.elev === String(which));
  });
  chart.innerHTML = '';
  meta.textContent = 'Loading…';

  if (which === 'all') {
    // One continuous profile: each day's track appended end-to-end, so the
    // x-axis is cumulative trip distance rather than per-stage distance.
    const profiles = await Promise.all(_elevDays.map(d => fetchProfile(d.gpx_url)));
    const good = profiles.filter(p => p && p.hasEle);
    if (!good.length) { meta.textContent = 'No elevation data in the attached tracks.'; return; }
    const merged = { dist: [], ele: [], gain: [], hasEle: true };
    let kmOff = 0, gainOff = 0;
    good.forEach(p => {
      for (let i = 0; i < p.dist.length; i++) {
        merged.dist.push(kmOff + p.dist[i]);
        merged.ele.push(p.ele[i]);
        merged.gain.push(gainOff + p.gain[i]);
      }
      kmOff += p.totalKm; gainOff += p.totalGain;
    });
    merged.totalKm = kmOff; merged.totalGain = gainOff;
    merged.minEle = Math.min(...merged.ele); merged.maxEle = Math.max(...merged.ele);
    chart.innerHTML = buildElevationSvg(merged, { height: 190 });
    meta.textContent = `${merged.totalKm.toFixed(0)} km · +${Math.round(merged.totalGain)} m total · ${merged.minEle.toFixed(0)}–${merged.maxEle.toFixed(0)} m`
      + (good.length < _elevDays.length ? ` · ${_elevDays.length - good.length} track(s) had no elevation data` : '');
    return;
  }

  const day = _elevDays.find(d => d.id === which);
  const p = day ? await fetchProfile(day.gpx_url) : null;
  if (!p) { meta.textContent = 'Could not load that track.'; return; }
  if (!p.hasEle) { meta.textContent = 'That track has no elevation data.'; return; }
  chart.innerHTML = buildElevationSvg(p, { height: 190 });
  meta.textContent = `Day ${day.day_number} · ${p.totalKm.toFixed(1)} km · +${Math.round(p.totalGain)} m · ${p.minEle.toFixed(0)}–${p.maxEle.toFixed(0)} m`;
}

function dailyBreakdownCard(d, s) {
  const facts = [];
  facts.push({ k: 'Distance', v: s.km + ' km' });
  if (s.ascent) facts.push({ k: 'Climbing', v: '+' + s.ascent + ' m' });
  if (s.hasWindow) {
    facts.push({ k: 'Window', v: `${d.actual_start_time.slice(0,5)}–${d.target_end_time.slice(0,5)}` });
    facts.push({ k: 'Req. moving', v: s.requiredMoving.toFixed(1) + ' km/h' });
    facts.push({ k: 'Req. overall', v: s.requiredOverall.toFixed(1) + ' km/h' });
  } else if (s.pace) {
    facts.push({ k: 'Assumed', v: s.assumedSpeed.toFixed(1) + ' km/h' });
    facts.push({ k: 'Est. time', v: s.estTotalH.toFixed(1) + ' h' });
  }
  return `<div class="card" style="border-left:4px solid ${s.score.color};">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">
      <div style="min-width:0;">
        <div style="font-weight:600;">Day ${d.day_number}${d.title ? ' · ' + esc(d.title) : ''}</div>
        <div class="muted" style="font-size:var(--text-sm);margin-top:2px;">${d.date ? fmtDate(d.date) : ''}${d.start_point && d.end_point ? ` · ${esc(d.start_point)} → ${esc(d.end_point)}` : ''}</div>
      </div>
      <div style="text-align:right;flex:none;">
        <div style="font-family:var(--font-mono);font-weight:700;color:${s.score.color};">${s.score.score.toFixed(1)}/10</div>
        <div class="muted" style="font-size:var(--text-xs);">${s.score.label}</div>
      </div>
    </div>
    <div class="leg-facts">
      ${facts.map(f => `<div class="leg-fact"><div class="fk">${f.k}</div><div class="fv mono">${esc(f.v)}</div></div>`).join('')}
    </div>
  </div>`;
}
