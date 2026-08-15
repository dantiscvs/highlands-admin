// Section 5 — three ways to get data in. Path 1 (manual) is the grid/modules
// already built. This file covers Path 2 (email, via a mock inbound screen —
// see the delivery report for what "real" inbound wiring still needs) and
// Path 3 (document upload). Both funnel into the same staged_changes review
// queue; nothing here ever writes directly to a trip.
const EMAIL_FIXTURES = {
  hotel: { subject: 'Your booking is confirmed — Riverside Hotel', text:
`Dear Guest,

Your booking is confirmed.

Hotel: Riverside Hotel, 12 Bridge Street
Check-in: 14 Aug 2027
Confirmation number: RH-88213
Total price: GBP 145.00
Phone: +44 1234 567890

Thank you for booking with us.` },
  hostel: { subject: 'Booking confirmation — Trailhead Bunkhouse', text:
`Booking confirmed!
Trailhead Bunkhouse
Check-in: 15 Aug 2027
Confirmation no: TB-4471
Total amount: GBP 38.00 (dorm bed)
Contact: +44 7700 900123` },
  flight: { subject: 'Your flight is confirmed - FR 4521', text:
`Ryanair booking confirmation
Confirmation number: FR4521XK
Flight: FR 4521, Gdansk (GDN) to Edinburgh (EDI)
Departure: 05 Aug 2027 19:25
Total price: PLN 320.00` },
  train: { subject: 'ScotRail e-ticket confirmation', text:
`Your ScotRail journey is booked.
Confirmation number: SR-99201
Edinburgh Waverley to Inverness
Total price: GBP 42.50` },
  ferry: { subject: 'CalMac booking confirmation', text:
`Booking reference: CM-3321A
Sailing: Oban to Craignure
Check-in: 09:30
Total price: GBP 18.00
Phone: +44 800 066 5000` },
  bikebox: { subject: 'Your Bike Atelier Kartuzy booking', text:
`Bike box rental confirmed.
Confirmation number: BAK-2201
Check-in: pickup 04 Aug 2027
Total price: PLN 280.00
Contact: +48 668 479 218` },
};

async function renderImportsSection() {
  const [{ data: imports }, { data: pending }] = await Promise.all([
    db().from('staged_imports').select('*').eq('trip_id', activeTrip.id).order('created_at', { ascending: false }).limit(10),
    db().from('staged_changes').select('*').eq('trip_id', activeTrip.id).eq('status', 'pending').order('created_at', { ascending: false }),
  ]);
  const fakeInboundAddress = `trip-${activeTrip.id.slice(0,8)}@inbox.tripadmin.app`;

  document.getElementById('main').innerHTML = `
    <div class="pagehead"><div><h1>Imports</h1><div class="subtitle">Nothing here writes to your trip directly — everything lands in the review queue below first.</div></div></div>

    <div class="card" style="margin-bottom:14px;">
      <h2>📧 Forward confirmations by email</h2>
      <p class="muted" style="font-size:12px;margin-bottom:8px;">Forward hotel, flight, train, ferry, or bike-box confirmations to your trip's inbound address.</p>
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px;">
        <input type="text" readonly value="${fakeInboundAddress}" style="flex:1;font-family:monospace;" onclick="this.select()">
        <button class="btn btn-sm" onclick="navigator.clipboard.writeText('${fakeInboundAddress}');this.textContent='Copied!'">Copy</button>
      </div>
      <p class="muted" style="font-size:11px;">⚠️ This MVP ships the full parsing pipeline and this review queue, but the address above isn't wired to a real mailbox yet (needs an email provider connected — see the delivery report). Use the tester below to try it with real or sample emails right now.</p>
      <hr style="border-color:var(--bg3);margin:14px 0;">
      <strong style="font-size:13px;">Try it — paste an email or pick a sample</strong>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin:8px 0;">
        ${Object.keys(EMAIL_FIXTURES).map(k => `<button class="btn btn-sm" onclick="loadFixture('${k}')">${k}</button>`).join('')}
      </div>
      <input type="text" id="emailSubject" placeholder="Subject" style="width:100%;margin-bottom:6px;">
      <textarea id="emailBody" placeholder="Paste email text here…" style="width:100%;min-height:100px;margin-bottom:8px;"></textarea>
      <button class="btn btn-primary btn-sm" onclick="runEmailImport()">Run through pipeline</button>
      <span id="emailImportStatus" class="muted" style="font-size:12px;margin-left:8px;"></span>
    </div>

    <div class="card" style="margin-bottom:14px;">
      <h2>📄 Upload a document</h2>
      <p class="muted" style="font-size:12px;margin-bottom:8px;">CSV or plain text with one row per day (columns: day, date, title, distance, ascent, accommodation, notes). For Excel files, export as CSV first.</p>
      <input type="file" id="docFile" accept=".csv,.txt">
      <button class="btn btn-primary btn-sm" style="margin-left:8px;" onclick="runDocumentImport()">Run through pipeline</button>
      <span id="docImportStatus" class="muted" style="font-size:12px;margin-left:8px;"></span>
    </div>

    <div class="card">
      <h2>Review queue ${pending && pending.length ? `<span class="badge badge-orange">${pending.length} pending</span>` : ''}</h2>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
        <label class="muted" style="font-size:12px;">Bulk-accept confidence ≥</label>
        <input type="range" id="confThreshold" min="0" max="1" step="0.05" value="0.7" oninput="document.getElementById('confThVal').textContent=this.value">
        <span id="confThVal" style="font-size:12px;">0.7</span>
        <button class="btn btn-sm" onclick="bulkAccept()">Bulk accept</button>
      </div>
      <div id="reviewQueueList">${(pending||[]).map(c => reviewRowHtml(c)).join('') || '<p class="muted">Nothing pending review.</p>'}</div>
    </div>
  `;
}

