import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
import { dayInChicago, parseQuote, parseVerse, sourceJson } from './providers.mjs';

// This public reading endpoint authenticates the project's publishable API key.
// It never accepts URLs, content, dates, or database operations from callers.
const clientKey = 'sb_publishable_So9dItpfMWoiN3MuUe7ANw_UVhcib5y';
const cors = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'GET, POST, OPTIONS'};
function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'public, max-age=60'}});
}
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null,{status:204,headers:cors});
  if (!['GET','POST'].includes(req.method)) return reply({error:'Method not allowed'},405);
  if (req.headers.get('apikey') !== clientKey) return reply({error:'Invalid project key'},401);
  const today = dayInChicago();
  const db = createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  try {
    const {data:cache,error} = await db.from('daily_inspiration').select('*').eq('id',1).single();
    if (error) throw error;
    const payload = () => ({today,quote:cache.quote,verse:cache.verse,retryAt:cache.refresh_after});
    if (cache.quote?.day === today && cache.verse?.day === today) return reply(payload());
    if (Date.parse(cache.refresh_after) > Date.now()) return reply(payload());
    // Claim a refresh across concurrent instances; retries are limited to 15 minutes.
    const retryAt = new Date(Date.now()+15*60*1000).toISOString();
    const {data:lease,error:leaseError} = await db.from('daily_inspiration').update({refresh_after:retryAt}).eq('id',1).eq('refresh_after',cache.refresh_after).select('id').maybeSingle();
    if (leaseError) throw leaseError;
    if (!lease) return reply(payload());
    cache.refresh_after = retryAt;
    const results = await Promise.allSettled([
      cache.quote?.day === today ? Promise.resolve(cache.quote) : sourceJson('https://zenquotes.io/api/today').then(data=>parseQuote(data,today)),
      cache.verse?.day === today ? Promise.resolve(cache.verse) : sourceJson('https://www.biblegateway.com/votd/get/?format=json&version=NLT').then(parseVerse),
    ]);
    for (const [i,key] of ['quote','verse'].entries()) {
      const result = results[i];
      if (result.status === 'fulfilled' && result.value.day <= today && (!cache[key] || result.value.day >= cache[key].day)) cache[key] = result.value;
    }
    const {error:saveError} = await db.from('daily_inspiration').update({quote:cache.quote,verse:cache.verse}).eq('id',1).eq('refresh_after',retryAt);
    if (saveError) throw saveError;
    return reply(payload());
  } catch { return reply({error:'Daily readings are temporarily unavailable.'},503); }
});
