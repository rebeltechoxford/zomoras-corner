import test from 'node:test';
import assert from 'node:assert/strict';
import {parseQuote,parseVerse,dayInChicago} from '../supabase/functions/daily-inspiration/providers.mjs';
test('feeds reject rate-limit messages and incorrect Bible translations',()=>{
  assert.throws(()=>parseQuote([{q:'Too many requests',a:'ZenQuotes'}],'2026-10-08'));
  assert.throws(()=>parseVerse({votd:{version_id:'KJV'}}));
});
test('NLT feed becomes plain text and uses a trusted source link',()=>{
  const verse=parseVerse({votd:{version_id:'NLT',content:'<b>Example</b> &amp; &#8220;text&#8221;',reference:'Psalm 46:10',year:2026,month:10,day:8,permalink:'https://evil.invalid'}});
  assert.equal(verse.text,'Example & “text”');
  assert.equal(verse.day,'2026-10-08');
  assert.match(verse.url,/^https:\/\/www.biblegateway.com\//);
});
test('daily rollover follows Chicago time',()=>{
  assert.equal(dayInChicago(new Date('2026-10-08T04:59:00Z')),'2026-10-07');
  assert.equal(dayInChicago(new Date('2026-10-08T05:00:00Z')),'2026-10-08');
});
