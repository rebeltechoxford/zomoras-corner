import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { defaultSettings, messageOf } from './model';
import type { Post, SiteSettings } from './model';
import { resolvePhotos } from './photos';

type BlogState = {
  posts: Post[]; settings: SiteSettings; session: Session | null; isWriter: boolean;
  loading: boolean; error: string; recovery: boolean;
  refresh: () => Promise<void>; logout: () => Promise<void>; finishRecovery: () => void;
};
const BlogContext = createContext<BlogState | null>(null);
export function useBlog() { return useContext(BlogContext)!; }
export function BlogProvider({ children }: { children: ReactNode }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [settings, setSettings] = useState(defaultSettings);
  const [session, setSession] = useState<Session | null>(null);
  const [isWriter, setIsWriter] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [recovery, setRecovery] = useState(false);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++generation.current;
    try {
      const { data: auth, error: authError } = await supabase.auth.getSession();
      if (authError) throw authError;
      const activeSession = auth.session;
      let writer = false;
      if (activeSession) {
        const { data, error: roleError } = await supabase.from('writers').select('email');
        if (roleError) throw roleError;
        writer = !!data?.length;
      }
      const [postResult, settingsResult] = await Promise.all([
        supabase.from('posts').select('*').order('published_at', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }),
        supabase.from('site_settings').select('*').eq('id', 1).single(),
      ]);
      if (postResult.error) throw postResult.error;
      if (settingsResult.error) throw settingsResult.error;
      const resolved = await Promise.all((postResult.data as Post[]).map(async post => ({ ...post, photos: await resolvePhotos(post.photos) })));
      if (current !== generation.current) return;
      setSession(activeSession); setIsWriter(writer); setPosts(resolved); setSettings(settingsResult.data); setError('');
    } catch (e) { if (current === generation.current) setError(messageOf(e)); }
    finally { if (current === generation.current) setLoading(false); }
  }, []);
  useEffect(() => {
    void refresh();
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      if (!next) { setIsWriter(false); setPosts(p => p.filter(post => post.status === 'published')); }
      setTimeout(() => void refresh(), 0);
    });
    const timer = window.setInterval(() => void refresh(), 4 * 60 * 1000);
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    return () => { data.subscription.unsubscribe(); clearInterval(timer); window.removeEventListener('focus', onFocus); generation.current++; };
  }, [refresh]);
  async function logout() {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) throw signOutError;
    setRecovery(false);
  }
  return <BlogContext.Provider value={{ posts, settings, session, isWriter, loading, error, recovery, refresh, logout, finishRecovery: () => setRecovery(false) }}>{children}</BlogContext.Provider>;
}
