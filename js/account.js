async function renderAccountPage() {
  const main = document.getElementById('main');
  const meta = currentUser.user_metadata || {};
  const avatarUrl = meta.avatar_url || '';
  const fullName = meta.full_name || '';
  const phone = meta.phone || '';

  main.innerHTML = `
    <div class="pagehead"><div><h1>Account</h1><div class="subtitle">Your profile and credentials.</div></div></div>

    <div class="card" style="margin-bottom:14px;">
      <h2>Avatar</h2>
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:12px;">
        <div id="avatarPreview">${_accountAvatarImg(avatarUrl, fullName)}</div>
        <div>
          <input type="file" id="avatarFile" accept="image/jpeg,image/png,image/webp" style="display:none" onchange="uploadAvatar()">
          <button class="btn btn-sm" onclick="document.getElementById('avatarFile').click()">Choose image</button>
          <span id="avatarStatus" class="muted" style="font-size:12px;margin-left:8px;"></span>
        </div>
      </div>
    </div>

    <div class="card" style="margin-bottom:14px;">
      <h2>Profile</h2>
      <label class="muted" style="font-size:12px;">Display name</label>
      <div style="display:flex;gap:8px;margin-top:4px;margin-bottom:12px;">
        <input type="text" id="accountName" value="${esc(fullName)}" placeholder="Your name" style="flex:1;">
        <button class="btn btn-sm btn-primary" onclick="saveProfile()">Save</button>
      </div>
      <label class="muted" style="font-size:12px;">Phone</label>
      <div style="display:flex;gap:8px;margin-top:4px;">
        <input type="tel" id="accountPhone" value="${esc(phone)}" placeholder="+44 7700 000000" style="flex:1;">
        <button class="btn btn-sm btn-primary" onclick="saveProfile()">Save</button>
      </div>
      <span id="profileStatus" class="muted" style="font-size:12px;display:block;margin-top:8px;"></span>
    </div>

    <div class="card" style="margin-bottom:14px;">
      <h2>Email</h2>
      <p class="muted" style="font-size:13px;">${esc(currentUser.email)}</p>
      <p class="muted" style="font-size:11px;">To change your email address, contact support.</p>
    </div>

    <div class="card">
      <h2>Password</h2>
      <p class="muted" style="font-size:12px;margin-bottom:10px;">Leave blank to keep your current password. Filling this in sets or replaces it.</p>
      <label class="muted" style="font-size:12px;">New password</label>
      <input type="password" id="accountPw" placeholder="At least 8 characters" style="width:100%;margin-top:4px;margin-bottom:8px;">
      <label class="muted" style="font-size:12px;">Confirm password</label>
      <input type="password" id="accountPwConfirm" placeholder="Repeat password" style="width:100%;margin-top:4px;margin-bottom:10px;">
      <button class="btn btn-sm btn-primary" onclick="savePassword()">Set password</button>
      <span id="pwStatus" class="muted" style="font-size:12px;margin-left:8px;"></span>
    </div>
  `;
}

function _accountAvatarImg(url, name) {
  if (url) {
    return `<img src="${esc(url)}" alt="avatar" style="width:64px;height:64px;border-radius:50%;object-fit:cover;border:2px solid var(--border-hairline);">`;
  }
  return `<span class="avatar-chip avatar-chip-md" style="width:64px;height:64px;font-size:22px;border-radius:50%;background:${avatarColorFor(name || currentUser.email)}">${esc(avatarInitials(name || currentUser.email))}</span>`;
}

async function uploadAvatar() {
  const file = document.getElementById('avatarFile').files[0];
  const status = document.getElementById('avatarStatus');
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { status.textContent = 'File too large (max 2 MB).'; return; }
  status.textContent = 'Uploading…';
  const ext = file.name.split('.').pop().toLowerCase();
  const path = `${currentUser.id}/avatar.${ext}`;
  const { error: uploadErr } = await sb.storage.from('avatars').upload(path, file, { upsert: true });
  if (uploadErr) { status.textContent = 'Upload failed: ' + uploadErr.message; return; }
  const { data: { publicUrl } } = sb.storage.from('avatars').getPublicUrl(path);
  const { error: updateErr } = await sb.auth.updateUser({ data: { avatar_url: publicUrl } });
  if (updateErr) { status.textContent = 'Saved avatar but failed to update profile: ' + updateErr.message; return; }
  currentUser = (await sb.auth.getUser()).data.user;
  document.getElementById('avatarPreview').innerHTML = _accountAvatarImg(publicUrl, currentUser.user_metadata?.full_name || '');
  status.textContent = 'Avatar updated.';
}

async function saveProfile() {
  const status = document.getElementById('profileStatus');
  const full_name = document.getElementById('accountName').value.trim();
  const phone = document.getElementById('accountPhone').value.trim();
  status.textContent = 'Saving…';
  const { error } = await sb.auth.updateUser({ data: { full_name, phone } });
  if (error) { status.textContent = 'Error: ' + error.message; return; }
  currentUser = (await sb.auth.getUser()).data.user;
  status.textContent = 'Saved.';
}

async function savePassword() {
  const status = document.getElementById('pwStatus');
  const pw = document.getElementById('accountPw').value;
  const confirm = document.getElementById('accountPwConfirm').value;
  if (!pw) { status.textContent = 'Enter a password.'; return; }
  if (pw.length < 8) { status.textContent = 'Password must be at least 8 characters.'; return; }
  if (pw !== confirm) { status.textContent = 'Passwords do not match.'; return; }
  status.textContent = 'Saving…';
  const { error } = await sb.auth.updateUser({ password: pw });
  if (error) { status.textContent = 'Error: ' + error.message; return; }
  document.getElementById('accountPw').value = '';
  document.getElementById('accountPwConfirm').value = '';
  status.textContent = 'Password set.';
}
