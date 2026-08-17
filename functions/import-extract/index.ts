// Shared extraction pipeline for Path 2 (email) and Path 3 (document) imports.
// Never writes directly to a trip — every extracted field lands as a
// `pending` row in app.staged_changes for human review (Section 5.4).
//
// If the ANTHROPIC_API_KEY secret is configured, extraction is done by an
// LLM call with a strict JSON schema, temperature 0, and an explicit
// instruction to return null rather than guess. Without a key configured,
// falls back to a heuristic parser (CSV/table row mapping for documents;
// regex label-matching for emails) so the pipeline is demonstrable without
// any external dependency — clearly lower-confidence, and labelled as such.
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    proposals: {
      type: "array",
      items: {
        type: "object",
        properties: {
          entityType: { type: "string", enum: ["trip_days", "accommodations", "transport_legs"] },
          dayNumber: { type: ["integer", "null"] },
          fieldName: { type: "string" },
          value: { type: ["string", "number", "null"] },
          confidence: { type: "number" },
          sourceExcerpt: { type: "string" },
        },
        required: ["entityType", "fieldName", "value", "confidence", "sourceExcerpt"],
      },
    },
  },
  required: ["proposals"],
};

async function extractWithGroq(apiKey: string, text: string) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", "authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      temperature: 0,
      max_tokens: 4096,
      messages: [
        {
          role: "system",
          content:
            "You extract trip-planning facts (accommodation, transport, day distances/titles/dates) from booking confirmations or itinerary documents. " +
            "Return ONLY a JSON object with a 'proposals' array matching this schema: " + JSON.stringify(EXTRACTION_SCHEMA) + ". " +
            "If a field is not clearly present, omit it — never guess a distance, date, or price. " +
            "Quote the exact source text in sourceExcerpt. No markdown fences — raw JSON only.",
        },
        { role: "user", content: text.slice(0, 15000) },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Groq call failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  const raw = json.choices?.[0]?.message?.content ?? "{}";
  const match = raw.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(match ? match[0] : raw);
  return (parsed.proposals ?? []).map((p: any) => ({ ...p, source: "llm" }));
}