function loadFixture(key) {
  const f = EMAIL_FIXTURES[key];
  document.getElementById('emailSubject').value = f.subject;
  document.getElementById('emailBody').value = f.text;
}

async function runEmailImport() {
  const subject = document.getElementById('emailSubject').value.trim();
  const text = document.getElementById('emailBody').value.trim();
  const status = document.getElementById('emailImportStatus');
  if (!text) { status.textContent = 'Paste an email first.'; return; }
  status.textContent = 'Processing…';
  try {
    const res = await callFn('import-extract', { tripId: activeTrip.id, kind: 'email', subject, text });
    status.textContent = `${res.proposalCount} proposal(s) added to the review queue${res.usedLLM ? ' (LLM)' : ' (heuristic — add an ANTHROPIC_API_KEY secret for higher-quality extraction)'}.`;
    renderImportsSection();
  } catch (e) { status.textContent = 'Failed: ' + e.message; }
}
async function runDocumentImport() {
  const file = document.getElementById('docFile').files[0];
  const status = document.getElementById('docImportStatus');
  if (!file) { status.textContent = 'Choose a file first.'; return; }
  status.textContent = 'Processing…';
  try {
    const text = await file.text();
    const res = await callFn('import-extract', { tripId: activeTrip.id, kind: 'document', filename: file.name, text });
    status.textContent = `${res.proposalCount} proposal(s) added to the review queue${res.usedLLM ? ' (LLM)' : ' (heuristic CSV mapping — add an ANTHROPIC_API_KEY secret for higher-quality extraction)'}.`;
    renderImportsSection();
  } catch (e) { status.textContent = 'Failed: ' + e.message; }
}

function reviewRowHtml(c) {
  const val = (() => { try { return JSON.parse(c.proposed_value); } catch { return c.proposed_value; } })();
  return `<div class="checklist-item" data-change-id="${c.id}">
    <div style="flex:1;min-width:0;">
      <div class="muted" style="font-size:11px;text-transform:uppercase;">${esc(c.entity_type)}${c.day_number ? ' · day ' + c.day_number : ''} · ${esc(c.field_name)} · confidence ${Number(c.confidence).toFixed(2)}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:6px;">
        <div style="background:var(--bg3);border-radius:6px;padding:8px;font-size:12px;color:var(--dim);">${esc(c.source_excerpt || '(no excerpt)')}</div>
        <div style="background:var(--bg3);border-radius:6px;padding:8px;font-size:13px;">→ <strong>${esc(val)}</strong></div>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:4px;">
      <button class="btn btn-sm btn-primary" onclick="reviewChange('${c.id}','accept')">Accept</button>
      <button class="btn btn-sm" onclick="reviewChange('${c.id}','reject')">Reject</button>
    </div>
  </div>`;
}
async function reviewChange(id, action) {
  const { data, error } = await db().rpc('review_staged_change', { p_change_id: id, p_action: action });
  if (error) { alert(error.message); return; }
  if (data && data.error) { alert('Could not apply this proposal: ' + data.error); return; }
  if (data && data.status === 'conflict_locked') { alert('This field is locked (someone edited it by hand) — the proposal was marked as a conflict instead of overwriting it.'); }
  const row = document.querySelector(`[data-change-id="${id}"]`);
  if (row) row.remove();
}
async function bulkAccept() {
  const threshold = Number(document.getElementById('confThreshold').value);
  const { data: pending } = await db().from('staged_changes').select('id, confidence').eq('trip_id', activeTrip.id).eq('status', 'pending');
  const toAccept = (pending || []).filter(c => Number(c.confidence) >= threshold);
  for (const c of toAccept) await db().rpc('review_staged_change', { p_change_id: c.id, p_action: 'accept' });
  renderImportsSection();
}
