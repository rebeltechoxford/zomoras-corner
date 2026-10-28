import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
import nodemailer from 'npm:nodemailer@10.2.1';
import { boundedJson, UUID, validateSubmission } from './validation.mjs';
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

const url = Deno.env.get('SUPABASE_URL')!;
const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const allowed = new Set(['https://zomoras-corner.com', 'https://www.zomoras-corner.com', 'https://zomoras-corner.zomora.workers.dev', 'https://zomoras-corner.rebeltechoxford.workers.dev']);
const enc = new TextEncoder();
const signingKey = crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
async function hash(value: string) {
  const bytes = await crypto.subtle.sign('HMAC', await signingKey, enc.encode(`zomora-comments-v1:${value}`));
  return Array.from(new Uint8Array(bytes), n => n.toString(16).padStart(2, '0')).join('');
}

// Each notification is claimed durably before contacting SMTP. An uncertain
// SMTP outcome stays "sending" for manual review, never blindly resent.
async function notify(id: string) {
  const { data: contact, error: claimError } = await admin.from('comment_contacts').update({ notification_status: 'sending', notification_attempted_at: new Date().toISOString() })
    .eq('comment_id', id).in('notification_status', ['queued','failed','unconfigured']).select('email').maybeSingle();
  if (claimError || !contact) return;
  const { data: config, error: configError } = await admin.rpc('comment_mail_settings');
  if (configError || !config?.host || !config?.user || !config?.pass || !config?.from) {
    await admin.from('comment_contacts').update({ notification_status: 'unconfigured' }).eq('comment_id', id); return;
  }
  const { data: comment } = await admin.from('story_comments').select('name,body,posts(title)').eq('id', id).single();
  if (!comment) { await admin.from('comment_contacts').update({ notification_status: 'failed' }).eq('comment_id', id); return; }
  const transport = nodemailer.createTransport({ host: config.host, port: 465, secure: true,
    auth: { user: config.user, pass: config.pass }, connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 12000,
    tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true }, disableFileAccess: true, disableUrlAccess: true });
  try {
    // Verification cannot send a message, so a failure here is safe to retry.
    await transport.verify();
  } catch { transport.close(); await admin.from('comment_contacts').update({ notification_status: 'failed' }).eq('comment_id', id); return; }
  try {
    const post = comment.posts as unknown as { title: string };
    const result = await transport.sendMail({
      from: { name: 'Zomora’s Corner', address: config.from }, to: 'zomorasmith1@gmail.com',
      replyTo: { name: comment.name, address: contact.email },
      subject: 'A new comment is waiting in your corner',
      messageId: `<comment-${id}@zomoras-corner.com>`,
      text: `Hello Zomora,\n\n${comment.name} left a comment on “${post?.title || 'your story'}”.\n\n${comment.body}\n\nReply to: ${contact.email}\n\nRead, approve, or decline it at https://zomoras-corner.com/writer\n\nThis comment is private until you approve it. The visitor supplied their email address; it has not been verified.`,
    });
    if (result.accepted?.length) await admin.from('comment_contacts').update({ notification_status: 'sent', notification_sent_at: new Date().toISOString() }).eq('comment_id', id);
    else await admin.from('comment_contacts').update({ notification_status: 'failed' }).eq('comment_id', id);
  } catch (e) {
    // Explicit SMTP rejection is retryable. Timeouts/disconnects after DATA
    // may have accepted the message, so leave those marked uncertain.
    const code = (e as { responseCode?: number })?.responseCode;
    if (typeof code === 'number' && code >= 400) await admin.from('comment_contacts').update({ notification_status: 'failed' }).eq('comment_id', id);
  } finally { transport.close(); }
}

