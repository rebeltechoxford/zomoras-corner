import { supabase } from './supabase';

export type Comment = { id: string; post_id: string; name: string; body: string; created_at: string; status: 'pending' | 'approved' | 'rejected' };
export type Receipt = Comment & { receipt: string };
const key = 'corner.comment-receipts.v1';
export function readReceipts(): Receipt[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value.filter(r => r && ['id','post_id','name','body','created_at','receipt'].every(k => typeof r[k] === 'string') && Date.parse(r.created_at) > Date.now() - 30 * 86400000).slice(-20) : [];
  } catch { return []; }
}
export function saveReceipts(receipts: Receipt[]) {
  try { localStorage.setItem(key, JSON.stringify(receipts.slice(-20))); return true; } catch { return false; }
}
export async function commentRequest<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('story-comments', { body });
  if (error) {
    let message = 'We couldn’t reach the comment desk. Your words are still here; please try again.';
    try { const detail = await error.context?.json(); if (typeof detail?.error === 'string') message = detail.error; } catch { /* Keep the useful network fallback. */ }
    throw new Error(message);
  }
  return data as T;
}