async function extractWithClaude(apiKey: string, text: string) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 4096,
      temperature: 0,
      system:
        "You extract trip-planning facts (accommodation, transport, day distances/titles/dates) from booking confirmations or itinerary documents. " +
        "Return ONLY JSON matching the given schema. If a field is not clearly present, omit it — never guess a distance, date, or price. " +
        "Quote the exact source text you based each proposal on in sourceExcerpt.",
      messages: [{ role: "user", content: `Schema:\n${JSON.stringify(EXTRACTION_SCHEMA)}\n\nDocument:\n${text.slice(0, 15000)}` }],
    }),
  });
  if (!res.ok) throw new Error(`Claude call failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  const raw = json.content?.[0]?.text ?? "{}";
  const match = raw.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(match ? match[0] : raw);
  return (parsed.proposals ?? []).map((p: any) => ({ ...p, source: "llm" }));
}

// Heuristic fallback #1: CSV/table text, one row per day.
function extractFromCsv(text: string) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(/[,;\t]/).map((h) => h.trim().toLowerCase());
  const colMap: Record<string, string> = {
    day: "dayNumber", "day number": "dayNumber", "#": "dayNumber",
    date: "date", title: "title", name: "title", route: "title",
    distance: "distance_km", "distance (km)": "distance_km", km: "distance_km",
    ascent: "ascent_m", elevation: "ascent_m",
    accommodation: "accommodation_name", hotel: "accommodation_name", stay: "accommodation_name",
    notes: "notes", description: "description",
  };
  const proposals: any[] = [];
  for (let r = 1; r < lines.length; r++) {
    const cells = lines[r].split(/[,;\t]/).map((c) => c.trim());
    const dayIdx = headers.findIndex((h) => colMap[h] === "dayNumber");
    const dayNumber = dayIdx >= 0 ? parseInt(cells[dayIdx], 10) : r;
    headers.forEach((h, i) => {
      const field = colMap[h];
      const value = cells[i];
      if (!field || field === "dayNumber" || !value) return;
      const entityType = field === "accommodation_name" ? "accommodations" : "trip_days";
      const fieldName = field === "accommodation_name" ? "name" : field;
      proposals.push({
        entityType, dayNumber: isNaN(dayNumber) ? null : dayNumber, fieldName, value,
        confidence: 0.55, sourceExcerpt: `row ${r + 1}, column "${headers[i]}": ${value}`,
        source: "heuristic-csv",
      });
    });
  }
  return proposals;
}

// Heuristic fallback #2: free-text email, label-based regex matching.
function extractFromEmailText(text: string, subject: string) {
  const proposals: any[] = [];
  const push = (fieldName: string, value: string | null, excerpt: string, confidence = 0.45) => {
    if (!value) return;
    proposals.push({ entityType: "accommodations", dayNumber: null, fieldName, value: value.trim(), confidence, sourceExcerpt: excerpt.trim(), source: "heuristic-email" });
  };
  const patterns: [RegExp, string][] = [
    [/confirmation\s*(number|no\.?|#)?\s*[:\-]?\s*([A-Z0-9\-]{4,})/i, "booking_reference"],
    [/check[\s-]?in\s*[:\-]?\s*([A-Za-z0-9,\s]{6,25})/i, "notes"],
    [/total\s*(price|cost|amount)\s*[:\-]?\s*([€£$]?\s?[\d.,]+)/i, "cost"],
    [/(\+?[\d][\d\s\-().]{7,}\d)/, "phone"],
  ];
  for (const [re, field] of patterns) {
    const m = text.match(re);
    if (m) push(field, m[m.length - 1], m[0]);
  }
  // Guess accommodation name from the subject line — weakest signal, lowest confidence.
  if (/confirm|booking|reservation/i.test(subject)) {
    push("name", subject.replace(/your (booking|reservation) (confirmation|is confirmed)/i, "").trim(), subject, 0.35);
  }
  return proposals;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: CORS });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const inboundSecret = Deno.env.get("INBOUND_EMAIL_SECRET");

  // Webhook path: Cloudflare Email Worker sends x-inbound-secret instead of a user JWT.
  const webhookSecret = req.headers.get("x-inbound-secret");
  const isWebhook = inboundSecret && webhookSecret === inboundSecret;

  let body: {
    tripId?: string; kind?: "email" | "document"; filename?: string;
    text?: string; subject?: string;
  };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400, headers: CORS });
  }
  if (!body.tripId || !body.kind || !body.text) {
    return new Response(JSON.stringify({ error: "missing_fields", need: ["tripId", "kind", "text"] }), { status: 400, headers: CORS });
  }

  let client;
  let callerId: string | null = null;
  if (isWebhook) {
    // Service-role client — bypasses RLS; trip ownership already enforced by the
    // email address format (only someone who knows the full UUID can send to it).
    client = createClient(supabaseUrl, serviceKey);
  } else {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "unauthenticated" }), { status: 401, headers: CORS });
    client = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await client.auth.getUser();
    if (userErr || !userData?.user) return new Response(JSON.stringify({ error: "unauthenticated" }), { status: 401, headers: CORS });
    callerId = userData.user.id;
    // Confirm caller is an editor/owner of this trip.
    const { data: isEditor } = await client.schema("app").rpc("is_trip_editor", { p_trip_id: body.tripId });
    if (!isEditor) return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: CORS });
  }

  const { data: importRow, error: importErr } = await client
    .schema("app")
    .from("staged_imports")
    .insert({ trip_id: body.tripId, kind: body.kind, filename: body.filename ?? null, raw_excerpt: body.text.slice(0, 2000), created_by: callerId, status: "pending" })
    .select("id")
    .single();
  if (importErr) return new Response(JSON.stringify({ error: "import_row_failed", detail: importErr.message }), { status: 500, headers: CORS });

  let proposals: any[] = [];
  let usedLLM = false;
  let provider: "groq" | "claude" | "heuristic" = "heuristic";
  const groqKey = Deno.env.get("GROQ_API_KEY");
  const claudeKey = Deno.env.get("ANTHROPIC_API_KEY");
  try {
    if (groqKey) {
      proposals = await extractWithGroq(groqKey, body.text);
      usedLLM = true; provider = "groq";
    } else if (claudeKey) {
      proposals = await extractWithClaude(claudeKey, body.text);
      usedLLM = true; provider = "claude";
    } else if (body.kind === "document") {
      proposals = extractFromCsv(body.text);
    } else {
      proposals = extractFromEmailText(body.text, body.subject ?? "");
    }
  } catch (e) {
    await client.schema("app").from("staged_imports").update({ status: "failed", error: String(e) }).eq("id", importRow.id);
    return new Response(JSON.stringify({ error: "extraction_failed", detail: String(e) }), { status: 500, headers: CORS });
  }

  // Resolve dayNumber -> entity_id where possible (trip_days only; accommodation
  // proposals with no matching day stay entity_id = null, i.e. "new row" for review).
  const { data: days } = await client.schema("app").from("trip_days").select("id, day_number").eq("trip_id", body.tripId);
  const dayIdByNumber: Record<number, string> = {};
  (days ?? []).forEach((d: any) => (dayIdByNumber[d.day_number] = d.id));

  const rows = proposals.map((p) => ({
    trip_id: body.tripId,
    import_id: importRow.id,
    entity_type: p.entityType,
    entity_id: p.entityType === "trip_days" && p.dayNumber ? dayIdByNumber[p.dayNumber] ?? null : null,
    day_number: p.dayNumber ?? null,
    field_name: p.fieldName,
    proposed_value: p.value, // supabase-js serializes this for the jsonb column itself — do not double-encode
    confidence: p.confidence,
    source: usedLLM ? (body.kind === "email" ? "import-email" : "import-document") : (body.kind === "email" ? "import-email" : "import-document"),
    source_excerpt: p.sourceExcerpt,
    source_ref: `${body.kind}:${importRow.id}`,
  }));

  if (rows.length > 0) {
    const { error: changesErr } = await client.schema("app").from("staged_changes").insert(rows);
    if (changesErr) {
      await client.schema("app").from("staged_imports").update({ status: "failed", error: changesErr.message }).eq("id", importRow.id);
      return new Response(JSON.stringify({ error: "staged_changes_failed", detail: changesErr.message }), { status: 500, headers: CORS });
    }
  }

  await client.schema("app").from("staged_imports").update({ status: "processed" }).eq("id", importRow.id);

  return new Response(
    JSON.stringify({ importId: importRow.id, proposalCount: rows.length, usedLLM, provider }),
    { headers: { ...CORS, "content-type": "application/json" } },
  );
});
