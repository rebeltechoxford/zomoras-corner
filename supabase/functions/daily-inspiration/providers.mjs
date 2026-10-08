export function dayInChicago(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {timeZone:'America/Chicago', year:'numeric', month:'2-digit', day:'2-digit'}).format(date);
}

export function plainText(value) {
  if (typeof value !== 'string') throw new Error('Expected source text');
  const entities = {amp:'&', lt:'<', gt:'>', quot:'"', apos:"'", nbsp:' ', ldquo:'“', rdquo:'”', lsquo:'‘', rsquo:'’', mdash:'—', ndash:'–', hellip:'…'};
  return value.replace(/<[^>]*>/g, '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
    if (entity[0] !== '#') return entities[entity] || match;
    const number = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2),16) : Number(entity.slice(1));
    return number > 0 && number <= 0x10ffff ? String.fromCodePoint(number) : '';
  }).replace(/\s+/g,' ').trim();
}

function content(value, max) {
  const text = plainText(value);
  if (!text || text.length > max) throw new Error('Invalid source content');
  return text;
}
function day(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) throw new Error('Invalid source date');
  return value;
}
export function parseQuote(data, today) {
  const row = data?.[0];
  if (!row || /zenquotes|too many|rate limit/i.test(`${row.a} ${row.q}`)) throw new Error('Quote provider unavailable');
  return {text:content(row.q,1500),author:content(row.a,160),day:day(row.date || today),url:'https://zenquotes.io/'};
}
export function parseVerse(data) {
  const row = data?.votd;
  if (!row || row.version_id !== 'NLT') throw new Error('Expected NLT scripture');
  const reference = content(row.reference || row.display_ref,160);
  return {text:content(row.content || row.text,5000),reference,version:'NLT',day:day(`${row.year}-${String(row.month).padStart(2,'0')}-${String(row.day).padStart(2,'0')}`),url:`https://www.biblegateway.com/passage/?search=${encodeURIComponent(reference)}&version=NLT`};
}
export async function sourceJson(url) {
  const response = await fetch(url, {signal:AbortSignal.timeout(8000),headers:{Accept:'application/json'}});
  if (!response.ok) throw new Error('Source unavailable');
  const text = await response.text();
  if (text.length > 100000) throw new Error('Source response too large');
  return JSON.parse(text);
}
