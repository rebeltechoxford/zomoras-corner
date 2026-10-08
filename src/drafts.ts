import { categories } from './model';
import type { Category } from './model';
export type ArchivedPhoto = { data: string; alt: string; caption: string };
export type DraftFields = { title: string; summary: string; body: string; category?: Category; images?: ArchivedPhoto[] };

export function serializeDraft(draft: DraftFields) {
  return JSON.stringify({ Title: draft.title, 'A Short Introduction': draft.summary, 'Your Story': draft.body, Category: draft.category || 'Little joys', Photos: draft.images || [] }, null, 2) + '\n';
}
export function parseDraft(text: string): DraftFields {
  let data: unknown;
  try { data = JSON.parse(text.replace(/^\uFEFF/, '')); } catch { throw new Error('This file isn’t valid JSON. Choose a saved draft file.'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Choose a draft with Title, A Short Introduction, and Your Story.');
  const fields = data as Record<string, unknown>;
  const title = fields.Title; const summary = fields['A Short Introduction']; const body = fields['Your Story'];
  if (typeof title !== 'string' || typeof summary !== 'string' || typeof body !== 'string') throw new Error('Title, introduction, and story must be text.');
  if (title.length > 160 || summary.length > 500 || body.length > 50000) throw new Error('This draft exceeds the editor’s text limits.');
  const category = fields.Category || 'Little joys';
  if (!categories.includes(category as Category)) throw new Error('This draft has an unknown category.');
  const images = fields.Photos ?? [];
  if (!Array.isArray(images) || images.length > 8 || images.some(p => !p || typeof p.data !== 'string' || p.data.length > 5 * 1024 * 1024 || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(p.data) || typeof p.alt !== 'string' || p.alt.length > 300 || typeof p.caption !== 'string' || p.caption.length > 500)) throw new Error('This draft has invalid photos. Use up to 8 JPG, PNG, or WebP images.');
  return { title, summary, body, category: category as Category, images };
}
export function downloadJson(text: string, title: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url;
  a.download = `${title.replace(/[^a-z0-9]+/gi, '-').slice(0, 60) || 'untitled'}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const blobData = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Could not read this photo.')); reader.readAsDataURL(blob);
});
