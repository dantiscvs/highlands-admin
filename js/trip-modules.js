function moduleGate(key) {
  if (moduleOn(key)) return false;
  document.getElementById('main').innerHTML = `<div class="pagehead"><h1>Module off</h1></div><div class="module-off-note">This module isn't enabled for this trip. Turn it on in <a href="#" onclick="event.preventDefault();goTrip(activeTrip.id,'settings');">Settings</a>.</div>`;
  return true;
}

// ---- Shared helpers ----
function toDatetimeLocal(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return d.toISOString().slice(0, 16);
}
function fmtDatetime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ---------------- Logistics / transport legs ----------------
const TRANSPORT_TYPES = ['flight','train','bus','ferry','boat','car','campervan','transfer','bike_shipping','other'];
const TRANSPORT_ICONS = { flight:'✈️', train:'🚂', bus:'🚌', ferry:'⛴️', boat:'🛥️', car:'🚗', campervan:'🚐', transfer:'🚕', bike_shipping:'📦', other:'🚦' };

async function renderLogistics() {
  if (moduleGate('transport')) return;
  const [{ data: legs }, { data: days }] = await Promise.all([
    db().from('transport_legs').select('*').eq('trip_id', activeTrip.id).order('order_index'),
    db().from('trip_days').select('id, day_number').eq('trip_id', activeTrip.id).order('order_index'),
  ]);
  document.getElementById('main').innerHTML = `
    <div class="pagehead"><div><h1>Logistics</h1><div class="subtitle">Flights, trains, buses, ferries, transfers, bike shipping — for the trip overall or a specific day.</div></div>
      ${isEditor() ? `<button class="btn btn-primary btn-sm" onclick="addTransportLeg()" title="Or use Imports to auto-extract from a booking email.">+ Add leg</button>` : ''}
    </div>
    ${isEditor() ? `<div class="muted" style="font-size:11px;margin:-6px 0 16px;">💡 Got a booking confirmation email or PDF? <a href="#" onclick="event.preventDefault();goTrip(activeTrip.id,'imports');">Paste/upload it in Imports</a> — we'll extract the details automatically.</div>` : ''}
    <div style="display:flex;flex-direction:column;gap:12px;">
      ${(legs||[]).map(l => transportCardHtml(l, days)).join('') || `
        <div class="empty-state">
          <div class="empty-title">No transport legs yet</div>
          <div class="empty-desc">${isEditor() ? 'Add a leg above, or use <a href="#" onclick="event.preventDefault();goTrip(activeTrip.id,\'imports\');">Imports</a> to extract from a booking email.' : 'No transport legs have been added yet.'}</div>
        </div>`}
    </div>
  `;
}

function transportCardHtml(l, days) {
  const icon = TRANSPORT_ICONS[l.type] || '🚦';
  const anchorLabel = l.anchor === 'trip_start' ? 'Trip start' : l.anchor === 'trip_end' ? 'Trip end' : (() => { const d = (days||[]).find(x=>x.id===l.day_id); return d ? 'Day ' + d.day_number : 'Day ?'; })();
  const depTime = fmtDatetime(l.departure_time);
  const arrTime = fmtDatetime(l.arrival_time);
  const cur = esc(l.currency || activeTrip.default_currency || '');

  return `<div class="card" data-id="${l.id}">
    <!-- Header row -->
    <div style="display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap;margin-bottom:12px;">
      <div style="flex:1;min-width:0;">
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap;">
          <span style="font-size:18px;">${icon}</span>
          ${selectCell(l.id,'type',l.type,TRANSPORT_TYPES,'transport_legs')}
          <span class="badge badge-gray">${esc(anchorLabel)}</span>
          ${isEditor() ? `<select onchange="saveTransportAnchor('${l.id}', this.value)" style="border:1px solid var(--border-strong);border-radius:var(--radius-sm);padding:4px 24px 4px 8px;font-size:12px;">
            <option value="trip_start" ${l.anchor==='trip_start'?'selected':''}>Trip start</option>
            <option value="trip_end" ${l.anchor==='trip_end'?'selected':''}>Trip end</option>
            ${(days||[]).map(d=>`<option value="day:${d.id}" ${l.day_id===d.id?'selected':''}>Day ${d.day_number}</option>`).join('')}
          </select>` : ''}
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
          <input type="text" value="${esc(l.carrier||'')}" placeholder="Carrier / airline / operator"
            onblur="quickSave('transport_legs','${l.id}','carrier',this.value,this)"
            ${isEditor()?'':'disabled'} style="flex:1;min-width:140px;">
          <input type="text" value="${esc(l.reference||'')}" placeholder="Booking reference"
            onblur="quickSave('transport_legs','${l.id}','reference',this.value,this)"
            ${isEditor()?'':'disabled'} style="flex:1;min-width:120px;">
        </div>
      </div>
      ${isEditor() ? `<button class="btn btn-sm btn-danger" onclick="deleteRow('transport_legs','${l.id}', renderLogistics)" style="flex-shrink:0;">✕</button>` : ''}
    </div>

    <!-- Route rows -->
    <div style="display:grid;grid-template-columns:1fr auto;gap:6px 10px;margin-bottom:10px;">
      <input type="text" value="${esc(l.departure_place||'')}" placeholder="Departure city / airport / station"
        onblur="quickSave('transport_legs','${l.id}','departure_place',this.value,this)"
        ${isEditor()?'':'disabled'}>
      <input type="datetime-local" value="${toDatetimeLocal(l.departure_time)}"
        onblur="quickSave('transport_legs','${l.id}','departure_time',this.value||null,this)"
        ${isEditor()?'':'disabled'} style="width:auto;">
      <input type="text" value="${esc(l.arrival_place||'')}" placeholder="Arrival city / airport / station"
        onblur="quickSave('transport_legs','${l.id}','arrival_place',this.value,this)"
        ${isEditor()?'':'disabled'}>
      <input type="datetime-local" value="${toDatetimeLocal(l.arrival_time)}"
        onblur="quickSave('transport_legs','${l.id}','arrival_time',this.value||null,this)"
        ${isEditor()?'':'disabled'} style="width:auto;">
    </div>

    <!-- Bottom row: seats, cost, notes -->
    <div style="display:flex;gap:10px;flex-wrap:wrap;">
      <div style="flex:1;min-width:140px;">
        <label class="muted" style="font-size:11px;display:block;margin-bottom:4px;">Seat(s)</label>
        <input type="text" value="${esc(l.seat_number||'')}" placeholder="e.g. 14A, 15B"
          onblur="quickSave('transport_legs','${l.id}','seat_number',this.value,this)"
          ${isEditor()?'':'disabled'} style="width:100%;">
      </div>
      <div style="min-width:120px;">
        <label class="muted" style="font-size:11px;display:block;margin-bottom:4px;">Cost</label>
        <div style="display:flex;gap:4px;">
          <input type="number" value="${l.cost??''}" placeholder="0"
            onblur="quickSave('transport_legs','${l.id}','cost',this.value,this)"
            ${isEditor()?'':'disabled'} style="width:80px;">
          <input type="text" value="${cur}" placeholder="CUR" maxlength="3"
            onblur="quickSave('transport_legs','${l.id}','currency',this.value.toUpperCase(),this)"
            ${isEditor()?'':'disabled'} style="width:52px;text-transform:uppercase;">
        </div>
      </div>
      <div style="flex:2;min-width:180px;">
        <label class="muted" style="font-size:11px;display:block;margin-bottom:4px;">Notes</label>
        <textarea onblur="quickSave('transport_legs','${l.id}','notes',this.value,this)"
          placeholder="Visa required, check-in deadline, luggage notes…"
          ${isEditor()?'':'disabled'}
          style="width:100%;min-height:36px;resize:vertical;">${esc(l.notes||'')}</textarea>
      </div>
    </div>
  </div>`;
}

function anchorDayCell(l, days) {
  const value = l.anchor === 'custom' && l.day_id ? 'day:' + l.day_id : l.anchor;
  const dayOptions = (days||[]).map(d => `<option value="day:${d.id}" ${value==='day:'+d.id?'selected':''}>Day ${d.day_number}</option>`).join('');
  return `<select ${isEditor()?'':'disabled'} onchange="saveTransportAnchor('${l.id}', this.value)" style="border:none;background:transparent;">
    <option value="trip_start" ${value==='trip_start'?'selected':''}>Trip start</option>
    <option value="trip_end" ${value==='trip_end'?'selected':''}>Trip end</option>
    ${dayOptions}
  </select>`;
}
async function saveTransportAnchor(id, value) {
  const isDay = value.startsWith('day:');
  const patch = isDay ? { anchor: 'custom', day_id: value.slice(4) } : { anchor: value, day_id: null };
  const { error } = await db().from('transport_legs').update(patch).eq('id', id);
  if (error) alert(error.message);
}
function textCell(id, field, val, table, type = 'text') {
  return `<input type="${type}" value="${esc(val==null?'':val)}" ${isEditor()?'':'disabled'} onblur="quickSave('${table}','${id}','${field}',this.value,this)" style="width:100%;min-width:90px;border:none;background:transparent;">`;
}
function selectCell(id, field, val, options, table) {
  return `<select ${isEditor()?'':'disabled'} onchange="quickSave('${table}','${id}','${field}',this.value,this)" style="border:none;background:transparent;">${options.map(o=>`<option value="${o}" ${o===val?'selected':''}>${o}</option>`).join('')}</select>`;
}
async function quickSave(table, id, field, value, el) {
  if (field === 'cost' || field === 'distance_km' || field === 'ascent_m') value = value === '' ? null : Number(value);
  const { error } = await db().from(table).update({ [field]: value }).eq('id', id);
  if (error && el) { el.style.boxShadow = 'inset 0 0 0 1px var(--color-danger)'; alert(error.message); }
}
async function deleteRow(table, id, refresh) {
  if (!confirm('Delete this?')) return;
  await db().from(table).delete().eq('id', id);
  refresh();
}
async function addTransportLeg() {
  await db().from('transport_legs').insert({ trip_id: activeTrip.id, type: 'other', anchor: 'custom', order_index: 999 });
  renderLogistics();
}

// ---------------- Accommodation ----------------
async function renderAccommodationModule() {
  if (moduleGate('accommodation')) return;
  const [{ data: accs }, { data: days }] = await Promise.all([
    db().from('accommodations').select('*').eq('trip_id', activeTrip.id).order('created_at'),
    db().from('trip_days').select('id, day_number').eq('trip_id', activeTrip.id),
  ]);
  const dayLabel = id => { const d = (days||[]).find(x=>x.id===id); return d ? 'Day ' + d.day_number : '—'; };
  document.getElementById('main').innerHTML = `
    <div class="pagehead"><div><h1>Accommodation</h1><div class="subtitle">One row can be linked to a day, or left unlinked for multi-night stays.</div></div>
      ${isEditor() ? '<button class="btn btn-primary btn-sm" onclick="addAccommodation()" title="Tip: booking confirmation emails or PDFs can fill this in automatically — see the Imports tab.">+ Add stay</button>' : ''}
    </div>
    ${isEditor() ? `<div class="muted" style="font-size:11px;margin:-6px 0 12px;">💡 Got a booking confirmation email or PDF? <a href="#" onclick="event.preventDefault();goTrip(activeTrip.id,'imports');">Paste/upload it in Imports</a> instead of typing stays by hand — we'll extract the details and you just review &amp; accept.</div>` : ''}
    <div style="display:flex;flex-direction:column;gap:10px;">
      ${(accs||[]).map(a => accommodationCardHtml(a, days, dayLabel)).join('') || '<p class="muted">No accommodation added yet.</p>'}
    </div>
  `;
}
const PAY_STATUS_COLOR = { unpaid: 'badge-red', partial: 'badge-orange', paid: 'badge-green', free: 'badge-gray' };
function accommodationCardHtml(a, days, dayLabel) {
  return `<div class="card" data-id="${a.id}">
    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-start;">
      <div style="flex:2;min-width:200px;">
        <input type="text" value="${esc(a.name)}" placeholder="Name" onblur="quickSave('accommodations','${a.id}','name',this.value,this)" ${isEditor()?'':'disabled'} style="font-weight:700;width:100%;margin-bottom:6px;">
        <input type="url" value="${esc(a.url||'')}" placeholder="Booking URL" onblur="quickSave('accommodations','${a.id}','url',this.value,this)" ${isEditor()?'':'disabled'} style="width:100%;margin-bottom:6px;">
        <input type="text" value="${esc(a.address||'')}" placeholder="Address (optional)" onblur="quickSave('accommodations','${a.id}','address',this.value,this)" ${isEditor()?'':'disabled'} style="width:100%;margin-bottom:6px;">
        <div style="display:flex;gap:6px;align-items:center;">
          <input type="url" value="${esc(a.map_url||'')}" placeholder="Google Maps link" onblur="quickSave('accommodations','${a.id}','map_url',this.value,this)" ${isEditor()?'':'disabled'} style="flex:1;">
          ${a.map_url ? `<a href="${esc(a.map_url)}" target="_blank" rel="noopener" class="btn btn-sm" title="Open in Google Maps">📍</a>` : ''}
        </div>
      </div>
      <div style="flex:1;min-width:140px;">
        <label class="muted" style="font-size:11px;">Day</label>
        <select ${isEditor()?'':'disabled'} onchange="quickSave('accommodations','${a.id}','day_id',this.value||null,this)" style="width:100%;margin-bottom:6px;">
          <option value="">— unlinked —</option>
          ${(days||[]).map(d=>`<option value="${d.id}" ${d.id===a.day_id?'selected':''}>Day ${d.day_number}</option>`).join('')}
        </select>
        <label class="muted" style="font-size:11px;">Pay status <span style="font-weight:400;">(set manually any time)</span></label>
        <span class="badge ${PAY_STATUS_COLOR[a.pay_status]||'badge-gray'}" style="margin-bottom:4px;display:inline-flex;">${esc(a.pay_status)}</span>
        ${selectCell(a.id, 'pay_status', a.pay_status, ['unpaid','partial','paid','free'], 'accommodations')}
      </div>
      <div style="flex:1;min-width:120px;">
        <label class="muted" style="font-size:11px;">Cost <span style="font-weight:400;">(amount / currency)</span></label>
        <div style="display:flex;gap:4px;">
          <input type="number" value="${a.cost??''}" placeholder="0" onblur="quickSave('accommodations','${a.id}','cost',this.value,this)" ${isEditor()?'':'disabled'} style="width:70%;">
          <input type="text" value="${esc(a.currency||'')}" placeholder="${esc(activeTrip.default_currency||'CUR')}" maxlength="3" onblur="quickSave('accommodations','${a.id}','currency',this.value.toUpperCase(),this)" ${isEditor()?'':'disabled'} style="width:30%;text-transform:uppercase;">
        </div>
        <label class="muted" style="font-size:11px;margin-top:6px;display:block;">Booking reference</label>
        <input type="text" value="${esc(a.booking_reference||'')}" onblur="quickSave('accommodations','${a.id}','booking_reference',this.value,this)" ${isEditor()?'':'disabled'} style="width:100%;">
      </div>
      <button class="btn btn-sm btn-danger" onclick="deleteRow('accommodations','${a.id}', renderAccommodationModule)">✕</button>
    </div>
    <textarea placeholder="Cancellation policy / breakfast info / notes" onblur="quickSave('accommodations','${a.id}','notes',this.value,this)" ${isEditor()?'':'disabled'} style="width:100%;margin-top:8px;min-height:40px;">${esc(a.notes||'')}</textarea>
  </div>`;
}
async function addAccommodation() {
  await db().from('accommodations').insert({ trip_id: activeTrip.id, name: 'New stay', pay_status: 'unpaid', currency: activeTrip.default_currency || null });
  renderAccommodationModule();
}

// ---------------- Sights & resupply (POI) ----------------
async function renderPoiModule() {
  if (moduleGate('poi')) return;
  const [{ data: pois }, { data: days }] = await Promise.all([
    db().from('points_of_interest').select('*').eq('trip_id', activeTrip.id).order('order_index'),
    db().from('trip_days').select('id, day_number, title').eq('trip_id', activeTrip.id).order('order_index'),
  ]);
  const byDay = {};
  (pois||[]).forEach(p => { (byDay[p.day_id] = byDay[p.day_id] || []).push(p); });

  document.getElementById('main').innerHTML = `
    <div class="pagehead">
      <div><h1>Sights &amp; resupply</h1><div class="subtitle">Castles, viewpoints, water refills, shops — anything worth marking on a day.</div></div>
    </div>
    ${(days||[]).map(d => `
      <div class="card" style="margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:6px;">
          <strong>Day ${d.day_number}${d.title ? ' — ' + esc(d.title) : ''}</strong>
          ${isEditor() ? `<button class="btn btn-sm" onclick="openPoiModal('${d.id}', renderPoiModule)">+ Add place</button>` : ''}
        </div>
        <div id="poiList_${d.id}">
          ${(byDay[d.id]||[]).map(p => poiListRowHtml(p)).join('') || '<p class="muted" style="font-size:12px;">Nothing yet.</p>'}
        </div>
      </div>
    `).join('')}
  `;
  if (isEditor()) wirePoiDragDrop();
}

function poiListRowHtml(p) {
  return `<div class="poi-row" data-poi-id="${p.id}" data-day-id="${p.day_id}" draggable="${isEditor()}" style="display:flex;gap:8px;align-items:flex-start;padding:8px 0;border-top:1px solid var(--border-hairline);">
    ${isEditor() ? '<span class="drag-handle" title="Drag to reorder">⠿</span>' : ''}
    <span>${esc(p.icon||(p.category==='resupply'?'🛒':p.category==='water'?'💧':'📍'))}</span>
    <div style="flex:1;min-width:0;">
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
        <input type="text" value="${esc(p.name)}"
          onblur="quickSave('points_of_interest','${p.id}','name',this.value,this)"
          ${isEditor()?'':'disabled'} style="flex:1;min-width:120px;">
        ${selectCell(p.id,'category',p.category,['sight','resupply','water','other'],'points_of_interest')}
      </div>
      <div style="display:flex;gap:6px;align-items:center;margin-top:4px;flex-wrap:wrap;">
        <input type="url" value="${esc(p.url||'')}" placeholder="Website / maps URL"
          onblur="quickSave('points_of_interest','${p.id}','url',this.value,this)"
          ${isEditor()?'':'disabled'} style="flex:1;min-width:120px;font-size:12px;">
        ${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener" class="btn btn-sm" title="Open link">↗</a>` : ''}
        <input type="text" placeholder="opening hours" value="${esc(p.opening_hours||'')}"
          onblur="quickSave('points_of_interest','${p.id}','opening_hours',this.value,this)"
          ${isEditor()?'':'disabled'} style="width:130px;font-size:12px;">
      </div>
    </div>
    ${isEditor() ? `<button class="btn btn-sm btn-danger" onclick="deleteRow('points_of_interest','${p.id}', renderPoiModule)">✕</button>` : ''}
  </div>`;
}

// Custom POI add modal
let _poiModalCallback = null;
function openPoiModal(dayId, callback) {
  _poiModalCallback = callback || renderPoiModule;
  const existing = document.getElementById('poiModalOverlay');
  if (existing) existing.remove();
  document.body.insertAdjacentHTML('beforeend', `
    <div class="modal-ov" id="poiModalOverlay" onclick="closePoiModal(event)">
      <div class="modal" onclick="event.stopPropagation();" style="max-width:440px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">
          <h2 style="margin:0;">Add place</h2>
          <button class="btn btn-sm" onclick="closePoiModal()">✕</button>
        </div>
        <input type="hidden" id="pmDayId" value="${esc(dayId)}">
        <div class="field">
          <label>Name</label>
          <input id="pmName" type="text" placeholder="Urquhart Castle, Tesco, etc." autofocus style="width:100%;">
        </div>
        <div class="field">
          <label>Category</label>
          <select id="pmCat" style="width:100%;">
            <option value="sight">🏰 Sight / attraction</option>
            <option value="resupply">🛒 Resupply (shop)</option>
            <option value="water">💧 Water refill</option>
            <option value="other">📍 Other</option>
          </select>
        </div>
        <div class="field">
          <label>Website / maps link <span class="muted" style="font-weight:400;">(optional)</span></label>
          <input id="pmUrl" type="url" placeholder="https://..." style="width:100%;">
        </div>
        <div class="field">
          <label>Description <span class="muted" style="font-weight:400;">(optional)</span></label>
          <input id="pmDesc" type="text" placeholder="Short note about this place" style="width:100%;">
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:4px;">
          <button class="btn" onclick="closePoiModal()">Cancel</button>
          <button class="btn btn-primary" onclick="submitPoiModal()">Add place</button>
        </div>
      </div>
    </div>
  `);
  document.getElementById('pmName').focus();
  document.getElementById('pmName').addEventListener('keydown', e => { if (e.key === 'Enter') submitPoiModal(); });
}
function closePoiModal(e) {
  if (e && e.target !== document.getElementById('poiModalOverlay')) return;
  const el = document.getElementById('poiModalOverlay');
  if (el) el.remove();
  _poiModalCallback = null;
}
async function submitPoiModal() {
  const name = document.getElementById('pmName').value.trim();
  if (!name) { document.getElementById('pmName').focus(); return; }
  const dayId = document.getElementById('pmDayId').value;
  const category = document.getElementById('pmCat').value;
  const url = document.getElementById('pmUrl').value.trim() || null;
  const description = document.getElementById('pmDesc').value.trim() || null;
  const { error } = await db().from('points_of_interest').insert({ trip_id: activeTrip.id, day_id: dayId, name, category, url, description, order_index: 9999 });
  if (error) { alert(error.message); return; }
  const el = document.getElementById('poiModalOverlay');
  if (el) el.remove();
  if (_poiModalCallback) { _poiModalCallback(); _poiModalCallback = null; }
}

async function addPoiForDay(dayId) {
  openPoiModal(dayId, renderPoiModule);
}

// Drag-and-drop reorder for POI rows
let _dragPoiId = null, _dragDayId = null;
function wirePoiDragDrop() {
  document.querySelectorAll('.poi-row').forEach(row => {
    row.addEventListener('dragstart', e => {
      _dragPoiId = row.dataset.poiId;
      _dragDayId = row.dataset.dayId;
      e.dataTransfer.effectAllowed = 'move';
      row.style.opacity = '0.5';
    });
    row.addEventListener('dragend', () => { row.style.opacity = ''; });
    row.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
    row.addEventListener('drop', async e => {
      e.preventDefault();
      if (!_dragPoiId || row.dataset.poiId === _dragPoiId) return;
      const list = document.getElementById('poiList_' + _dragDayId);
      if (!list) return;
      const rows = [...list.querySelectorAll('.poi-row')];
      const dragIdx = rows.findIndex(r => r.dataset.poiId === _dragPoiId);
      const dropIdx = rows.findIndex(r => r === row);
      if (dragIdx === -1 || dropIdx === -1) return;
      // Reorder in DOM
      const dragged = rows[dragIdx];
      if (dragIdx < dropIdx) row.after(dragged); else row.before(dragged);
      // Persist new order_index values
      const newOrder = [...list.querySelectorAll('.poi-row')];
      await Promise.all(newOrder.map((r, i) => db().from('points_of_interest').update({ order_index: i }).eq('id', r.dataset.poiId)));
      _dragPoiId = null; _dragDayId = null;
    });
  });
}

// ---------------- Tasks / Packing (shared shape) ----------------
let currentChecklistKind = null;
async function renderChecklistModule(kind) {
  if (moduleGate(kind)) return;
  currentChecklistKind = kind;
  const table = kind === 'tasks' ? 'tasks' : 'packing_items';
  const checkTable = kind === 'tasks' ? 'task_checks' : 'packing_checks';
  const fk = kind === 'tasks' ? 'task_id' : 'item_id';
  const [{ data: items }, { data: members }, { data: checks }] = await Promise.all([
    db().from(table).select('*').eq('trip_id', activeTrip.id).order('order_index'),
    db().from('trip_memberships').select('*').eq('trip_id', activeTrip.id).eq('is_on_trip', true),
    db().from(checkTable).select('*'),
  ]);
  const itemIds = new Set((items||[]).map(i=>i.id));
  const checksByItem = {};
  (checks||[]).filter(c => itemIds.has(c[fk])).forEach(c => { (checksByItem[c[fk]] = checksByItem[c[fk]] || []).push(c); });
  const membersById = {};
  (members||[]).forEach(m => membersById[m.id] = m);

  document.getElementById('main').innerHTML = `
    <div class="pagehead">
      <div><h1>${kind === 'tasks' ? 'Tasks' : 'Packing list'}</h1>
        <div class="subtitle">Manage the list here. Members check things off from their own view. Items can be assigned to everyone or just specific people.</div>
      </div>
      ${isEditor() ? `<div style="display:flex;gap:6px;align-items:center;"><input id="newItemInput" type="text" placeholder="Add item…" style="width:220px;" onkeydown="if(event.key==='Enter')addChecklistItem('${table}')"><button class="btn btn-primary btn-sm" onclick="addChecklistItem('${table}')">+ Add</button></div>` : ''}
    </div>
    <div class="gridWrap"><table class="simple">
      <thead><tr>
        <th>Item</th>
        <th style="min-width:90px;">Assigned to</th>
        ${(members||[]).map(m=>`<th style="text-align:center;">${avatarChip(m.display_name,'sm')}</th>`).join('')}
        <th></th>
      </tr></thead>
      <tbody>
        ${(items||[]).map(i => checklistRowHtml(i, members, checksByItem, fk, checkTable, table)).join('') || `<tr><td colspan="99" class="muted" style="padding:20px;text-align:center;">Nothing yet — add your first item above.</td></tr>`}
      </tbody>
    </table></div>
  `;
}

function isAssignedTo(item, member) {
  // null assigned_to = everyone; array = specific members
  return !item.assigned_to || item.assigned_to.includes(member.id);
}

function checklistRowHtml(item, members, checksByItem, fk, checkTable, table) {
  const assignedAll = !item.assigned_to || item.assigned_to.length === 0;
  const assignedChips = assignedAll ? '' : (item.assigned_to || []).map(id => {
    const m = members.find(m => m.id === id);
    return m ? avatarChip(m.display_name, 'sm') : '';
  }).join('');

  const assignCell = isEditor() ? `
    <span class="assignment-pill" onclick="openAssignmentPicker('${item.id}','${table}',event)" title="Click to change assignment" style="cursor:pointer;">
      ${assignedAll ? '<span class="badge badge-gray">All</span>' : assignedChips}
    </span>` : `${assignedAll ? '<span class="badge badge-gray">All</span>' : assignedChips}`;

  const memberCells = (members||[]).map(m => {
    const assigned = isAssignedTo(item, m);
    if (!assigned) return `<td style="text-align:center;color:var(--text-tertiary);" title="Not assigned to ${esc(m.display_name)}">—</td>`;
    const rec = (checksByItem[item.id]||[]).find(c => c.membership_id === m.id);
    const on = rec && rec.checked;
    const isMe = activeMembership && m.id === activeMembership.id;
    return `<td style="text-align:center;${isMe?'cursor:pointer;':''}" ${isMe?`onclick="toggleOwnCheck('${checkTable}','${fk}','${item.id}','${m.id}',${!on})"`:''} title="${isMe?'Click to toggle':esc(m.display_name)}">${on ? '✅' : (isMe ? '☐' : '—')}</td>`;
  }).join('');

  return `<tr data-item-id="${item.id}">
    <td>${textCell(item.id, 'title', item.title, table)}</td>
    <td>${assignCell}</td>
    ${memberCells}
    <td>${isEditor() ? `<button class="btn btn-sm btn-danger" onclick="deleteRow('${table}','${item.id}', () => renderChecklistModule('${currentChecklistKind}'))">✕</button>` : ''}</td>
  </tr>`;
}

async function toggleOwnCheck(checkTable, fk, itemId, membershipId, checked) {
  const { error } = await db().from(checkTable).upsert({ [fk]: itemId, membership_id: membershipId, checked }, { onConflict: `${fk},membership_id` });
  if (error) { alert(error.message); return; }
  renderChecklistModule(currentChecklistKind);
}
async function addChecklistItem(table) {
  const input = document.getElementById('newItemInput');
  const title = input.value.trim(); if (!title) return;
  await db().from(table).insert({ trip_id: activeTrip.id, title, order_index: 9999 });
  renderChecklistModule(table === 'tasks' ? 'tasks' : 'packing');
}

// Assignment picker popup
let _assignPickerItemId = null, _assignPickerTable = null;
async function openAssignmentPicker(itemId, table, evt) {
  evt.stopPropagation();
  // Remove any existing picker
  document.querySelectorAll('.assign-picker').forEach(el => el.remove());

  const { data: members } = await db().from('trip_memberships').select('*').eq('trip_id', activeTrip.id).eq('is_on_trip', true);
  const { data: item } = await db().from(table).select('assigned_to').eq('id', itemId).single();
  const assignedTo = item?.assigned_to || null;

  const picker = document.createElement('div');
  picker.className = 'assign-picker';
  picker.style.cssText = 'position:fixed;background:var(--bg-card);border:1px solid var(--border-strong);border-radius:var(--radius-md);box-shadow:var(--shadow-e3);padding:10px 14px;z-index:500;min-width:180px;';
  const rect = evt.target.getBoundingClientRect();
  picker.style.top = (rect.bottom + 6) + 'px';
  picker.style.left = rect.left + 'px';
  picker.innerHTML = `
    <div style="font-size:11px;font-weight:600;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px;">Assigned to</div>
    <label style="display:flex;align-items:center;gap:8px;padding:4px 0;cursor:pointer;">
      <input type="radio" name="ap" value="all" ${!assignedTo||assignedTo.length===0?'checked':''}> Everyone
    </label>
    ${(members||[]).map(m => `
      <label style="display:flex;align-items:center;gap:8px;padding:4px 0;cursor:pointer;">
        <input type="checkbox" class="ap-member" value="${m.id}" ${assignedTo && assignedTo.includes(m.id)?'checked':''}> ${esc(m.display_name)}
      </label>
    `).join('')}
    <div style="display:flex;gap:6px;margin-top:10px;">
      <button class="btn btn-primary btn-sm" onclick="saveAssignment('${itemId}','${table}')">Save</button>
      <button class="btn btn-sm" onclick="this.closest('.assign-picker').remove()">Cancel</button>
    </div>
  `;
  document.body.appendChild(picker);
  // Close on outside click
  setTimeout(() => document.addEventListener('click', function closeP(e) {
    if (!picker.contains(e.target)) { picker.remove(); document.removeEventListener('click', closeP); }
  }), 0);
}
async function saveAssignment(itemId, table) {
  const picker = document.querySelector('.assign-picker');
  const allRadio = picker.querySelector('[name="ap"][value="all"]');
  let assigned_to = null;
  if (!allRadio.checked) {
    assigned_to = [...picker.querySelectorAll('.ap-member:checked')].map(el => el.value);
    if (assigned_to.length === 0) assigned_to = null; // fallback to all if none selected
  }
  const { error } = await db().from(table).update({ assigned_to }).eq('id', itemId);
  if (error) { alert(error.message); return; }
  picker.remove();
  renderChecklistModule(currentChecklistKind);
}

// ---------------- Expenses ----------------
async function renderExpensesModule() {
  if (moduleGate('expenses')) return;
  const [{ data: expenses }, { data: members }] = await Promise.all([
    db().from('expenses').select('*').eq('trip_id', activeTrip.id).order('created_at', { ascending: false }),
    db().from('trip_memberships').select('*').eq('trip_id', activeTrip.id).eq('is_on_trip', true),
  ]);
  const byId = {}; (members||[]).forEach(m => byId[m.id] = m);
  const currencies = [...new Set((expenses||[]).map(e=>e.currency))];

  const summary = currencies.map(cur => {
    const list = (expenses||[]).filter(e=>e.currency===cur);
    const balances = {}; (members||[]).forEach(m => balances[m.id] = 0);
    list.forEach(e => {
      const share = e.amount / e.participants.length;
      e.participants.forEach(pid => { balances[pid] = (balances[pid]||0) - share; });
      balances[e.paid_by] = (balances[e.paid_by]||0) + e.amount;
    });
    return `<div class="card" style="margin-bottom:10px;">
      <strong>${esc(cur)}</strong> — total ${list.reduce((s,e)=>s+Number(e.amount),0).toFixed(2)}
      <div style="display:flex;gap:16px;margin-top:8px;flex-wrap:wrap;">
        ${(members||[]).map(m => `<div style="font-size:12px;"><span class="muted">${esc(m.display_name)}</span> <strong style="color:${balances[m.id]>0.01?'var(--color-success)':balances[m.id]<-0.01?'var(--color-danger)':'var(--text-secondary)'};">${balances[m.id]>=0?'+':''}${(balances[m.id]||0).toFixed(2)}</strong></div>`).join('')}
      </div>
    </div>`;
  }).join('');

  document.getElementById('main').innerHTML = `
    <div class="pagehead"><div><h1>Expenses</h1><div class="subtitle">Owners, editors and riders can log expenses. Split evenly across selected participants.</div></div></div>
    ${summary || '<p class="muted">No expenses yet.</p>'}
    <div class="card" style="margin:16px 0;">
      <h2>Add expense</h2>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
        <input id="expDesc" type="text" placeholder="Description" style="flex:1;min-width:160px;">
        <input id="expAmount" type="number" placeholder="Amount" style="width:110px;">
        <input id="expCurrency" type="text" placeholder="Currency" value="${esc(activeTrip.default_currency)}" maxlength="3" style="width:70px;">
      </div>
      <div style="margin-bottom:8px;"><span class="muted" style="font-size:12px;">Paid by:</span>
        <select id="expPaidBy">${(members||[]).map(m=>`<option value="${m.id}">${esc(m.display_name)}</option>`).join('')}</select>
      </div>
      <div style="margin-bottom:10px;"><span class="muted" style="font-size:12px;">Participants:</span>
        ${(members||[]).map(m=>`<label style="margin-right:10px;"><input type="checkbox" class="expPart" value="${m.id}" checked> ${esc(m.display_name)}</label>`).join('')}
      </div>
      <button class="btn btn-primary" onclick="addExpense()">+ Add</button>
    </div>
    <table class="simple">
      <thead><tr><th>Description</th><th>Paid by</th><th>Amount</th><th></th></tr></thead>
      <tbody>${(expenses||[]).map(e => `<tr><td>${esc(e.description)}</td><td style="display:flex;align-items:center;gap:8px;">${avatarChip(byId[e.paid_by]?.display_name||'?','sm')}${esc(byId[e.paid_by]?.display_name||'?')}</td><td>${e.amount} ${esc(e.currency)}</td><td><button class="btn btn-sm btn-danger" onclick="deleteRow('expenses','${e.id}', renderExpensesModule)">✕</button></td></tr>`).join('')}</tbody>
    </table>
  `;
}
async function addExpense() {
  const description = document.getElementById('expDesc').value.trim();
  const amount = parseFloat(document.getElementById('expAmount').value);
  const currency = document.getElementById('expCurrency').value.trim().toUpperCase();
  const paid_by = document.getElementById('expPaidBy').value;
  const participants = [...document.querySelectorAll('.expPart:checked')].map(el => el.value);
  if (!description || !amount || !participants.length) { alert('Fill in description, amount, and at least one participant.'); return; }
  const { error } = await db().from('expenses').insert({ trip_id: activeTrip.id, description, amount, currency, paid_by, participants });
  if (error) { alert(error.message); return; }
  renderExpensesModule();
}

// ---------------- Photos ----------------
async function renderPhotosModule() {
  if (moduleGate('photos')) return;
  const [{ data: updates }, { data: days }] = await Promise.all([
    db().from('updates').select('*').eq('trip_id', activeTrip.id).not('photo_url', 'is', null).order('created_at', { ascending: false }),
    db().from('trip_days').select('id, day_number, title').eq('trip_id', activeTrip.id).order('order_index'),
  ]);
  document.getElementById('main').innerHTML = `
    <div class="pagehead"><div><h1>Photos</h1><div class="subtitle">Photos shown on the participant live page (when showPhotos is enabled in visibility settings).</div></div></div>
    ${isEditor() ? `<div class="card" style="margin-bottom:16px;">
      <h2>Upload photo</h2>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;align-items:center;">
        <input id="photoFile" type="file" accept="image/*" style="flex:1;min-width:180px;">
        <select id="photoDay" style="width:140px;">
          <option value="">No day tag</option>
          ${(days||[]).map(d=>`<option value="${d.id}">Day ${d.day_number}${d.title?' — '+esc(d.title.substring(0,22)):''}</option>`).join('')}
        </select>
      </div>
      <input id="photoCaption" type="text" placeholder="Caption (optional)" style="width:100%;margin-bottom:10px;">
      <button class="btn btn-primary" onclick="uploadPhoto()">Upload</button>
      <span id="photoStatus" class="saveIndicator" style="margin-left:10px;"></span>
    </div>` : ''}
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;">
      ${(updates||[]).map(u => `
        <div class="card" style="padding:8px;position:relative;">
          <img src="${esc(u.photo_url)}" alt="${esc(u.caption||'')}" loading="lazy"
            style="width:100%;height:140px;object-fit:cover;border-radius:8px;display:block;cursor:zoom-in;"
            onclick="adminOpenLightbox('${esc(u.photo_url)}','${esc(u.caption||'')}')">
          ${u.caption ? `<div style="font-size:12px;margin-top:6px;color:var(--text-secondary);">${esc(u.caption)}</div>` : ''}
          <div style="font-size:11px;color:var(--text-tertiary);margin-top:3px;">${u.created_at ? new Date(u.created_at).toLocaleDateString() : ''}</div>
          ${isEditor() ? `<button class="btn btn-sm btn-danger" style="position:absolute;top:8px;right:8px;padding:2px 7px;font-size:11px;line-height:1.4;" onclick="deletePhoto('${u.id}','${esc(u.photo_url)}')">✕</button>` : ''}
        </div>
      `).join('') || '<p class="muted">No photos yet. Upload one above.</p>'}
    </div>
    <div id="admin-lb" onclick="adminCloseLightbox()" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:9999;align-items:center;justify-content:center;cursor:zoom-out;flex-direction:column;gap:12px;">
      <img id="admin-lb-img" src="" style="max-width:90vw;max-height:85vh;border-radius:12px;object-fit:contain;box-shadow:0 8px 40px rgba(0,0,0,.5);">
      <div id="admin-lb-cap" style="color:#fff;font-size:14px;text-align:center;max-width:500px;opacity:.85;"></div>
    </div>
  `;
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

async function uploadPhoto() {
  const file = document.getElementById('photoFile').files[0];
  if (!file) { alert('Pick a file first.'); return; }
  const status = document.getElementById('photoStatus');
  status.textContent = 'Uploading…'; status.className = 'saveIndicator saving';
  const ext = file.name.split('.').pop().toLowerCase();
  const path = `trips/${activeTrip.id}/${Date.now()}-${Math.random().toString(36).slice(2,7)}.${ext}`;
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
  renderPhotosModule();
}
async function deletePhoto(id, url) {
  if (!confirm('Delete this photo? This cannot be undone.')) return;
  const storagePath = url.split('/photos/').slice(1).join('/photos/');
  if (storagePath) await db().storage.from('photos').remove([storagePath]);
  await db().from('updates').delete().eq('id', id);
  renderPhotosModule();
}
