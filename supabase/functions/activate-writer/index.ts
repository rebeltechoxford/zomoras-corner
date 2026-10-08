import { createClient } from 'npm:@supabase/supabase-js@2.117.3';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const reply = (status: number, data: unknown) => new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

// Custom authentication: a 256-bit, one-time setup secret. No JWT exists before activation.
// The stored hash expires; this endpoint never resets or modifies an existing Auth user.
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return reply(405, { error: 'Use POST.' });
  try {
    if (Number(req.headers.get('content-length') || 0) > 4096) return reply(413, { error: 'Request too large.' });
    const text = await req.text();
    if (text.length > 4096) return reply(413, { error: 'Request too large.' });
    const { code, password } = JSON.parse(text);
    if (typeof code !== 'string' || code.length > 128 || typeof password !== 'string' || password.length < 8 || password.length > 128) return reply(400, { error: 'Enter your setup code and a password of 8–128 characters.' });
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: setup, error: setupError } = await admin.from('writer_setup').select('*').eq('id', 1).maybeSingle();
    if (setupError) return reply(503, { error: 'Setup is temporarily unavailable.' });
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code.trim()));
    const hash = Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
    // Fixed-length comparison, no secret content in logs or responses.
    let difference = 0;
    const expected = setup?.code_hash || '0'.repeat(64);
    for (let i = 0; i < 64; i++) difference |= hash.charCodeAt(i) ^ expected.charCodeAt(i);
    if (!setup || difference !== 0 || Date.parse(setup.expires_at) <= Date.now()) return reply(403, { error: 'That setup code is invalid, expired, or already used.' });
    const { data: writers, error } = await admin.from('writers').select('email');
    if (error || writers?.length !== 1) return reply(503, { error: 'The writer account needs administrator setup.' });
    const { error: createError } = await admin.auth.admin.createUser({ email: writers[0].email, password, email_confirm: true });
    if (createError) return reply(409, { error: 'The writer account could not be created. If it already exists, sign in instead.' });
    await admin.from('writer_setup').delete().eq('id', 1);
    return reply(200, { email: writers[0].email });
  } catch { return reply(400, { error: 'Could not activate the writer account. Check your details and try again.' }); }
});
