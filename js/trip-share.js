const LIVE_VIEW_BASE = 'live.html'; // sibling file in this repo, deployed alongside index.html

async function renderShareSection() {
  const [{ data: providers }, { data: myLinks }, { data: allLinks }, { data: members }] = await Promise.all([
    db().from('tracking_providers').select('*').order('sort_order'),
    activeMembership ? db().from('tracking_links').select('*').eq('membership_id', activeMembership.id) : { data: [] },
    db().from('tracking_links').select('*, trip_memberships(display_name)').eq('trip_id', activeTrip.id),
    db().from('trip_memberships').select('*').eq('trip_id', activeTrip.id),
  ]);
  const vis = activeTrip.visibility || {};
  const shareUrl = activeTrip.share_token ? `${location.origin}${location.pathname.replace(/index\.html$/, '')}${LIVE_VIEW_BASE}?t=${activeTrip.share_token}` : null;

  document.getElementById('main').innerHTML = `
    <div class="pagehead"><div><h1>Share &amp; live</h1><div class="subtitle">A public, read-only page for anyone with the link — no account needed.</div></div></div>

    <div class="card" style="margin-bottom:16px;">
      <h2>Public share link</h2>
      <label style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
        <input type="checkbox" id="shareEnabled" ${activeTrip.share_enabled?'checked':''} ${isEditor()?'':'disabled'} onchange="toggleShareEnabled(this.checked)">
        Enable public link
      </label>
      ${shareUrl ? `<div style="display:flex;gap:8px;align-items:center;margin-bottom:10px;">
        <input type="text" readonly value="${esc(shareUrl)}" style="flex:1;" onclick="this.select()">
        <button class="btn btn-sm" onclick="navigator.clipboard.writeText('${shareUrl}');this.textContent='Copied!'">Copy</button>
        ${isEditor() ? `<button class="btn btn-sm btn-danger" onclick="regenerateShareToken()">Regenerate</button>` : ''}
      </div>` : ''}
      <div class="field"><label>Optional passcode</label><input type="text" id="sharePasscode" value="${esc(activeTrip.share_passcode||'')}" placeholder="Leave blank for none" ${isEditor()?'':'disabled'}></div>
      ${isEditor() ? `<button class="btn btn-sm" onclick="savePasscode()">Save passcode</button>` : ''}
    </div>

    <div class="card" style="margin-bottom:16px;">
      <h2>What shows on the public page</h2>
      <p class="muted" style="font-size:12px;margin-bottom:10px;">Sensitive fields default to hidden. Turn each one on deliberately.</p>
      ${visToggle('showCosts', 'Costs', vis)}
      ${visToggle('showExpenseBalances', 'Expense balances', vis)}
      ${visToggle('showBookingRefs', 'Booking references', vis)}
      ${visToggle('showPhones', 'Phone numbers', vis)}
      ${visToggle('showExactAddresses', 'Exact accommodation addresses', vis)}
      ${visToggle('showPhotos', 'Photos', vis)}
    </div>

    <div class="card" style="margin-bottom:16px;">
      <h2>Your tracking link</h2>
      <p class="muted" style="font-size:12px;margin-bottom:10px;">Only you can add or revoke your own link — the organizer can't add one on your behalf.</p>
      ${activeMembership ? renderMyTrackingLinks(myLinks, providers) : '<p class="muted">You need to be a trip member to add a tracking link.</p>'}
    </div>

    <div class="card">
      <h2>All riders' tracking status</h2>
      <table class="simple">
        <thead><tr><th>Rider</th><th>Provider</th><th>Status</th><th>Public?</th></tr></thead>
        <tbody>
          ${(members||[]).filter(m=>m.is_on_trip).map(m => {
            const links = (allLinks||[]).filter(l => l.membership_id === m.id);
            if (!links.length) return `<tr><td>${esc(m.display_name)}</td><td class="muted">—</td><td class="badge badge-gray">not set up</td><td>—</td></tr>`;
            return links.map(l => `<tr><td>${esc(m.display_name)}</td><td>${esc((providers||[]).find(p=>p.id===l.provider_id)?.display_name || l.provider_id)}</td><td><span class="badge ${l.is_active?'badge-green':'badge-gray'}">${l.is_active?'active':'off'}</span></td><td>${l.is_public?'yes':'no'}</td></tr>`).join('');
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}
function visToggle(key, label, vis) {
  return `<label style="display:flex;align-items:center;gap:8px;padding:5px 0;">
    <input type="checkbox" ${vis[key]?'checked':''} ${isEditor()?'':'disabled'} onchange="saveVisibility('${key}', this.checked)"> ${label}
  </label>`;
}
async function saveVisibility(key, val) {
  const vis = { ...(activeTrip.visibility||{}), [key]: val };
  const { error } = await db().from('trips').update({ visibility: vis }).eq('id', activeTrip.id);
  if (!error) activeTrip.visibility = vis;
}
async function toggleShareEnabled(val) {
  await db().from('trips').update({ share_enabled: val }).eq('id', activeTrip.id);
  activeTrip.share_enabled = val;
  renderShareSection();
}
async function savePasscode() {
  const v = document.getElementById('sharePasscode').value.trim() || null;
  await db().from('trips').update({ share_passcode: v }).eq('id', activeTrip.id);
  activeTrip.share_passcode = v;
}
async function regenerateShareToken() {
  if (!confirm('Old link will stop working immediately. Continue?')) return;
  const token = crypto.randomUUID().replace(/-/g, '');
  await db().from('trips').update({ share_token: token }).eq('id', activeTrip.id);
  activeTrip.share_token = token;
  renderShareSection();
}

function renderMyTrackingLinks(links, providers) {
  return `
    ${(links||[]).map(l => `
      <div style="display:flex;gap:8px;align-items:center;padding:6px 0;border-top:1px solid var(--bg3);">
        <span class="badge ${l.is_active?'badge-green':'badge-gray'}">${(providers||[]).find(p=>p.id===l.provider_id)?.display_name || l.provider_id}</span>
        <span class="muted" style="font-size:12px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(l.url)}</span>
        <button class="btn btn-sm" onclick="toggleMyLink('${l.id}', ${!l.is_active})">${l.is_active?'Turn off':'Turn on'}</button>
        <button class="btn btn-sm btn-danger" onclick="revokeMyLink('${l.id}')">Revoke</button>
      </div>
    `).join('')}
    <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
      <input type="url" id="newTrackUrl" placeholder="Paste your Garmin/Wahoo/Strava/etc. link" style="flex:1;min-width:200px;" oninput="autoDetectProvider(this.value)">
      <select id="newTrackProvider">${(providers||[]).map(p=>`<option value="${p.id}">${esc(p.display_name)}</option>`).join('')}</select>
      <button class="btn btn-primary btn-sm" onclick="addMyTrackingLink()">Add</button>
    </div>
    <div id="providerHelp" class="muted" style="font-size:11px;margin-top:6px;"></div>
  `;
}
function autoDetectProvider(url) {
  if (!url) return;
  db().from('tracking_providers').select('*').then(({ data }) => {
    const match = (data||[]).find(p => p.id !== 'generic' && (p.url_patterns||[]).some(pat => { try { return new RegExp(pat, 'i').test(url); } catch { return false; } }));
    if (match) {
      document.getElementById('newTrackProvider').value = match.id;
      document.getElementById('providerHelp').innerHTML = `Detected <strong>${esc(match.display_name)}</strong>. ${(match.instructions||[]).length ? 'Steps: ' + match.instructions.join(' → ') : ''}`;
    }
  });
}
async function addMyTrackingLink() {
  const url = document.getElementById('newTrackUrl').value.trim();
  const provider_id = document.getElementById('newTrackProvider').value;
  if (!url) return;
  const { error } = await db().from('tracking_links').insert({ trip_id: activeTrip.id, membership_id: activeMembership.id, provider_id, url, is_public: true, is_active: true });
  if (error) { alert(error.message); return; }
  renderShareSection();
}
async function toggleMyLink(id, active) {
  await db().from('tracking_links').update({ is_active: active }).eq('id', id);
  renderShareSection();
}
async function revokeMyLink(id) {
  if (!confirm('Revoke this tracking link? It disappears from the public page immediately.')) return;
  await db().from('tracking_links').delete().eq('id', id);
  renderShareSection();
}
