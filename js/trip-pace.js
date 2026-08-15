// Pace engine (Section 8) — day-level, computed live at render time rather
// than stored. That sidesteps most of the staleness/cascade problem for this
// category of field: there's nothing to invalidate because nothing is cached.
// Scope note (see delivery report): this is day-level, not POI-level — the
// spec's "latest departure to reach a specific POI" and sunrise/sunset (which
// need per-day coordinates the simplified GPX importer doesn't yet produce)
// are not implemented in this pass.
function computeDayPace(day, pace) {
  if (!day.distance_km) return null;
  pace = pace || {};
  const flat = pace.flatKmh || {};
  const speedKmh = flat[day.surface] || flat.tarmac || 15;
  const climbHours = (Number(day.ascent_m) || 0) / (pace.climbMPerHour || 400);
  const flatHours = Number(day.distance_km) / speedKmh;
  const movingHours = flatHours + climbHours;
  const overheadHours = (pace.dayOverheadMin || 30) / 60;
  const totalHours = movingHours + overheadHours;
  return { movingHours, totalHours, speedKmh, assumptionNote: `${speedKmh} km/h on ${day.surface || 'tarmac'} + ${pace.climbMPerHour || 400} m/h climbing` };
}
function paceSummaryHtml(day) {
  const p = computeDayPace(day, activeTrip.pace_assumptions);
  if (!p) return '<p class="muted" style="font-size:12px;">No distance set — nothing to calculate.</p>';
  let eta = '';
  if (day.actual_start_time) {
    const [h, m] = day.actual_start_time.split(':').map(Number);
    const startMin = h * 60 + m;
    const etaMin = startMin + Math.round(p.totalHours * 60);
    eta = ` · ETA ${String(Math.floor(etaMin/60)%24).padStart(2,'0')}:${String(etaMin%60).padStart(2,'0')}`;
  }
  return `
    <div style="font-size:13px;">
      <strong>${p.movingHours.toFixed(1)}h</strong> moving, <strong>${p.totalHours.toFixed(1)}h</strong> total with overhead${eta}
    </div>
    <div class="muted" style="font-size:11px;margin-top:2px;">Assuming ${p.assumptionNote}. <a href="#" onclick="event.preventDefault();goTrip(activeTrip.id,'settings');">Adjust</a></div>
  `;
}

async function renderReadinessChecklist() {
  const { data, error } = await db().rpc('trip_readiness', { p_trip_id: activeTrip.id });
  if (error) { document.getElementById('main').innerHTML = 'Failed: ' + error.message; return; }
  const items = [
    { key: 'noAccommodationNoCamping', label: 'Days with no accommodation set', list: data.noAccommodationNoCamping, fmt: n => `Day ${n}` },
    { key: 'noResupplyLongDay', label: 'Long days (>60km) with no resupply/water point', list: data.noResupplyLongDay, fmt: n => `Day ${n}` },
    { key: 'unbookedMarkedBooked', label: 'Stays marked booked with no confirmation link or reference', list: data.unbookedMarkedBooked, fmt: n => n },
    { key: 'noTrackingRider', label: 'Riders with no active tracking link', list: data.noTrackingRider, fmt: n => n },
  ];
  document.getElementById('main').innerHTML = `
    <div class="pagehead">
      <div><h1>Readiness</h1><div class="subtitle">Warnings, never blockers — your pre-trip review.</div></div>
      <div class="pct-ring" style="color:${data.completePct>=80?'var(--green)':data.completePct>=50?'var(--orange)':'var(--red)'};">${data.completePct}%</div>
    </div>
    <div class="card">
      ${items.map(it => {
        const dismissed = (JSON.parse(localStorage.getItem('dismissedWarnings_'+activeTrip.id) || '[]')).includes(it.key);
        if (dismissed) return '';
        const list = it.list || [];
        return `<div class="checklist-item">
          <span style="font-size:18px;">${list.length ? '⚠️' : '✅'}</span>
          <div style="flex:1;">
            <div>${it.label}</div>
            ${list.length ? `<div class="muted" style="font-size:12px;">${list.map(it.fmt).join(', ')}</div>` : '<div class="muted" style="font-size:12px;">All clear</div>'}
          </div>
          ${list.length ? `<button class="btn btn-sm" onclick="dismissWarning('${it.key}')">Dismiss</button>` : ''}
        </div>`;
      }).join('') || '<p class="muted">Everything dismissed. <a href="#" onclick="event.preventDefault();resetDismissed();">Reset dismissed warnings</a></p>'}
    </div>
  `;
}
function dismissWarning(key) {
  const k = 'dismissedWarnings_'+activeTrip.id;
  const cur = JSON.parse(localStorage.getItem(k) || '[]');
  if (!cur.includes(key)) cur.push(key);
  localStorage.setItem(k, JSON.stringify(cur));
  renderReadinessChecklist();
}
function resetDismissed() { localStorage.removeItem('dismissedWarnings_'+activeTrip.id); renderReadinessChecklist(); }
