export default {
  async email(message, env, ctx) {
    const to = message.to.toLowerCase();
    const match = to.match(/^trip-([0-9a-f-]{36})@/);
    if (!match) return;
    const tripId = match[1];
    const subject = message.headers.get('subject') || '';
    const body = await new Response(message.raw).text();
    await fetch(`${env.SUPABASE_URL}/functions/v1/import-extract`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-inbound-secret': env.INBOUND_EMAIL_SECRET,
      },
      body: JSON.stringify({ tripId, kind: 'email', subject, text: body.slice(0, 20000) }),
    });
  }
};
