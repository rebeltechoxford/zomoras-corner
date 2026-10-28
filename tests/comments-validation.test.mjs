import test from 'node:test';
import assert from 'node:assert/strict';
import { boundedJson, validateSubmission } from '../supabase/functions/story-comments/validation.mjs';
const good = { action:'submit', post_id:'10000000-0000-4000-8000-000000000001', challenge_id:'20000000-0000-4000-8000-000000000001', name:'  A reader ', email:'READER@example.com', body:'A kind word.\nThank you!', website:'', answer:'08' };
test('normalizes a plain-text comment without interpreting it as HTML', () => {
  assert.deepEqual(validateSubmission(good), { post_id:good.post_id, challenge_id:good.challenge_id, name:'A reader', email:'reader@example.com', body:good.body, answer:'8' });
});
test('rejects markup, photo payloads, link spam, header injection, honeypots and oversize input', () => {
  for (const patch of [{ body:'<img src=x onerror=alert(1)>' },{body:'https://spam.invalid'},{body:'![photo](url)'},{body:'data:image/jpeg;base64,AAAA'},{body:'x'.repeat(3001)},{body:' '},{email:'x@example.com\r\nBcc: victim@example.com'},{email:'x@example.com?subject=spam'},{name:'x\r\nHeader:evil'},{website:'spam'},{post_id:'not-a-uuid'},{answer:'eight'},{body:['array']},{name:{}}]) assert.equal(validateSubmission({...good,...patch}), null, JSON.stringify(patch));
});
test('caps request bytes even with missing or misleading content-length', async () => {
  await assert.rejects(boundedJson(new Request('https://example.com', {method:'POST',headers:{'content-type':'application/json','content-length':'1'},body:JSON.stringify({body:'x'.repeat(17000)})})));
  await assert.rejects(boundedJson(new Request('https://example.com', {method:'POST',headers:{'content-type':'text/plain'},body:'{}'})));
  assert.deepEqual(await boundedJson(new Request('https://example.com', {method:'POST',headers:{'content-type':'application/json'},body:'{"action":"challenge"}'})), {action:'challenge'});
});
