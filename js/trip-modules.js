function moduleGate(key) {
  if (moduleOn(key)) return false;
  document.getElementById('main').innerHTML = `<div class="pagehead"><h1>Module off</h1></div><div class="module-off-note">This module isn't enabled for this trip. Turn it on in <a href="#" onclick="event.preventDefault();goTrip(activeTrip.id,'settings');">Settings</a>.</div>`;
  return true;
}

// ---- Per-tab Cards/Edit view toggle ----
// Editing is dense and form-like on purpose (it's faster), but that's a poor
// default for reading. Each module tab therefore opens in card view and lets
// an editor flip to the edit form; the choice is remembered per tab.
const moduleView = (tab) => localStorage.getItem('moduleView_' + tab) || 'cards';
function setModuleView(tab, mode, rerender) {
  localStorage.setItem('moduleView_' + tab, mode);
  rerender();
}
function viewToggleHtml(tab, rerenderName) {
  if (!isEditor()) return '';
  const v = moduleView(tab);
  return `<div class="viewtoggle">
    <button class="btn btn-sm ${v==='cards'?'btn-primary':''}" onclick="setModuleView('${tab}','cards',${rerenderName})">👁 Cards</button>
    <button class="btn btn-sm ${v==='edit'?'btn-primary':''}" onclick="setModuleView('${tab}','edit',${rerenderName})">✎ Edit</button>
  </div>`;
}
// Cards unless the user is an editor who explicitly chose the edit form.
function showEditForm(tab) { return isEditor() && moduleView(tab) === 'edit'; }

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
  const edit = showEditForm('logistics');
  document.getElementById('main').innerHTML = `
    <div class="pagehead"><div><h1>Logistics</h1><div class="subtitle">Flights, trains, buses, ferries, transfers, bike shipping — for the trip overall or a specific day.</div></div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        ${viewToggleHtml('logistics','renderLogistics')}
        ${isEditor() ? `<button class="btn btn-primary btn-sm" onclick="openLegModal()">+ Add leg</button>` : ''}
      </div>
    </div>
    ${isEditor() ? `<div class="muted" style="font-size:11px;margin:-6px 0 16px;">💡 Got a booking confirmation email or PDF? <a href="#" onclick="event.preventDefault();goTrip(activeTrip.id,'imports');">Paste/upload it in Imports</a> — we'll extract the details automatically.</div>` : ''}
    <div style="display:flex;flex-direction:column;gap:12px;">
      ${(legs||[]).map(l => edit ? transportCardHtml(l, days) : transportReadonlyHtml(l, days, true)).join('') || `
        <div class="empty-state">
          <div class="empty-title">No transport legs yet</div>
          <div class="empty-desc">${isEditor() ? 'Add a leg above, or use <a href="#" onclick="event.preventDefault();goTrip(activeTrip.id,\'imports\');">Imports</a> to extract from a booking email.' : 'No transport legs have been added yet.'}</div>
        </div>`}
    </div>
  `;
}

// Add-leg modal — a new row appended silently at the bottom of a long list is
// effectively invisible, so new items are created through a real form.
function openLegModal() {
  db().from('trip_days').select('id, day_number').eq('trip_id', activeTrip.id).order('order_index').then(({ data: days }) => {
    openFormModal({
      title: 'Add transport leg',
      fields: [
        { id: 'lgType', label: 'Type', type: 'select', options: TRANSPORT_TYPES.map(t => ({ v: t, l: `${TRANSPORT_ICONS[t]||''} ${t.replace(/_/g,' ')}` })) },
        { id: 'lgWhen', label: 'When', type: 'select', options: [
            { v: 'trip_start', l: 'Trip start' }, { v: 'trip_end', l: 'Trip end' },
            ...(days||[]).map(d => ({ v: 'day:' + d.id, l: 'Day ' + d.day_number })),
          ] },
        { id: 'lgCarrier', label: 'Carrier / operator', placeholder: 'Ryanair, ScotRail…' },
        { id: 'lgFrom', label: 'From', placeholder: 'Gdańsk (GDN)' },
        { id: 'lgDep', label: 'Departs', type: 'datetime-local' },
        { id: 'lgTo', label: 'To', placeholder: 'Edinburgh (EDI)' },
        { id: 'lgArr', label: 'Arrives', type: 'datetime-local' },
        { id: 'lgRef', label: 'Reference', placeholder: 'Booking ref' },
        { id: 'lgSeat', label: 'Seat(s)', placeholder: '14A, 15B' },
      ],
      submitLabel: 'Add leg',
      onSubmit: async (v) => {
        const when = v.lgWhen;
        const isDay = when.startsWith('day:');
        const { error } = await db().from('transport_legs').insert({
          trip_id: activeTrip.id, type: v.lgType || 'other',
          anchor: isDay ? 'custom' : when, day_id: isDay ? when.slice(4) : null,
          carrier: v.lgCarrier || null, reference: v.lgRef || null, seat_number: v.lgSeat || null,
          departure_place: v.lgFrom || null, arrival_place: v.lgTo || null,
          departure_time: v.lgDep || null, arrival_time: v.lgArr || null,
          currency: activeTrip.default_currency || null, order_index: 999,
        });
        if (error) return error.message;
        renderLogistics();
      },
    });
  });
}

// ---- Generic form modal (used for "add" flows across modules) ----
let _formModalSubmit = null;
function openFormModal({ title, fields, submitLabel, onSubmit }) {
  document.getElementById('formModalOverlay')?.remove();
  _formModalSubmit = onSubmit;
  const fieldHtml = fields.map(f => {
    if (f.type === 'select') {
      return `<div class="field"><label>${esc(f.label)}</label>
        <select id="${f.id}" style="width:100%;">${f.options.map(o => `<option value="${esc(o.v)}">${esc(o.l)}</option>`).join('')}</select></div>`;
    }
    if (f.type === 'textarea') {
      return `<div class="field"><label>${esc(f.label)}</label><textarea id="${f.id}" placeholder="${esc(f.placeholder||'')}" style="width:100%;"></textarea></div>`;
    }
    return `<div class="field"><label>${esc(f.label)}</label>
      <input id="${f.id}" type="${f.type||'text'}" placeholder="${esc(f.placeholder||'')}" style="width:100%;"></div>`;
  }).join('');
  document.body.insertAdjacentHTML('beforeend', `
    <div class="modal-ov" id="formModalOverlay" onclick="closeFormModal(event)">
      <div class="modal" onclick="event.stopPropagation();">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <h2 style="margin:0;">${esc(title)}</h2>
          <button class="btn btn-sm" onclick="closeFormModal()">✕</button>
        </div>
        ${fieldHtml}
        <div id="formModalErr" style="color:var(--color-danger);font-size:var(--text-sm);margin-bottom:8px;"></div>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button class="btn" onclick="closeFormModal()">Cancel</button>
          <button class="btn btn-primary" onclick="submitFormModal(this)">${esc(submitLabel||'Save')}</button>
        </div>
      </div>
    </div>`);
  const first = document.getElementById(fields[0].id);
  if (first) first.focus();
}
function closeFormModal(e) {
  if (e && e.target !== document.getElementById('formModalOverlay')) return;
  document.getElementById('formModalOverlay')?.remove();
  _formModalSubmit = null;
}
async function submitFormModal(btn) {
  const ov = document.getElementById('formModalOverlay');
  if (!ov || !_formModalSubmit) return;
  const values = {};
  ov.querySelectorAll('input, select, textarea').forEach(el => { if (el.id) values[el.id] = el.value.trim ? el.value.trim() : el.value; });
  btn.disabled = true; btn.textContent = 'Saving…';
  const err = await _formModalSubmit(values);
  if (err) {
    document.getElementById('formModalErr').textContent = err;
    btn.disabled = false; btn.textContent = 'Save';
    return;
  }
  ov.remove();
  _formModalSubmit = null;
}

// Read-only presentation for riders/viewers (and organisers in participant
// preview): a boarding-pass style card rather than a row of input boxes.
function transportReadonlyHtml(l, days, allowEdit) {
  const icon = TRANSPORT_ICONS[l.type] || '🚦';
  const typeLabel = (l.type || 'other').replace(/_/g, ' ');
  const anchorLabel = l.anchor === 'trip_start' ? 'Trip start'
    : l.anchor === 'trip_end' ? 'Trip end'
    : (() => { const d = (days||[]).find(x => x.id === l.day_id); return d ? 'Day ' + d.day_number : null; })();

  const dep = l.departure_time ? new Date(l.departure_time) : null;
  const arr = l.arrival_time ? new Date(l.arrival_time) : null;
  const hhmm = dt => dt && !isNaN(dt) ? String(dt.getHours()).padStart(2,'0') + ':' + String(dt.getMinutes()).padStart(2,'0') : '—';
  const dstr = dt => dt && !isNaN(dt) ? dt.toLocaleDateString([], { weekday:'short', day:'numeric', month:'short' }) : '';

  let dur = '';
  if (dep && arr && !isNaN(dep) && !isNaN(arr) && arr > dep) {
    const mins = Math.round((arr - dep) / 60000);
    dur = `${Math.floor(mins/60)}h ${String(mins%60).padStart(2,'0')}m`;
  }
  // Flag an arrival that lands on a later calendar day than departure.
  const overnight = dep && arr && !isNaN(dep) && !isNaN(arr) && arr.toDateString() !== dep.toDateString();

  const facts = [];
  if (l.reference)   facts.push({ k: 'Reference',  v: esc(l.reference), mono: true });
  if (l.seat_number) facts.push({ k: 'Seat(s)',    v: esc(l.seat_number), mono: true });
  if (l.cost)        facts.push({ k: 'Cost',       v: `${l.cost} ${esc(l.currency || activeTrip.default_currency || '')}`, mono: true });

  return `<div class="leg-card">
    <div class="leg-head">
      <span style="font-size:17px;">${icon}</span>
      <span class="badge badge-gray" style="text-transform:capitalize;">${esc(typeLabel)}</span>
      ${anchorLabel ? `<span class="badge badge-blue">${esc(anchorLabel)}</span>` : ''}
      <span class="leg-sub">${[esc(l.carrier || ''), dstr(dep)].filter(Boolean).join(' · ')}</span>
      ${allowEdit && isEditor() ? `<button class="btn btn-sm" style="margin-left:auto;" onclick="setModuleView('logistics','edit',renderLogistics)" title="Switch to the edit form">✎</button>` : ''}
    </div>
    <div class="leg-body">
      <div class="leg-route">
        <div class="leg-end">
          <div class="leg-time">${hhmm(dep)}</div>
          <div class="leg-place">${esc(l.departure_place || '—')}</div>
        </div>
        <div class="leg-mid">
          ${dur ? `<div class="leg-dur">${dur}</div>` : ''}
          <div class="leg-line"></div>
        </div>
        <div class="leg-end arr">
          <div class="leg-time">${hhmm(arr)}</div>
          <div class="leg-place">${esc(l.arrival_place || '—')}</div>
          ${overnight ? `<div style="font-size:var(--text-xs);color:var(--accent-secondary);margin-top:2px;">${dstr(arr)}</div>` : ''}
        </div>
      </div>
      ${facts.length ? `<div class="leg-facts">
        ${facts.map(f => `<div class="leg-fact"><div class="fk">${f.k}</div><div class="fv${f.mono?' mono':''}">${f.v}</div></div>`).join('')}
      </div>` : ''}
      ${l.notes ? `<div style="margin-top:12px;padding:10px 12px;background:var(--bg-recessed);border-radius:var(--radius-md);font-size:var(--text-sm);white-space:pre-wrap;">${esc(l.notes)}</div>` : ''}
    </div>
  </div>`;
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
  const edit = showEditForm('accommodation');
  document.getElementById('main').innerHTML = `
    <div class="pagehead"><div><h1>Accommodation</h1><div class="subtitle">One stay can be linked to a day, or left unlinked for multi-night stays.</div></div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        ${viewToggleHtml('accommodation','renderAccommodationModule')}
        ${isEditor() ? '<button class="btn btn-primary btn-sm" onclick="openStayModal()">+ Add stay</button>' : ''}
      </div>
    </div>
    ${isEditor() ? `<div class="muted" style="font-size:11px;margin:-6px 0 12px;">💡 Got a booking confirmation email or PDF? <a href="#" onclick="event.preventDefault();goTrip(activeTrip.id,'imports');">Paste/upload it in Imports</a> instead of typing stays by hand — we'll extract the details and you just review &amp; accept.</div>` : ''}
    <div style="display:flex;flex-direction:column;gap:10px;">
      ${(accs||[]).map(a => edit ? accommodationCardHtml(a, days, dayLabel) : accommodationReadonlyHtml(a, dayLabel, true)).join('') || `
        <div class="empty-state"><div class="empty-title">No stays yet</div>
        <div class="empty-desc">${isEditor() ? 'Add one above, or import a booking confirmation.' : 'Nothing has been added yet.'}</div></div>`}
    </div>
  `;
}

function openStayModal() {
  db().from('trip_days').select('id, day_number').eq('trip_id', activeTrip.id).order('order_index').then(({ data: days }) => {
    openFormModal({
      title: 'Add stay',
      fields: [
        { id: 'stName', label: 'Name', placeholder: "Morag's Lodge" },
        { id: 'stDay', label: 'Night of', type: 'select', options: [
            { v: '', l: '— unlinked (multi-night) —' },
            ...(days||[]).map(d => ({ v: d.id, l: 'Day ' + d.day_number })),
          ] },
        { id: 'stRoom', label: 'Room type', placeholder: 'Twin en-suite, 4-bed dorm…' },
        { id: 'stUrl', label: 'Booking URL', type: 'url', placeholder: 'https://…' },
        { id: 'stMap', label: 'Google Maps link', type: 'url', placeholder: 'https://maps…' },
        { id: 'stRef', label: 'Booking reference' },
        { id: 'stCost', label: 'Cost', type: 'number' },
      ],
      submitLabel: 'Add stay',
      onSubmit: async (v) => {
        if (!v.stName) return 'Give the stay a name.';
        const { error } = await db().from('accommodations').insert({
          trip_id: activeTrip.id, name: v.stName, day_id: v.stDay || null,
          room_type: v.stRoom || null, url: v.stUrl || null, map_url: v.stMap || null,
          booking_reference: v.stRef || null, cost: v.stCost ? Number(v.stCost) : null,
          pay_status: 'unpaid', currency: activeTrip.default_currency || null,
        });
        if (error) return error.message;
        renderAccommodationModule();
      },
    });
  });
}

function accommodationReadonlyHtml(a, dayLabel, allowEdit) {
  const links = [];
  if (a.url) links.push(`<a href="${esc(a.url)}" target="_blank" rel="noopener">Booking ↗</a>`);
  if (a.map_url) links.push(`<a href="${esc(a.map_url)}" target="_blank" rel="noopener">Map ↗</a>`);
  const facts = [];
  if (a.booking_reference) facts.push({ k: 'Reference', v: esc(a.booking_reference), mono: true });
  if (a.phone) facts.push({ k: 'Phone', v: `<a href="tel:${esc(a.phone)}">${esc(a.phone)}</a>` });
  if (a.cost) facts.push({ k: 'Cost', v: `${a.cost} ${esc(a.currency || activeTrip.default_currency || '')}`, mono: true });
  return `<div class="leg-card">
    <div class="leg-head">
      <span style="font-size:17px;">🏠</span>
      <span class="badge badge-gray">${esc(a.day_id ? dayLabel(a.day_id) : 'Unlinked')}</span>
      <span class="badge ${PAY_STATUS_COLOR[a.pay_status] || 'badge-gray'}">${esc(a.pay_status || '')}</span>
      ${allowEdit && isEditor() ? `<button class="btn btn-sm" style="margin-left:auto;" onclick="setModuleView('accommodation','edit',renderAccommodationModule)" title="Switch to the edit form">✎</button>` : ''}
    </div>
    <div class="leg-body">
      <div style="font-weight:600;font-size:var(--text-md);">${esc(a.name)}</div>
      ${a.room_type ? `<div style="font-size:var(--text-sm);color:var(--accent-secondary);font-weight:500;margin-top:2px;">🛏️ ${esc(a.room_type)}</div>` : ''}
      ${a.address ? `<div class="muted" style="font-size:var(--text-sm);margin-top:3px;">${esc(a.address)}</div>` : ''}
      ${links.length ? `<div style="margin-top:8px;display:flex;gap:12px;flex-wrap:wrap;font-size:var(--text-sm);">${links.join('')}</div>` : ''}
      ${a.breakfast_info ? `<div class="irow" style="margin-top:10px;"><div class="ico">🍳</div><div class="ilbl">Breakfast</div>
        <div class="ival">${a.breakfast_url ? `<a href="${esc(a.breakfast_url)}" target="_blank" rel="noopener">${esc(a.breakfast_info)}</a>` : esc(a.breakfast_info)}</div></div>` : ''}
      ${a.cancellation_policy ? `<div class="irow"><div class="ico">⚠️</div><div class="ilbl">Cancellation</div><div class="ival">${esc(a.cancellation_policy)}</div></div>` : ''}
      ${facts.length ? `<div class="leg-facts">
        ${facts.map(f => `<div class="leg-fact"><div class="fk">${f.k}</div><div class="fv${f.mono?' mono':''}">${f.v}</div></div>`).join('')}
      </div>` : ''}
      ${a.notes ? `<div style="margin-top:12px;padding:10px 12px;background:var(--bg-recessed);border-radius:var(--radius-md);font-size:var(--text-sm);white-space:pre-wrap;">${esc(a.notes)}</div>` : ''}
    </div>
  </div>`;
}
const PAY_STATUS_COLOR = { unpaid: 'badge-red', partial: 'badge-orange', paid: 'badge-green', free: 'badge-gray' };
function accommodationCardHtml(a, days, dayLabel) {
  return `<div class="card" data-id="${a.id}">
    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-start;">
      <div style="flex:2;min-width:200px;">
        <input type="text" value="${esc(a.name)}" placeholder="Name" onblur="quickSave('accommodations','${a.id}','name',this.value,this)" ${isEditor()?'':'disabled'} style="font-weight:700;width:100%;margin-bottom:6px;">
        <input type="text" value="${esc(a.room_type||'')}" placeholder="Room type (twin en-suite, 4-bed dorm…)" onblur="quickSave('accommodations','${a.id}','room_type',this.value,this)" ${isEditor()?'':'disabled'} style="width:100%;margin-bottom:6px;">
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
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;padding-top:10px;border-top:1px solid var(--border-hairline);">
      <div style="flex:2;min-width:200px;">
        <label class="muted" style="font-size:11px;display:block;margin-bottom:4px;">🍳 Breakfast <span style="font-weight:400;">(shown on the day card)</span></label>
        <div style="display:flex;gap:6px;">
          <input type="text" value="${esc(a.breakfast_info||'')}" placeholder="e.g. 07:30–09:00, included"
            onblur="quickSave('accommodations','${a.id}','breakfast_info',this.value,this)" ${isEditor()?'':'disabled'} style="flex:2;min-width:120px;">
          <input type="url" value="${esc(a.breakfast_url||'')}" placeholder="Menu / cafe link"
            onblur="quickSave('accommodations','${a.id}','breakfast_url',this.value,this)" ${isEditor()?'':'disabled'} style="flex:1;min-width:100px;">
        </div>
      </div>
      <div style="flex:1;min-width:140px;">
        <label class="muted" style="font-size:11px;display:block;margin-bottom:4px;">📞 Phone</label>
        <input type="tel" value="${esc(a.phone||'')}" placeholder="+44 …"
          onblur="quickSave('accommodations','${a.id}','phone',this.value,this)" ${isEditor()?'':'disabled'} style="width:100%;">
      </div>
    </div>
    <label class="muted" style="font-size:11px;display:block;margin:10px 0 4px;">⚠️ Cancellation policy</label>
    <input type="text" value="${esc(a.cancellation_policy||'')}" placeholder="e.g. free until 3 days before"
      onblur="quickSave('accommodations','${a.id}','cancellation_policy',this.value,this)" ${isEditor()?'':'disabled'} style="width:100%;">
    <textarea placeholder="Other notes" onblur="quickSave('accommodations','${a.id}','notes',this.value,this)" ${isEditor()?'':'disabled'} style="width:100%;margin-top:8px;min-height:40px;">${esc(a.notes||'')}</textarea>
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

  const edit = showEditForm('poi');
  document.getElementById('main').innerHTML = `
    <div class="pagehead">
      <div><h1>Sights &amp; resupply</h1><div class="subtitle">Castles, viewpoints, restaurants, water refills, shops — anything worth marking on a day.</div></div>
      ${viewToggleHtml('poi','renderPoiModule')}
    </div>
    ${(days||[]).map(d => {
      const list = byDay[d.id] || [];
      return `<div class="card" style="margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:6px;">
          <strong>Day ${d.day_number}${d.title ? ' — ' + esc(d.title) : ''}</strong>
          ${isEditor() ? `<button class="btn btn-sm" onclick="openPoiModal('${d.id}', renderPoiModule)">+ Add place</button>` : ''}
        </div>
        <div id="poiList_${d.id}">
          ${list.length
            ? (edit ? list.map(p => poiListRowHtml(p)).join('')
                    : POI_GROUPS.map(g => {
                        const gl = list.filter(p => g.match(p.category));
                        if (!gl.length) return '';
                        return `<div style="padding:6px 0;border-top:1px solid var(--border-hairline);">
                          <div class="muted" style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px;">${g.icon} ${g.label}</div>
                          ${gl.map(poiLineHtml).join('')}
                        </div>`;
                      }).join(''))
            : '<p class="muted" style="font-size:12px;">Nothing yet.</p>'}
        </div>
      </div>`;
    }).join('')}
  `;
  if (edit) wirePoiDragDrop();
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
        ${selectCell(p.id,'category',p.category,['sight','food','resupply','water','other'],'points_of_interest')}
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
            <option value="food">🍽️ Restaurant / cafe / pub</option>
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

