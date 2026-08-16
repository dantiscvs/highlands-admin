// Pace engine (Section 8) — day-level, computed live at render time rather
// than stored. That sidesteps most of the staleness/cascade problem for this
// category of field: there's nothing to invalidate because nothing is cached.
// Scope note (see delivery report): this is day-level, not POI-level — the
// spec's "latest departure to reach a specific POI" and sunrise/sunset (which
// need per-day coordinates the simplified GPX importer doesn't yet produce)
// are not implemented in this pass.
function computeDayPace(day, pace) {
  if (!day.distance_km) return null;
  const cfg = activityConfig(activeTrip);
  if (!cfg.paceKeys || cfg.paceKeys.length === 0) return null; // e.g. public transport — no pace model applies
  pace = pace || {};
  const flat = pace.flatKmh || {};
  const primaryKey = cfg.paceKeys[0];
  const speedKmh = flat[day.surface] || flat[primaryKey] || 15;
  const climbHours = cfg.showClimb ? (Number(day.ascent_m) || 0) / (pace.climbMPerHour || 400) : 0;
  const flatHours = Number(day.distance_km) / speedKmh;
  const movingHours = flatHours + climbHours;
  const overheadHours = (pace.dayOverheadMin || 30) / 60;
  const totalHours = movingHours + overheadHours;
  const assumptionNote = cfg.showClimb
    ? `${speedKmh} km/h on ${day.surface || primaryKey} + ${pace.climbMPerHour || 400} m/h climbing`
    : `${speedKmh} km/h (${day.surface || primaryKey})`;
  return { movingHours, totalHours, speedKmh, assumptionNote };
}
function paceSummaryHtml(day) {
  const cfg = activityConfig(activeTrip);
  if (!cfg.paceKeys || cfg.paceKeys.length === 0) {
    return '<p class="muted" style="font-size:12px;">Pace estimates aren\'t applicable for this trip type.</p>';
  }
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

const CHECK_ICON_DONE = '<svg class="check-icon" viewBox="0 0 18 18"><circle cx="9" cy="9" r="7.5" fill="none" stroke="var(--color-success)" stroke-width="1.5"/><polyline points="5.5,9.2 8,11.8 12.5,6.5" fill="none" stroke="var(--color-success)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const CHECK_ICON_WARNING = '<svg class="check-icon" viewBox="0 0 18 18"><polygon points="9,2.5 16,15 2,15" fill="none" stroke="var(--color-warning)" stroke-width="1.5" stroke-linejoin="round"/><line x1="9" y1="7.5" x2="9" y2="11" stroke="var(--color-warning)" stroke-width="1.5" stroke-linecap="round"/><circle cx="9" cy="13" r="0.9" fill="var(--color-warning)"/></svg>';

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
      <div class="pct-ring" style="color:${data.completePct>=80?'var(--color-success)':data.completePct>=50?'var(--color-warning)':'var(--color-danger)'};">${data.completePct}%</div>
    </div>
    <div class="card">
      ${items.map(it => {
        const dismissed = (JSON.parse(localStorage.getItem('dismissedWarnings_'+activeTrip.id) || '[]')).includes(it.key);
        if (dismissed) return '';
        const list = it.list || [];
        return `<div class="checklist-item ${list.length ? 'warning' : 'done'}">
          ${list.length ? CHECK_ICON_WARNING : CHECK_ICON_DONE}
          <div style="flex:1;">
            <div class="check-title">${it.label}</div>
            ${list.length ? `<div class="check-desc">${list.map(it.fmt).join(', ')}</div>` : '<div class="check-desc">All clear</div>'}
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
