import { Icon } from './Icon';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Post } from './model';
import { categories, messageOf, readingTime } from './model';
import { useBlog } from './blog';
import { savePost } from './publishing';
import { uploadPhoto, resolvePhotos } from './photos';
import { supabase, PHOTO_BUCKET } from './supabase';
import { blobData, downloadJson, serializeDraft } from './drafts';
import { StoryContent } from './Story';

export function Editor({ initial, recovered = false, close }: { initial: Post; recovered?: boolean; close: () => void }) {
  const blog = useBlog();
  const [post, setPost] = useState(initial);
  const [busy, setBusy] = useState(false); const [preview, setPreview] = useState(false);
  const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [dirty, setDirty] = useState(recovered || !initial.updated_at);
  const dialog = useRef<HTMLDivElement>(null);
  const opener = useRef(document.activeElement);
  const fileInput = useRef<HTMLInputElement>(null);
  const recoveryKey = `corner.recovery.${blog.session!.user.id}`;
  const previousBody = useRef(document.body.style.overflow);
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const root = document.getElementById('root');
    if (root) root.inert = true;
    return () => {
      document.body.style.overflow = previousBody.current;
      if (root) root.inert = false;
      if (opener.current instanceof HTMLElement) opener.current.focus();
    };
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(recoveryKey, JSON.stringify({ ...post, photos: post.photos.map(({ path, alt, caption }) => ({ path, alt, caption })) }));
        setNotice('Recovery copy saved on this device. Use Save draft to save it online.');
      } catch { setNotice('Device backup is unavailable. Save your draft online or download a copy.'); }
    }, 800);
    return () => clearTimeout(timer);
  }, [post, dirty, recoveryKey]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty || busy) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, busy]);
  useEffect(() => {
    const timer = setInterval(() => { void resolvePhotos(post.photos).then(photos => setPost(p => ({ ...p, photos: p.photos.map(photo => ({ ...photo, url: photos.find(x => x.path === photo.path)?.url || photo.url })) }))).catch(() => {}); }, 4 * 60 * 1000);
    return () => clearInterval(timer);
  }, [post.photos]);
  function change(update: Partial<Post>) { setPost(p => ({ ...p, ...update })); setDirty(true); setError(''); }
  function exit() { if (!busy && (!dirty || window.confirm('Leave this edit? A device recovery copy may be available. Save a draft first to keep it online.'))) close(); }
  async function save(status: Post['status']) {
    if (post.status === 'published' && status === 'draft' && !window.confirm('Move this story back to drafts? It will no longer be visible to visitors.')) return;
    setBusy(true); setError('');
    try {
      const saved = await savePost(post, status);
      setPost({ ...saved, photos: post.photos }); setDirty(false);
      try { localStorage.removeItem(recoveryKey); } catch { /* Online save has already succeeded. */ }
      setNotice(status === 'published' ? 'Published. Your story is now visible to everyone.' : 'Draft saved online. Your words and photos will be here after coffee.');
      await blog.refresh();
    } catch (e) { setError(messageOf(e)); } finally { setBusy(false); }
  }
  async function addPhotos(files: FileList) {
    const list = Array.from(files);
    if (post.photos.length + list.length > 8) { setError('Each story has room for up to 8 photos.'); return; }
    setBusy(true); setError('');
    try {
      // Keep every successful upload even if a later file fails.
      for (const file of list) {
        const photo = await uploadPhoto(file, blog.session!.user.id);
        const [resolved] = await resolvePhotos([photo]);
        setPost(p => ({ ...p, photos: [...p.photos, resolved] })); setDirty(true);
      }
      setNotice('Photos added. Describe each photo below; the first one is your cover. Save the story to keep these changes online.');
    } catch (e) { setError(messageOf(e)); } finally { setBusy(false); }
  }
  async function exportDraft() {
    setBusy(true); setError('');
    try {
      const images = [];
      for (const photo of post.photos) {
        const { data, error } = await supabase.storage.from(PHOTO_BUCKET).download(photo.path);
        if (error) throw error;
        images.push({ data: await blobData(data), alt: photo.alt, caption: photo.caption });
      }
      downloadJson(serializeDraft({ ...post, images }), post.title || 'coffee-break-draft');
      setNotice('Download started. This JSON keeps your words and photos together.');
    } catch (e) { setError(messageOf(e)); } finally { setBusy(false); }
  }
  return createPortal(<div ref={dialog} className="editor-overlay" role="dialog" aria-modal="true" aria-label="Story editor" onKeyDown={event => {
    if (event.key === 'Escape') { event.preventDefault(); exit(); }
    if (event.key !== 'Tab') return;
    const targets = Array.from(dialog.current!.querySelectorAll<HTMLElement>('button, input, textarea, select, a[href], [tabindex="0"]')).filter(el => !el.matches(':disabled') && el.getClientRects().length > 0);
    const first = targets[0], last = targets[targets.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }}><div className="editor-topbar"><button className="quiet-button" onClick={exit} disabled={busy}><Icon name="back"/> Writing desk</button><span className={`status-pill ${post.status}`}>{dirty ? 'Unsaved changes' : post.status === 'published' ? 'Published' : 'Draft'}</span><button className="quiet-button" onClick={() => setPreview(!preview)}>{preview ? <><Icon name="back"/> Keep writing</> : <>Preview <Icon name="outward"/></>}</button></div>
    <div className="editor-shell"><div className="editor-title"><p className="eyebrow">ONE THOUGHT AT A TIME</p><h1>{preview ? 'A reader’s view.' : 'Make a little room for your words.'}</h1></div>
      {error && <p role="alert" className="notice error">{error}</p>}{notice && <p role="status" className="notice">{notice}</p>}
      {preview ? <StoryContent post={post} preview/> : <fieldset className="editor-fields" disabled={busy}><div className="writing-fields">
        <label>Title<input autoFocus maxLength={160} placeholder="What’s on your mind?" value={post.title} onChange={e => change({ title: e.target.value })}/></label>
        <label>A short introduction<textarea maxLength={500} rows={3} placeholder="A small invitation into your story…" value={post.summary} onChange={e => change({ summary: e.target.value })}/><small>{post.summary.length}/500</small></label>
        <label>Your story<textarea className="body-input" maxLength={50000} rows={15} placeholder="Start anywhere. You can always come back after coffee." value={post.body} onChange={e => change({ body: e.target.value })}/><small>{post.body.trim() ? post.body.trim().split(/\s+/).length : 0} words · {readingTime(post.body)} min read · Leave a blank line between paragraphs.</small></label>
      </div><aside className="editor-sidebar"><div className="editor-panel"><p className="eyebrow">FILE IT UNDER</p><label>Category<select value={post.category} onChange={e => change({ category: e.target.value as Post['category'] })}>{categories.map(c => <option key={c}>{c}</option>)}</select></label><p>A home for each little thought.</p></div><div className="editor-panel coffee-panel"><span><Icon name="coffee"/></span><h3>No rush.</h3><p>Save a draft whenever you need a break. Only Publish makes it public.</p><button type="button" className="text-link" onClick={() => void exportDraft()}>Download a backup <Icon name="download"/></button></div></aside>
      <section className="photo-editor"><div className="section-heading"><div><p className="eyebrow">THE LITTLE DETAILS</p><h2>Pictures tell stories, too.</h2></div><button type="button" className="button secondary" onClick={() => fileInput.current?.click()} disabled={post.photos.length >= 8}><Icon name="add"/> Add photos</button></div>
        <input hidden type="file" ref={fileInput} multiple accept="image/jpeg,image/png,image/webp" aria-label="Upload story photos" onChange={e => { if (e.currentTarget.files?.length) void addPhotos(e.currentTarget.files); e.currentTarget.value = ''; }}/>
        <p className="field-hint">Up to 8 photos. JPG, PNG, or WebP; we’ll shrink them for the web. The first photo is the cover. Draft photos stay private.</p>
        {!post.photos.length && <button className="upload-dropzone" type="button" onClick={() => fileInput.current?.click()}><span><Icon name="add"/></span>Add a moment from your camera roll<small>Descriptions and captions come next.</small></button>}
        <div className="photo-edit-grid">{post.photos.map((photo, index) => <div className="photo-edit-card" key={photo.path}><img src={photo.url} alt={photo.alt || 'Uploaded photo preview'}/><span className="status-pill">{index === 0 ? 'Cover photo' : `Photo ${index + 1}`}</span>
          <label>Photo description<input maxLength={300} placeholder="What’s in this picture?" value={photo.alt} onChange={e => change({ photos: post.photos.map((p, i) => i === index ? { ...p, alt: e.target.value } : p) })}/></label>
          <label>Caption <small>(optional)</small><input maxLength={500} value={photo.caption} onChange={e => change({ photos: post.photos.map((p, i) => i === index ? { ...p, caption: e.target.value } : p) })}/></label>
          <div className="row-actions">{index > 0 && <button type="button" className="quiet-button" onClick={() => change({ photos: [photo, ...post.photos.filter((_, i) => i !== index)] })}>Make cover</button>}<button type="button" className="quiet-button danger" onClick={() => change({ photos: post.photos.filter((_, i) => i !== index) })}>Remove photo</button></div>
        </div>)}</div>
      </section></fieldset>}
    </div><div className="editor-savebar"><span>{busy ? 'Taking care of it…' : post.status === 'published' ? 'Changes go live when you update.' : 'Just for you, until you publish.'}</span><div className="row-actions"><button className="button secondary" disabled={busy} onClick={() => void save('draft')}>{post.status === 'published' ? 'Move to drafts' : 'Save draft'}</button><button className="button" disabled={busy} onClick={() => void save('published')}>{post.status === 'published' ? 'Update story' : 'Publish story'} <Icon name="outward"/></button></div></div>
  </div>, document.body);
}