// Public actions deliberately accept visitors without an Auth JWT. Writer-only
// actions validate the bearer JWT with Auth, then the database writer allowlist.
Deno.serve(async req => {
  const origin = req.headers.get('origin') || '';
  const cors = { 'Access-Control-Allow-Origin': allowed.has(origin) ? origin : 'https://zomoras-corner.com', 'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
  const reply = (status: number, data: unknown) => new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  if (origin && !allowed.has(origin)) return reply(403, { error: 'Please leave your comment on Zomora’s Corner.' });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return reply(405, { error: 'Use POST.' });
  let body;
  try { body = await boundedJson(req); } catch { return reply(400, { error: 'Please send a short, text-only comment.' }); }
  if (!body || typeof body !== 'object') return reply(400, { error: 'Invalid request.' });
  try {
    if (body.action === 'notify') {
      const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
      const { data: { user }, error } = await admin.auth.getUser(token);
      if (error || !user?.email) return reply(401, { error: 'Please sign in to the writing desk.' });
      const { data: writer } = await admin.from('writers').select('email').eq('email', user.email.toLowerCase()).maybeSingle();
      if (!writer || !UUID.test(body.id || '')) return reply(403, { error: 'Writer access is required.' });
      await notify(body.id); return reply(200, { ok: true });
    }
    if (body.action === 'status') {
      if (!Array.isArray(body.receipts) || body.receipts.length > 20) return reply(400, { error: 'Too many receipts.' });
      const ids: string[] = [];
      for (const receipt of body.receipts) {
        if (UUID.test(receipt?.id || '') && typeof receipt.receipt === 'string' && receipt.receipt === await hash(`receipt:${receipt.id}`)) ids.push(receipt.id);
      }
      if (!ids.length) return reply(200, { statuses: {} });
      const { data, error } = await admin.from('story_comments').select('id,status').in('id', ids);
      if (error) throw error;
      return reply(200, { statuses: Object.fromEntries(ids.map(id => [id, data?.find(c => c.id === id)?.status || 'removed'])) });
    }
    // Supabase's Cloudflare ingress overwrites CF-Connecting-IP. X-Forwarded-For
    // contains changing internal proxy hops and must not bind the challenge.
    const ip = req.headers.get('cf-connecting-ip')?.trim();
    if (!ip) return reply(503, { error: 'The human check is temporarily unavailable. Please try again shortly.' });
    const ipHash = await hash(`ip:${ip}`);
    if (body.action === 'challenge') {
      const random = crypto.getRandomValues(new Uint32Array(2));
      const a = random[0] % 8 + 2; const b = random[1] % 8 + 2; const id = crypto.randomUUID();
      const { data, error } = await admin.rpc('issue_comment_challenge', { p_id: id, p_ip: ipHash, p_answer: await hash(`answer:${id}:${a+b}`) });
      if (error) throw error;
      if (!data) return reply(429, { error: 'A few too many requests. Please take a coffee break and try again in an hour.' });
      return reply(200, { id, question: `What is ${a} + ${b}?` });
    }
    if (body.action !== 'submit') return reply(400, { error: 'Unknown action.' });
    const input = validateSubmission(body);
    if (!input) return reply(400, { error: 'Please check your name, email, and answer. Comments must be text only, without links or photos, and no more than 3,000 characters.' });
    const { data: result, error } = await admin.rpc('submit_story_comment', {
      p_id: input.challenge_id, p_ip: ipHash, p_answer: await hash(`answer:${input.challenge_id}:${input.answer}`),
      p_post: input.post_id, p_name: input.name, p_email: input.email, p_email_hash: await hash(`email:${input.email}`), p_body: input.body,
    });
    if (error) throw error;
    if (result === 'challenge') return reply(400, { error: 'That answer wasn’t accepted, or the question expired. Get a new question below and try again.' });
    if (result === 'post') return reply(404, { error: 'This story is no longer accepting comments.' });
    if (result === 'limited') return reply(429, { error: 'The comment basket needs a little rest. Please try again tomorrow.' });
    if (result !== 'accepted') throw new Error('Unexpected submission result');
    // Receipt is a secret capability, stored only in the submitting browser.
    // Notify in the background; durable claim prevents duplicate sends on retry.
    EdgeRuntime.waitUntil(notify(input.challenge_id));
    return reply(200, { id: input.challenge_id, receipt: await hash(`receipt:${input.challenge_id}`), created_at: new Date().toISOString() });
  } catch { return reply(503, { error: 'The comment desk is taking a moment. Your words are safe in the form; please try again.' }); }
});
