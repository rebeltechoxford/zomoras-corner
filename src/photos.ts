import { supabase, PHOTO_BUCKET } from './supabase';
import type { Photo } from './model';

export async function preparePhoto(file: File): Promise<Blob> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPG, PNG, or WebP photo. For iPhone HEIC photos, export a JPEG first.');
  if (file.size > 20 * 1024 * 1024) throw new Error('Please choose a photo smaller than 20 MB.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image(); image.src = url; await image.decode();
    if (image.naturalWidth * image.naturalHeight > 50000000) throw new Error('Please resize this photo below 50 megapixels first.');
    const ratio = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(image.naturalWidth * ratio); canvas.height = Math.round(image.naturalHeight * ratio);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Photo processing is unavailable in this browser.');
    context.fillStyle = '#fffaf0'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', .82));
    if (!blob || blob.size > 3 * 1024 * 1024) throw new Error('Could not shrink this photo enough. Try a smaller image.');
    return blob;
  } catch (error) {
    if (error instanceof DOMException) throw new Error('This photo could not be opened. Try a JPEG exported from your photo library.');
    throw error;
  } finally { URL.revokeObjectURL(url); }
}
export async function uploadPhoto(file: File, userId: string): Promise<Photo> {
  const blob = await preparePhoto(file);
  const path = `${userId}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  return { path, alt: '', caption: '' };
}
export async function resolvePhotos(photos: Photo[]): Promise<Photo[]> {
  if (!photos.length) return [];
  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(photos.map(p => p.path), 600);
  if (error) throw error;
  return photos.map((p, i) => ({ ...p, url: data?.[i]?.signedUrl || undefined }));
}
