// "Today" — the on-the-road tab. What's happening now, what to remember, how
// fast you need to move, and a km-done input that feeds both the day's live
// pace estimate and the public participant page (app.day_progress → riddenKm).

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

let _todayState = { dayId: null, days: [] };

async function renderTodaySection() {
  const iso = todayIso();
  const { data: days } = await db().from('trip_days').select('*').eq('trip_id', activeTrip.id).order('order_index');
  _todayState.days = days || [];

  // Today if the trip is running; otherwise the first upcoming day, else the last.
  let day = (days || []).find(d => d.date === iso);
  let mode = 'today';
  if (!day) {
    const upcoming = (days || []).filter(d => d.date && d.date > iso).sort((a,b) => a.date.localeCompare(b.date));
    if (upcoming.length) { day = upcoming[0]; mode = 'next'; }
    else if ((days || []).length) { day = days[days.length - 1]; mode = 'past'; }
  }
  if (!day) {
    document.getElementById('main').innerHTML = `
      <div class="pagehead"><div><h1>Today</h1></div></div>
      <div class="empty-state"><div class="empty-title">No days yet</div>
      <div class="empty-desc">Add days in <a href="#" onclick="event.preventDefault();goTrip(activeTrip.id,'grid');">Route &amp; Days</a> first.</div></div>`;
    return;
  }
  _todayState.dayId = day.id;
  const idx = (days || []).findIndex(d => d.id === day.id);
  const prevDay = idx > 0 ? days[idx - 1] : null;
  const nextDay = idx < days.length - 1 ? days[idx + 1] : null;

  const [pois, accs, legs, prog] = await Promise.all([
    moduleOn('poi') ? db().from('points_of_interest').select('*').eq('day_id', day.id).order('order_index') : { data: [] },
    moduleOn('accommodation') ? db().from('accommodations').select('*').eq('trip_id', activeTrip.id) : { data: [] },
    moduleOn('transport') ? db().from('transport_legs').select('*').eq('trip_id', activeTrip.id) : { data: [] },
    db().from('day_progress').select('*').eq('day_id', day.id).maybeSingle(),
  ]);
  const tonight = (accs.data || []).find(a => a.day_id === day.id);
  const lastNight = prevDay ? (accs.data || []).find(a => a.day_id === prevDay.id) : null;
  const todayLegs = (legs.data || []).filter(l => l.day_id === day.id);
  const riddenKm = prog.data ? Number(prog.data.ridden_km) : 0;

  const s = dayStats(day, activeTrip);
  const remaining = s ? Math.max(0, s.km - riddenKm) : 0;
  const pctDone = s && s.km ? Math.min(100, (riddenKm / s.km) * 100) : 0;

  // Live pace: how fast must you cover what's left to hit the target finish?
  let livePace = null;
  const endMin = hhmmToMin(day.target_end_time);
  if (endMin != null && remaining > 0) {
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const minsLeft = endMin - nowMin;
    if (minsLeft > 0) livePace = { hoursLeft: minsLeft / 60, kmh: remaining / (minsLeft / 60), by: day.target_end_time.slice(0,5) };
    else livePace = { hoursLeft: 0, kmh: null, by: day.target_end_time.slice(0,5), overdue: true };
  }

  const banner = mode === 'today' ? '' :
    `<div class="preview-banner" style="background:var(--color-warning-subtle);border-color:var(--color-warning-border);color:var(--color-warning);">
       ${mode === 'next' ? `The trip hasn't started — showing the next day (${day.date ? fmtDate(day.date) : 'Day ' + day.day_number}).` : 'The trip is over — showing the last day.'}
     </div>`;

  const groups = [
    { key: 'food',     label: 'Food',             icon: '🍽️', match: c => c === 'food' },
    { key: 'resupply', label: 'Resupply / water', icon: '🛒', match: c => c === 'resupply' || c === 'water' },
    { key: 'sight',    label: 'Worth stopping for', icon: '🏰', match: c => c === 'sight' || c === 'other' || !c },
  ];

  document.getElementById('main').innerHTML = `
    <div class="pagehead">
      <div><h1>Today</h1><div class="subtitle">${day.date ? fmtDate(day.date) : ''} · Day ${day.day_number} of ${(days||[]).length}</div></div>
      <div style="display:flex;gap:6px;">
        ${moduleOn('route') ? `<button class="btn btn-sm" onclick="goTrip(activeTrip.id,'grid')">All days</button>` : ''}
      </div>
    </div>
    ${banner}

    <div class="card" style="margin-bottom:14px;${day.is_rest_day ? '' : 'border-left:4px solid ' + (s ? s.score.color : 'var(--accent-primary)') + ';'}">
      <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-start;">
        <div style="min-width:0;">
          <h2 style="margin-bottom:2px;">${esc(day.title || 'Day ' + day.day_number)}</h2>
          ${day.start_point || day.end_point ? `<div class="muted" style="font-size:var(--text-sm);">${esc(day.start_point||'?')} → ${esc(day.end_point||'?')}</div>` : ''}
        </div>
        ${s ? `<div style="text-align:right;flex:none;">
          <div style="font-family:var(--font-mono);font-weight:700;color:${s.score.color};">${s.score.score.toFixed(1)}/10</div>
          <div class="muted" style="font-size:var(--text-xs);">${s.score.label}</div>
        </div>` : ''}
      </div>
      ${day.is_rest_day ? '<p class="muted" style="margin-top:10px;">Rest day — nothing to ride.</p>' : ''}
      ${day.description ? `<p style="margin-top:8px;color:var(--text-secondary);font-size:var(--text-sm);">${esc(day.description)}</p>` : ''}
    </div>

    ${s ? `
    <div class="card" style="margin-bottom:14px;">
      <h2>Progress</h2>
      <div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;">
        <span style="font-family:var(--font-mono);font-weight:700;font-size:var(--text-xl);">${riddenKm.toFixed(1)}</span>
        <span class="muted">/ ${s.km} km · ${remaining.toFixed(1)} km left</span>
      </div>
      <div class="pbar" style="margin-top:10px;"><div style="width:${pctDone}%;"></div></div>

      <div style="display:flex;gap:8px;align-items:center;margin-top:14px;flex-wrap:wrap;">
        <input id="todayKm" type="number" step="0.1" min="0" value="${riddenKm || ''}" placeholder="km done"
          style="width:120px;" ${canLogProgress() ? '' : 'disabled'}>
        <button class="btn btn-primary btn-sm" onclick="saveTodayProgress()" ${canLogProgress() ? '' : 'disabled'}>Update</button>
        ${canLogProgress() ? `<button class="btn btn-sm" onclick="bumpTodayKm(10)">+10</button>
        <button class="btn btn-sm" onclick="bumpTodayKm(25)">+25</button>` : ''}
        <span id="todayProgInd" class="saveIndicator"></span>
      </div>
      <div class="muted" style="font-size:var(--text-xs);margin-top:6px;">
        ${canLogProgress() ? 'This also updates the public page your family and friends see.' : 'Only riders and organisers can log progress.'}
      </div>

      <div class="leg-facts">
        ${s.assumedSpeed ? `<div class="leg-fact"><div class="fk">Assumed pace</div><div class="fv mono">${s.assumedSpeed.toFixed(1)} km/h</div></div>` : ''}
        ${s.estTotalH ? `<div class="leg-fact"><div class="fk">Est. total</div><div class="fv mono">${s.estTotalH.toFixed(1)} h</div></div>` : ''}
        ${s.hasWindow ? `<div class="leg-fact"><div class="fk">Req. overall</div><div class="fv mono">${s.requiredOverall.toFixed(1)} km/h</div></div>` : ''}
        ${livePace && livePace.kmh != null ? `<div class="leg-fact"><div class="fk">To finish by ${livePace.by}</div><div class="fv mono" style="color:${bandColor(livePace.kmh, MOVING_PACE_BANDS)};">${livePace.kmh.toFixed(1)} km/h</div></div>` : ''}
        ${livePace && livePace.overdue ? `<div class="leg-fact"><div class="fk">Target ${livePace.by}</div><div class="fv" style="color:var(--color-danger);">passed</div></div>` : ''}
      </div>
      ${!s.hasWindow ? `<div class="muted" style="font-size:var(--text-xs);margin-top:8px;">Set a start and target finish time for this day ${isEditor() ? '(Route &amp; Days → ⋯)' : ''} to get a live "pace needed" figure.</div>` : ''}
    </div>` : ''}

    ${todayLegs.length ? `<div class="card" style="margin-bottom:14px;">
      <h2>Transport today</h2>
      <div style="display:flex;flex-direction:column;gap:10px;">
        ${todayLegs.map(l => transportReadonlyHtml(l, days)).join('')}
      </div>
    </div>` : ''}

    ${groups.map(g => {
      const list = (pois.data || []).filter(p => g.match(p.category));
      if (!list.length) return '';
      return `<div class="card" style="margin-bottom:14px;">
        <h2>${g.icon} ${g.label}</h2>
        ${list.map(p => `<div style="padding:7px 0;border-top:1px solid var(--border-hairline);">
          ${poiLineHtml(p)}
        </div>`).join('')}
      </div>`;
    }).join('')}

    ${lastNight && lastNight.breakfast_info ? `<div class="card" style="margin-bottom:14px;">
      <h2>🍳 Breakfast this morning</h2>
      <div style="font-size:var(--text-sm);">
        ${lastNight.breakfast_url ? `<a href="${esc(lastNight.breakfast_url)}" target="_blank" rel="noopener">${esc(lastNight.breakfast_info)}</a>` : esc(lastNight.breakfast_info)}
        <div class="muted" style="font-size:var(--text-xs);margin-top:2px;">At ${esc(lastNight.name)} — where you stayed last night.</div>
      </div>
    </div>` : ''}

    ${tonight ? `<div class="card" style="margin-bottom:14px;">
      <h2>🏠 Tonight</h2>
      ${accommodationReadonlyHtml(tonight, () => 'Day ' + day.day_number)}
    </div>` : ''}

    ${nextDay ? `<div class="card">
      <h2>Tomorrow</h2>
      <div style="font-weight:600;">${esc(nextDay.title || 'Day ' + nextDay.day_number)}</div>
      <div class="muted" style="font-size:var(--text-sm);margin-top:2px;">
        ${nextDay.date ? fmtDate(nextDay.date) : ''}${nextDay.is_rest_day ? ' · rest day' : ''}${nextDay.distance_km ? ' · ' + nextDay.distance_km + ' km' : ''}${nextDay.ascent_m ? ' · +' + nextDay.ascent_m + ' m' : ''}
      </div>
    </div>` : ''}
  `;
}

function canLogProgress() {
  return ['owner','editor','rider'].includes(realRole()) && !previewAsParticipant;
}
function bumpTodayKm(n) {
  const el = document.getElementById('todayKm');
  el.value = (Number(el.value) || 0) + n;
  saveTodayProgress();
}
async function saveTodayProgress() {
  const ind = document.getElementById('todayProgInd');
  const km = Number(document.getElementById('todayKm').value);
  if (isNaN(km) || km < 0) { ind.textContent = 'Enter a number'; ind.className = 'saveIndicator'; return; }
  ind.textContent = 'Saving…'; ind.className = 'saveIndicator saving';
  const { error } = await db().from('day_progress').upsert(
    { trip_id: activeTrip.id, day_id: _todayState.dayId, ridden_km: km, updated_at: new Date().toISOString() },
    { onConflict: 'trip_id,day_id' }
  );
  if (error) { ind.textContent = 'Failed: ' + error.message; ind.className = 'saveIndicator'; return; }
  ind.textContent = '✓ Saved'; ind.className = 'saveIndicator saved';
  renderTodaySection();
}
