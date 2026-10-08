import { supabase, PHOTO_BUCKET } from './supabase';
import type { Post, SiteSettings } from './model';

export async function savePost(post: Post, status: Post['status']): Promise<Post> {
  if (status === 'published') {
    if (![post.title, post.summary, post.body].every(s => s.trim())) throw new Error('Add a title, introduction, and story before publishing.');
    if (post.photos.some(p => !p.alt.trim())) throw new Error('Add a description for each photo before publishing.');
  }
  const values = {
    id: post.id, slug: post.slug || `${post.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60).replace(/^-|-$/g, '') || 'story'}-${post.id.slice(0, 8)}`,
    title: post.title.trim(), summary: post.summary.trim(), body: post.body.trim(), category: post.category, status,
    photos: post.photos.map(({ path, alt, caption }) => ({ path, alt, caption })),
  };
  const result = post.updated_at
    ? await supabase.from('posts').update(values).eq('id', post.id).eq('updated_at', post.updated_at).select().maybeSingle()
    : await supabase.from('posts').insert(values).select().single();
  if (result.error) throw result.error;
  if (!result.data) throw new Error('This story changed in another window. Download your draft, then reopen the latest version before saving.');
  return result.data as Post;
}
export async function deletePost(post: Post) {
  const { data, error } = await supabase.from('posts').delete().eq('id', post.id).eq('updated_at', post.updated_at).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('This story changed. Reload before deleting it.');
  // Photos can be reused in imported drafts; preserve the files rather than break another story.
}
export async function saveSettings(settings: SiteSettings) {
  if (!settings.title.trim()) throw new Error('Give your corner a name.');
  if (settings.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.email)) throw new Error('Enter a valid public contact email or leave it blank.');
  const { error } = await supabase.from('site_settings').update(settings).eq('id', 1);
  if (error) throw error;
}
export async function cleanUnusedPhotos() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Please sign in again.');
  const { data: posts, error } = await supabase.from('posts').select('photos');
  if (error) throw error;
  const used = new Set(posts.flatMap(p => p.photos.map((photo: { path: string }) => photo.path)));
  const { data: files, error: listError } = await supabase.storage.from(PHOTO_BUCKET).list(user.id, { limit: 1000 });
  if (listError) throw listError;
  const unused = files.filter(f => f.created_at && !used.has(`${user.id}/${f.name}`) && Date.now() - new Date(f.created_at).getTime() > 86400000).map(f => `${user.id}/${f.name}`);
  if (unused.length) { const { error: removeError } = await supabase.storage.from(PHOTO_BUCKET).remove(unused); if (removeError) throw removeError; }
  return unused.length;
}
