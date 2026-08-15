// Redeems a trip invite token for the currently authenticated caller.
// Runs with the service role so it can create a trip_memberships row for a
// user who — by definition — isn't a member of the trip yet (the normal
// RLS chicken-and-egg problem). Every other check is still done by hand.
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: CORS });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "unauthenticated" }), { status: 401, headers: CORS });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Identify the caller from their JWT using an anon-scoped client.
  const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userErr } = await callerClient.auth.getUser();
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: "unauthenticated" }), { status: 401, headers: CORS });
  }
  const userId = userData.user.id;

  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400, headers: CORS });
  }
  if (!body.token) {
    return new Response(JSON.stringify({ error: "missing_token" }), { status: 400, headers: CORS });
  }

  const admin = createClient(supabaseUrl, serviceKey);

  const { data: invite, error: inviteErr } = await admin
    .schema("app")
    .from("trip_invites")
    .select("*")
    .eq("token", body.token)
    .maybeSingle();

  if (inviteErr || !invite) {
    return new Response(JSON.stringify({ error: "invite_not_found" }), { status: 404, headers: CORS });
  }
  if (invite.redeemed_by) {
    return new Response(JSON.stringify({ error: "already_redeemed" }), { status: 409, headers: CORS });
  }
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return new Response(JSON.stringify({ error: "expired" }), { status: 410, headers: CORS });
  }

  const { data: existing } = await admin
    .schema("app")
    .from("trip_memberships")
    .select("id")
    .eq("trip_id", invite.trip_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    await admin.schema("app").from("trip_invites").update({ redeemed_by: userId, redeemed_at: new Date().toISOString() }).eq("id", invite.id);
    return new Response(JSON.stringify({ tripId: invite.trip_id, membershipId: existing.id, alreadyMember: true }), { headers: CORS });
  }

  const { data: membership, error: memErr } = await admin
    .schema("app")
    .from("trip_memberships")
    .insert({
      trip_id: invite.trip_id,
      user_id: userId,
      role: invite.role,
      display_name: invite.display_name || userData.user.email?.split("@")[0] || "Rider",
    })
    .select("id")
    .single();

  if (memErr) {
    return new Response(JSON.stringify({ error: "membership_create_failed", detail: memErr.message }), { status: 500, headers: CORS });
  }

  await admin.schema("app").from("trip_invites").update({ redeemed_by: userId, redeemed_at: new Date().toISOString() }).eq("id", invite.id);

  return new Response(JSON.stringify({ tripId: invite.trip_id, membershipId: membership.id, alreadyMember: false }), { headers: CORS });
});
