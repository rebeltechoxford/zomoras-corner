import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { Icon } from './Icon';

type Reading = { text: string; day: string; author?: string; reference?: string; version?: string };
type Readings = { quote: Reading | null; verse: Reading | null; retryAt?: string };
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const label = (reading: Reading | null, day: string) => reading && reading.day !== day ? `Saved reading · ${reading.day}` : 'A fresh page, every day';

export function DailyInspiration() {
  const [readings, setReadings] = useState<Readings>({ quote: null, verse: null });
  const [day, setDay] = useState(today);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let stopped = false;
    let cached: Readings | null = null;
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      const currentDay = today();
      setDay(currentDay);
      if (cached?.quote?.day === currentDay && cached?.verse?.day === currentDay) {
        timer = setTimeout(refresh, 15 * 60 * 1000);
        return;
      }
      const { data, error } = await supabase.functions.invoke('daily-inspiration');
      if (stopped) return;
      setLoading(false);
      if (!error && data) { cached = data; setReadings(data); }
      // Daily feeds are shared and cached on the server. Recheck at most every
      // 15 minutes so an open tab also picks up the next Chicago calendar day.
      timer = setTimeout(refresh, 15 * 60 * 1000);
    }
    void refresh();
    return () => { stopped = true; clearTimeout(timer); };
  }, []);
  const { quote, verse } = readings;
  return <div className="daily-readings" aria-label="Daily inspiration">
    <article className="daily-reading"><p className="eyebrow"><Icon name="sun"/> A LITTLE ENCOURAGEMENT</p>
      {quote ? <><blockquote>“{quote.text}”</blockquote><p className="reading-author">— {quote.author}</p></> : <p className="reading-placeholder">{loading ? 'Finding a little encouragement…' : 'Take a breath. Today’s quote will be back soon.'}</p>}
      <div className="reading-source"><span>{label(quote, day)}</span><a href="https://zenquotes.io/" target="_blank" rel="noreferrer">Inspirational quotes provided by ZenQuotes API</a></div>
    </article>
    <article className="daily-reading"><p className="eyebrow"><Icon name="flower"/> A MOMENT IN THE WORD</p>
      {verse ? <><blockquote>{verse.text}</blockquote><p className="reading-author"><a href={`https://www.biblegateway.com/passage/?search=${encodeURIComponent(verse.reference || '')}&version=NLT`} target="_blank" rel="noreferrer">{verse.reference} · NLT <Icon name="outward"/></a></p></> : <p className="reading-placeholder">{loading ? 'Opening today’s verse…' : 'Today’s NLT verse is taking a little longer. Visit Bible Gateway to read along.'}</p>}
      <div className="reading-source"><span>{label(verse, day)}</span><a href="https://www.biblegateway.com/" target="_blank" rel="noreferrer">Powered by BibleGateway.com</a></div>
      <p className="reading-source"><a href="https://www.biblegateway.com/versions/New-Living-Translation-NLT-Bible/#copy" target="_blank" rel="noreferrer">NLT © 1996, 2004, 2015 Tyndale House Foundation. All rights reserved.</a></p>
    </article>
  </div>;
}
