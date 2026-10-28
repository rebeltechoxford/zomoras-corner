export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function validateSubmission(value) {
  if (!value || typeof value !== 'object') return null;
  const { post_id, challenge_id, answer, website } = value;
  if (!UUID.test(post_id || '') || !UUID.test(challenge_id || '') || typeof answer !== 'string' || !/^\d{1,3}$/.test(answer.trim())) return null;
  if (website !== '' || ['name','email','body'].some(k => typeof value[k] !== 'string')) return null;
  const name = value.name.trim(); const email = value.email.trim().toLowerCase(); const body = value.body.trim();
  if (!name || name.length > 100 || /[\r\n\x00-\x1f\x7f]/.test(name) || !body || body.length > 3000 || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(body)) return null;
  if (email.length > 254 || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(email)) return null;
  // Comments stay plain text. No markup, attachments, or link spam.
  if (/<[^>]*>|https?:\/\/|www\.|data:|\]\(/i.test(body)) return null;
  return { post_id, challenge_id, answer: String(Number(answer)), name, email, body };
}

export async function boundedJson(req, maxBytes = 16000) {
  if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new Error('json');
  const reader = req.body?.getReader(); if (!reader) throw new Error('json');
  const chunks = []; let total = 0;
  for (;;) { const { done, value } = await reader.read(); if (done) break; total += value.byteLength; if (total > maxBytes) { await reader.cancel(); throw new Error('size'); } chunks.push(value); }
  const bytes = new Uint8Array(total); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder().decode(bytes));
}
