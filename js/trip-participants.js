// Participants (Section 9): member list with role management + shareable
// invite links. Invite creation/redemption follows the staged pattern used
// elsewhere — trip_invites rows are plain CRUD for the owner/editor (RLS:
// invites_admin), redemption goes through the invite-redeem edge function
// since the redeemer isn't a trip member yet (see functions/invite-redeem).
let participantsCache = [];

async function renderParticipantsSection() {
  const [{ data: members }, { data: invites }] = await Promise.all([
    db().from('trip_memberships').select('*').eq('trip_id', activeTrip.id).order('created_at'),
    isEditor() ? db().from('trip_invites').select('*').eq('trip_id', activeTrip.id).order('created_at', { ascending: false }) : Promise.resolve({ data: [] }),
  ]);
  participantsCache = members || [];
  const pending = (invites || []).filter(i => !i.redeemed_by && (!i.expires_at || new Date(i.expires_at) > new Date()));

  document.getElementById('main').innerHTML = `
    <div class="pagehead"><div><h1>Participants</h1><div class="subtitle">Who's on this trip, and what they can do.</div></div></div>

    <div class="card" style="margin-bottom:16px;">
      <h2>Members</h2>
      <div class="gridWrap"><table class="simple">
        <thead><tr><th>Name</th><th>Role</th><th title="Riders count toward pace/expense calculations — viewers (e.g. someone following along at home) don't">On trip?</th><th></th></tr></thead>
        <tbody>${participantsCache.map(m => memberRowHtml(m)).join('')}</tbody>
      </table></div>
    </div>

    ${isEditor() ? `
    <div class="card" style="margin-bottom:16px;">
      <h2>Invite someone</h2>
      <p class="muted" style="font-size:12px;margin-bottom:10px;">Create a link and send it however you like (WhatsApp, email, text). It works once, for the role you pick.</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;">
        <div class="field" style="margin:0;"><label>Name (optional)</label><input id="inviteName" type="text" placeholder="e.g. Sam" style="width:160px;"></div>
        <div class="field" style="margin:0;min-width:280px;"><label>Role</label>
          <select id="inviteRole">
            <option value="editor">Editor — can edit everything</option>
            <option value="rider" selected>Rider — on the trip; checks off tasks/packing, logs expenses</option>
            <option value="viewer">Viewer — read-only (e.g. following along from home)</option>
          </select>
        </div>
        <button class="btn btn-primary" onclick="createInvite()">Create invite link</button>
      </div>
      <div id="newInviteResult" style="margin-top:10px;"></div>
    </div>

    ${pending.length ? `
    <div class="card">
      <h2>Pending invites</h2>
      <div class="gridWrap"><table class="simple">
        <thead><tr><th>For</th><th>Role</th><th>Created</th><th></th><th></th></tr></thead>
        <tbody>
          ${pending.map(i => `<tr>
            <td>${esc(i.display_name || '—')}</td>
            <td><span class="badge badge-gray">${esc(i.role)}</span></td>
            <td class="muted">${fmtDate(i.created_at.slice(0,10))}</td>
            <td><button class="btn btn-sm" onclick="copyInviteLink('${i.token}', this)">Copy link</button></td>
            <td><button class="btn btn-sm btn-danger" onclick="revokeInvite('${i.id}')">Revoke</button></td>
          </tr>`).join('')}
        </tbody>
      </table></div>
    </div>
    ` : ''}
    ` : ''}
  `;
}

function memberRowHtml(m) {
  const isMe = currentUser && m.user_id === currentUser.id;
  const canManage = isEditor() && m.role !== 'owner';
  return `<tr>
    <td>${esc(m.display_name)}${isMe ? ' <span class="muted" style="font-size:11px;">(you)</span>' : ''}</td>
    <td>${m.role === 'owner'
      ? '<span class="badge badge-blue">Owner</span>'
      : (canManage
        ? `<select onchange="changeMemberRole('${m.id}', this.value)">${['editor','rider','viewer'].map(r => `<option value="${r}" ${r===m.role?'selected':''}>${r}</option>`).join('')}</select>`
        : `<span class="badge badge-gray">${esc(m.role)}</span>`)}
    </td>
    <td><input type="checkbox" ${m.is_on_trip?'checked':''} ${canManage?'':'disabled'} onchange="toggleMemberOnTrip('${m.id}', this.checked)"></td>
    <td>${canManage ? `<button class="btn btn-sm btn-danger" onclick="removeMember('${m.id}')">Remove</button>` : ''}</td>
  </tr>`;
}

async function changeMemberRole(id, role) {
  const { error } = await db().from('trip_memberships').update({ role }).eq('id', id);
  if (error) { alert(error.message); renderParticipantsSection(); }
}
async function toggleMemberOnTrip(id, val) {
  const { error } = await db().from('trip_memberships').update({ is_on_trip: val }).eq('id', id);
  if (error) { alert(error.message); renderParticipantsSection(); }
}
async function removeMember(id) {
  const m = participantsCache.find(x => x.id === id);
  if (!confirm(`Remove ${m ? m.display_name : 'this person'} from the trip? They lose access immediately.`)) return;
  const { error } = await db().from('trip_memberships').delete().eq('id', id);
  if (error) { alert(error.message); return; }
  renderParticipantsSection();
}

async function createInvite() {
  const role = document.getElementById('inviteRole').value;
  const display_name = document.getElementById('inviteName').value.trim() || null;
  const { data, error } = await db().from('trip_invites').insert({ trip_id: activeTrip.id, role, display_name, created_by: currentUser.id }).select('token').single();
  if (error) { alert(error.message); return; }
  const url = inviteUrl(data.token);
  const result = document.getElementById('newInviteResult');
  if (result) {
    result.innerHTML = `<div style="display:flex;gap:8px;align-items:center;">
      <input type="text" readonly value="${esc(url)}" style="flex:1;min-width:200px;" onclick="this.select()">
      <button class="btn btn-sm" onclick="navigator.clipboard.writeText('${url}');this.textContent='Copied!'">Copy</button>
    </div>`;
  }
  renderParticipantsSection();
}
async function revokeInvite(id) {
  if (!confirm('Revoke this invite link? It stops working immediately.')) return;
  await db().from('trip_invites').delete().eq('id', id);
  renderParticipantsSection();
}
function inviteUrl(token) {
  return `${location.origin}${location.pathname}#/invite/${token}`;
}
function copyInviteLink(token, btn) {
  navigator.clipboard.writeText(inviteUrl(token));
  const orig = btn.textContent; btn.textContent = 'Copied!';
  setTimeout(() => { btn.textContent = orig; }, 1500);
}

// ---- Redemption (landing on #/invite/:token while/after signing in) ----
async function redeemInviteToken(token) {
  const main = document.getElementById('main');
  if (main) main.innerHTML = '<p class="muted">Joining trip…</p>';
  try {
    const result = await callFn('invite-redeem', { token });
    goTrip(result.tripId, 'overview');
  } catch (e) {
    if (main) {
      main.innerHTML = `
        <div class="pagehead"><div><h1>Invite link</h1></div></div>
        <div class="card">
          <p>${esc(e.message)}</p>
          <p class="muted" style="margin-top:8px;font-size:12px;">This link may already have been used, revoked, or expired. Ask the trip organizer for a new one.</p>
          <button class="btn" style="margin-top:12px;" onclick="goTrips()">Go to my trips</button>
        </div>
      `;
    }
  }
}
