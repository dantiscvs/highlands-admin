// One-time bootstrap: creates a real demo/organizer account via the Auth
// Admin API (never hand-crafts auth.users rows) and seeds it with the
// Scotland trip via app.seed_scotland_trip(). Protected by a shared secret
// so it can't be hit by a stranger and spam-create accounts. Idempotent:
// if the demo user already exists, just confirms/returns it rather than
// erroring, and only seeds a trip if that user doesn't own one yet.
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-bootstrap-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const expected = Deno.env.get("BOOTSTRAP_SECRET");
  const provided = req.headers.get("x-bootstrap-secret");
  if (!expected || provided !== expected) {
    return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: CORS });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  const email = "demo@tripadmin.app";
  const password = crypto.randomUUID().replace(/-/g, "").slice(0, 16) + "Aa1!";

  let userId: string;
  const { data: existingList } = await admin.auth.admin.listUsers();
  const existing = existingList?.users.find((u) => u.email === email);

  if (existing) {
    userId = existing.id;
  } else {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: "Michał (Demo)" },
    });
    if (createErr || !created?.user) {
      return new Response(JSON.stringify({ error: "user_create_failed", detail: createErr?.message }), { status: 500, headers: CORS });
    }
    userId = created.user.id;
  }

  const { data: ownedTrips } = await admin.schema("app").from("trips").select("id").eq("owner_id", userId);
  let tripId: string | null = ownedTrips?.[0]?.id ?? null;

  if (!tripId) {
    const { data: seeded, error: seedErr } = await admin.schema("app").rpc("seed_scotland_trip", { p_owner_id: userId });
    if (seedErr) {
      return new Response(JSON.stringify({ error: "seed_failed", detail: seedErr.message }), { status: 500, headers: CORS });
    }
    tripId = seeded as unknown as string;
  }

  return new Response(
    JSON.stringify({
      email,
      password: existing ? "(unchanged — account already existed)" : password,
      tripId,
      note: "Sign in at the admin panel with this email/password. Change the password after first login if you plan to keep using this account.",
    }),
    { headers: { ...CORS, "content-type": "application/json" } },
  );
});
