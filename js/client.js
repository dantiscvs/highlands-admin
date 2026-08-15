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
