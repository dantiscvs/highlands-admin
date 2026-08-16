// Shared Supabase client. Same project as highlands-live (its public.* tables
// stay untouched); everything here lives in the "app" schema.
const SB_URL = 'https://evlmgtoysvcumluwmusa.supabase.co';
const SB_KEY = 'sb_publishable_EBGf9roabpx5-brXuia6ug_YWkOVc4K';
const sb = supabase.createClient(SB_URL, SB_KEY);
const db = () => sb.schema('app');

const FN_URL = `${SB_URL}/functions/v1`;
async function callFn(name, body) {
  const { data: { session } } = await sb.auth.getSession();
  const res = await fetch(`${FN_URL}/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session ? session.access_token : SB_KEY}`,
      'apikey': SB_KEY,
    },
    body: JSON.stringify(body || {}),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `${name} failed (${res.status})`);
  return json;
}

function esc(s) { return (s == null ? '' : String(s)).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function fmtDate(d) { if (!d) return ''; return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day:'2-digit', month:'short' }); }
function uid() { return crypto.randomUUID(); }

// Theme: light is the design system's default, dark is opt-in ([data-theme="dark"]).
function currentTheme() { return localStorage.getItem('theme') === 'dark' ? 'dark' : 'light'; }
function setTheme(theme) {
  localStorage.setItem('theme', theme);
  document.documentElement.setAttribute('data-theme', theme);
  const route = typeof parseRoute === 'function' ? parseRoute() : null;
  if (route && route.view === 'trip' && typeof activeTrip !== 'undefined' && activeTrip) renderTripSidebar(route.section);
  else if (typeof renderSidebarTripsList === 'function') renderSidebarTripsList();
}
function themeToggleHtml() {
  const t = currentTheme();
  return `<div class="theme-toggle">
    <span>Theme</span>
    <button class="${t==='light'?'on':''}" onclick="setTheme('light')">Light</button>
    <button class="${t==='dark'?'on':''}" onclick="setTheme('dark')">Dark</button>
  </div>`;
}

// Avatar chips: deterministic color from the activity-type palette + initials.
const AVATAR_PALETTE = ['var(--activity-cycling)', 'var(--activity-hiking)', 'var(--activity-driving)', 'var(--activity-kayaking)', 'var(--activity-transit)'];
function avatarColorFor(name) { let h = 0; for (const c of String(name || '')) h = (h * 31 + c.charCodeAt(0)) % AVATAR_PALETTE.length; return AVATAR_PALETTE[h]; }
function avatarInitials(name) { return String(name || '?').trim().split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase(); }
function avatarChip(name, size) {
  size = size === 'sm' ? 'sm' : 'md';
  return `<span class="avatar-chip avatar-chip-${size}" style="background:${avatarColorFor(name)}" title="${esc(name)}">${esc(avatarInitials(name))}</span>`;
}
