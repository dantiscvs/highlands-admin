// Auth: magic link (OTP) primary path, email+password fallback (used by the
// demo account created via the bootstrap-demo edge function).
let currentUser = null;

async function initAuth() {
  const { data: { session } } = await sb.auth.getSession();
  currentUser = session ? session.user : null;
  sb.auth.onAuthStateChange((_event, session) => {
    currentUser = session ? session.user : null;
    renderAuthGate();
  });
  renderAuthGate();
}

function renderAuthGate() {
  const gate = document.getElementById('authGate');
  const shell = document.getElementById('appShell');
  // Visibility is toggled by class, not inline style: the responsive layout
  // needs to switch #appShell between flex (desktop) and block (mobile), and
  // an inline display would win over the media query.
  if (currentUser) {
    gate.style.display = 'none';
    shell.classList.add('show');
    onSignedIn();
  } else {
    gate.style.display = 'flex';
    shell.classList.remove('show');
  }
}

function renderAuthForm() {
  const gate = document.getElementById('authGate');
  const route = typeof parseRoute === 'function' ? parseRoute() : null;
  const inviteNote = route && route.view === 'invite'
    ? `<div class="card" style="margin-bottom:20px;text-align:left;background:var(--accent-primary-subtle);border-color:var(--accent-primary-subtle-border);"><p style="font-size:13px;">🎟️ You've been invited to a trip. Sign in or enter your email below — you'll be added automatically once you're signed in.</p></div>`
    : '';
  gate.innerHTML = `
    <div class="modal" style="max-width:380px;text-align:center;">
      ${inviteNote}
      <div style="font-size:40px;margin-bottom:8px;">🗺️</div>
      <h1 style="margin-bottom:4px;">Trip Tracker</h1>
      <p class="subtitle" style="margin-bottom:24px;">Plan and run multi-day group trips.</p>

      <div id="authMagicPane">
        <div class="field" style="text-align:left;">
          <label>Email</label>
          <input type="email" id="authEmail" placeholder="you@example.com">
        </div>
        <button class="btn btn-primary" style="width:100%;justify-content:center;margin-top:10px;" onclick="sendMagicLink()">Send magic link</button>
        <div class="muted" style="font-size:11px;margin-top:8px;">First time here? Just enter your email above — an account is created automatically the first time you click the link.</div>
        <div class="muted" style="font-size:12px;margin:14px 0 6px;">or</div>
        <button class="btn btn-sm" onclick="togglePasswordPane()">Use a demo account (email + password)</button>
      </div>

      <div id="authPasswordPane" style="display:none;">
        <div class="muted" style="font-size:11px;margin-bottom:10px;text-align:left;">Only works for accounts created with a password already set (e.g. the shared demo login). Magic-link accounts have no password — use "Send magic link" instead.</div>
        <div class="field" style="text-align:left;">
          <label>Email</label>
          <input type="email" id="authEmailPw" placeholder="demo@tripadmin.app">
        </div>
        <div class="field" style="text-align:left;">
          <label>Password</label>
          <input type="password" id="authPassword">
        </div>
        <button class="btn btn-primary" style="width:100%;justify-content:center;margin-bottom:8px;" onclick="signInPassword()">Sign in</button>
        <button class="btn" style="width:100%;justify-content:center;" onclick="togglePasswordPane()">← back to magic link</button>
      </div>

      <div id="authMsg" style="margin-top:14px;font-size:13px;"></div>
    </div>
  `;
}

function togglePasswordPane() {
  const magic = document.getElementById('authMagicPane');
  const pw = document.getElementById('authPasswordPane');
  const showPw = magic.style.display !== 'none';
  magic.style.display = showPw ? 'none' : '';
  pw.style.display = showPw ? '' : 'none';
}

async function sendMagicLink() {
  const email = document.getElementById('authEmail').value.trim();
  const msg = document.getElementById('authMsg');
  if (!email) { msg.textContent = 'Enter an email address.'; msg.style.color = 'var(--color-danger)'; return; }
  const route = typeof parseRoute === 'function' ? parseRoute() : null;
  if (route && route.view === 'invite') localStorage.setItem('pendingInviteToken', route.token);
  msg.textContent = 'Sending…'; msg.style.color = 'var(--text-secondary)';
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } });
  if (error) { msg.textContent = error.message; msg.style.color = 'var(--color-danger)'; return; }
  msg.textContent = 'Check your email for a sign-in link.'; msg.style.color = 'var(--color-success)';
}

async function signInPassword() {
  const email = document.getElementById('authEmailPw').value.trim();
  const password = document.getElementById('authPassword').value;
  const msg = document.getElementById('authMsg');
  msg.textContent = 'Signing in…'; msg.style.color = 'var(--text-secondary)';
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    msg.textContent = error.message.includes('Invalid')
      ? 'Invalid login. If you signed up with a magic link, that account has no password — use "Send magic link" instead.'
      : error.message;
    msg.style.color = 'var(--color-danger)';
    return;
  }
}

async function signOut() {
  await sb.auth.signOut();
}
