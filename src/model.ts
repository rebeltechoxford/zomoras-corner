export const categories = ['Little joys', 'Slow mornings', 'Life lately', 'Notes to self'] as const;
export type Category = typeof categories[number];
export type Photo = { path: string; alt: string; caption: string; url?: string };
export type Post = {
  id: string; slug: string; title: string; summary: string; body: string;
  category: Category; status: 'draft' | 'published'; photos: Photo[];
  created_at: string; updated_at: string; published_at: string | null;
};
export type SiteSettings = { id: number; title: string; tagline: string; about: string; email: string; instagram: string };
export const defaultSettings: SiteSettings = {
  id: 1, title: 'Zomora’s Corner', tagline: 'Little joys. Honest stories. Room to breathe.',
  about: 'A little corner for everyday stories, slow mornings, and the good things tucked into ordinary days.\n\nCome for a story. Stay for a moment. There is no rush here.',
  email: '', instagram: '',
};
export function emptyPost(): Post {
  return { id: crypto.randomUUID(), slug: '', title: '', summary: '', body: '', category: 'Little joys', status: 'draft', photos: [], created_at: '', updated_at: '', published_at: null };
}
export const readingTime = (body: string) => Math.max(1, Math.ceil(body.trim().split(/\s+/).length / 200));
export const formatDate = (value: string | null) => value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unpublished';
export const messageOf = (error: unknown) => error && typeof error === 'object' && 'message' in error ? String(error.message) : 'Something went wrong. Please try again.';
