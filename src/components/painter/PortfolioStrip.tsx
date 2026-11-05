import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';

interface PortfolioImage {
  id: string;
  storage_path: string;
  caption: string;
}

const BUCKET = 'painter-portfolio';
const MAX_IMAGES = 24;
const MAX_BYTES = 8 * 1024 * 1024;

const publicUrl = (path: string) => supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

/**
 * The painter's portfolio as a carousel at the top of their profile: swipe through it, add photos with the first tile, remove one with its ✕,
 * tap a caption to change it. (What the Portfolio page did, in one row.)
 */
export default function PortfolioStrip() {
  const { user } = useAuth();
  const [painter, setPainter] = useState<{ id: string; status: string } | null>(null);
  const [images, setImages] = useState<PortfolioImage[] | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCaption, setEditCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const rail = useRef<HTMLDivElement>(null);

  const showToast = (text: string, kind: 'ok' | 'error' = 'ok') => {
    setToast({ kind, text });
    window.setTimeout(() => setToast(null), 3500);
  };

  // bumped to load the portfolio again after photos are added
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!user) return;
    let off = false;
    (async () => {
      const { data: p } = await supabase.from('painters').select('id, status').eq('user_id', user.id).maybeSingle();
      if (off) return;
      if (!p) return setImages([]);
      setPainter(p);
      const { data } = await supabase.from('painter_portfolio').select('id, storage_path, caption').eq('painter_id', p.id).order('created_at', { ascending: false });
      if (!off) setImages((data as PortfolioImage[]) ?? []);
    })();
    return () => { off = true; };
  }, [user, reload]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0 || !user || !painter) return;
    const room = MAX_IMAGES - (images?.length ?? 0);
    if (room <= 0) return showToast(`Up to ${MAX_IMAGES} photos. Remove one to add another.`, 'error');
    setUploading(true);
    let added = 0;
    let skipped = 0;
    for (const file of Array.from(files).slice(0, room)) {
      if (!file.type.startsWith('image/') || file.size > MAX_BYTES) { skipped++; continue; }
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type });
      if (uploadError) { skipped++; continue; }
      const { error: insertError } = await supabase.from('painter_portfolio').insert({ painter_id: painter.id, storage_path: path, caption: '' });
      if (insertError) { await supabase.storage.from(BUCKET).remove([path]); skipped++; continue; }
      added++;
    }
    if (fileRef.current) fileRef.current.value = '';
    setUploading(false);
    setReload((n) => n + 1);
    rail.current?.scrollTo({ left: 0, behavior: 'smooth' });
    if (added > 0 && skipped === 0) showToast(`${added} photo${added === 1 ? '' : 's'} added.`);
    else if (added > 0) showToast(`${added} added, ${skipped} skipped (images under 8 MB only).`, 'error');
    else showToast('Nothing uploaded: use image files under 8 MB.', 'error');
  };

  const handleDelete = async (img: PortfolioImage) => {
    const { error } = await supabase.from('painter_portfolio').delete().eq('id', img.id);
    if (error) return showToast('Couldn\'t remove that photo.', 'error');
    await supabase.storage.from(BUCKET).remove([img.storage_path]);
    setImages((prev) => (prev ?? []).filter((i) => i.id !== img.id));
  };

  const saveCaption = async (img: PortfolioImage) => {
    const caption = editCaption.trim().slice(0, 140);
    const { error } = await supabase.from('painter_portfolio').update({ caption }).eq('id', img.id);
    if (error) return showToast('Couldn\'t save the caption.', 'error');
    setImages((prev) => (prev ?? []).map((i) => (i.id === img.id ? { ...i, caption } : i)));
    setEditingId(null);
  };

  const scrollBy = (dir: number) => rail.current?.scrollBy({ left: dir * (rail.current.clientWidth * 0.7), behavior: 'smooth' });
  const arrow = 'hidden sm:flex absolute top-1/2 -translate-y-1/2 z-10 w-8 h-8 items-center justify-center rounded-full bg-black/60 text-white text-lg';

  return (
    <section aria-label="Portfolio">
      <div className="flex items-baseline justify-between mb-1.5">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Portfolio</h2>
        <span className="text-[11px] text-[var(--text-faint)]">
          {images ? `${images.length} photo${images.length === 1 ? '' : 's'}` : ''}
          {painter && painter.status !== 'approved' ? ' · shown to customers once approved' : ''}
        </span>
      </div>

      <div className="relative">
        <button type="button" className={`${arrow} left-1`} aria-label="Scroll left" onClick={() => scrollBy(-1)}>‹</button>
        <button type="button" className={`${arrow} right-1`} aria-label="Scroll right" onClick={() => scrollBy(1)}>›</button>
        <div
          ref={rail}
          className="flex gap-2 overflow-x-auto pb-2"
          style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}
        >
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading || !painter}
            className="shrink-0 w-28 h-36 rounded-xl border-2 border-dashed border-[var(--border-strong)] text-[var(--text-secondary)] flex flex-col items-center justify-center gap-1 disabled:opacity-50"
            style={{ scrollSnapAlign: 'start' }}
          >
            <span className="text-2xl leading-none text-[var(--accent)]">+</span>
            <span className="text-xs">{uploading ? 'Uploading…' : 'Add photos'}</span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />

          {images === null && <p className="text-xs text-[var(--text-faint)] self-center px-2">Loading…</p>}
          {images?.map((img) => (
            <figure key={img.id} className="shrink-0 w-[62%] sm:w-56 m-0 relative" style={{ scrollSnapAlign: 'start' }}>
              <img src={publicUrl(img.storage_path)} alt={img.caption || 'Portfolio photo'} loading="lazy" className="w-full h-36 object-cover rounded-xl border border-[var(--border)]" />
              <button
                type="button"
                onClick={() => handleDelete(img)}
                aria-label="Remove photo"
                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/65 text-white text-xs flex items-center justify-center"
              >
                {'✕'}
              </button>
              {editingId === img.id ? (
                <div className="flex gap-1 mt-1">
                  <input
                    value={editCaption}
                    maxLength={140}
                    autoFocus
                    onChange={(e) => setEditCaption(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveCaption(img); if (e.key === 'Escape') setEditingId(null); }}
                    className="flex-1 min-w-0 px-2 py-1 bg-[var(--bg-page)] border border-[var(--input-border)] rounded text-[var(--text-primary)] text-xs focus:outline-none focus:border-[var(--accent)]"
                  />
                  <button type="button" onClick={() => saveCaption(img)} className="px-2 bg-[var(--accent)] text-[var(--accent-ink)] text-xs rounded font-semibold">OK</button>
                </div>
              ) : (
                <figcaption
                  className="mt-1 text-xs text-[var(--text-secondary)] truncate cursor-pointer"
                  onClick={() => { setEditingId(img.id); setEditCaption(img.caption); }}
                  title="Tap to edit caption"
                >
                  {img.caption || 'Add a caption…'}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      </div>

      {images && images.length === 0 && (
        <p className="text-xs text-[var(--text-faint)]">Add photos of finished jobs. They show on your public listing.</p>
      )}
      {toast && <p className={`text-xs mt-1 ${toast.kind === 'ok' ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>{toast.text}</p>}
    </section>
  );
}
