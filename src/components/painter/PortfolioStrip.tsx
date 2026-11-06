import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { fetchPainterDetail } from '../../lib/realPainterMatcher';

interface PortfolioImage {
  id: string;
  storage_path: string;
  caption: string;
}

const BUCKET = 'painter-portfolio';
const MAX_IMAGES = 24;
const MAX_BYTES = 8 * 1024 * 1024;

const publicUrl = (path: string) => supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

/** Five stars filled to the rating (4.3 fills four and a bit), for the picture. */
function StarBar({ value }: { value: number }) {
  return (
    <span aria-label={`${value.toFixed(1)} out of 5 stars`} className="relative inline-block leading-none text-[15px] tracking-[1px]">
      <span className="text-white/35">★★★★★</span>
      <span className="absolute left-0 top-0 overflow-hidden whitespace-nowrap text-amber-400" style={{ width: `${Math.max(0, Math.min(5, value)) / 5 * 100}%` }}>★★★★★</span>
    </span>
  );
}

function CameraPlus() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7H7l1.2-2h7.6L17 7h2.5A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5Z" />
      <path d="M12 10v6M9 13h6" />
    </svg>
  );
}

/**
 * The top of the painter's profile, laid out like a listing on a booking site: their portfolio as one big swipeable picture with the company
 * name, rating and place over it, dots along the bottom showing how far through the pictures you are (up to 24), and a small camera + at the
 * bottom left to add photos. A photo can be captioned or removed from the corner buttons.
 */
export default function PortfolioStrip({ companyName, place }: { companyName: string; place: string }) {
  const { user } = useAuth();
  const [painter, setPainter] = useState<{ id: string; status: string } | null>(null);
  const [images, setImages] = useState<PortfolioImage[] | null>(null);
  const [rating, setRating] = useState<{ average: number | null; count: number } | null>(null);
  const [current, setCurrent] = useState(0);
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

  // the same rating customers see on the listing
  useEffect(() => {
    if (!painter?.id) return;
    let off = false;
    fetchPainterDetail(painter.id).then((d) => { if (!off && d) setRating(d.rating); });
    return () => { off = true; };
  }, [painter?.id]);

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

  const count = images?.length ?? 0;
  const here = images?.[Math.min(current, Math.max(0, count - 1))];
  const small = 'w-7 h-7 rounded-full bg-black/55 text-white flex items-center justify-center text-xs backdrop-blur-sm';

  return (
    <section aria-label="Your listing" className="relative overflow-hidden rounded-t-xl bg-black" style={{ aspectRatio: '16 / 10', maxHeight: 360, width: '100%' }}>
      {/* the pictures: swipe or scroll sideways, one at a time */}
      <div
        ref={rail}
        onScroll={(e) => setCurrent(Math.round(e.currentTarget.scrollLeft / Math.max(1, e.currentTarget.clientWidth)))}
        className="flex h-full overflow-x-auto [&::-webkit-scrollbar]:hidden"
        style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}
      >
        {images === null && <div className="shrink-0 w-full h-full flex items-center justify-center text-xs text-white/60">Loading…</div>}
        {images?.length === 0 && (
          <div className="shrink-0 w-full h-full flex flex-col items-center justify-center gap-1 text-white/45" style={{ background: 'var(--bg-page)' }}>
            <svg viewBox="0 0 24 24" width="44" height="44" fill="currentColor" aria-hidden="true">
              <path d="M7 14c-1.66 0-3 1.34-3 3 0 1.31-1.16 2-2 2 .92 1.22 2.49 2 4 2 2.21 0 4-1.79 4-4 0-1.66-1.34-3-3-3zm13.71-9.37l-1.34-1.34a.996.996 0 0 0-1.41 0L9 12.25 11.75 15l8.96-8.96a.996.996 0 0 0 0-1.41z" />
            </svg>
            <span className="text-[11px]">Add photos of finished jobs. They show on your public listing.</span>
          </div>
        )}
        {images?.map((img) => (
          <img key={img.id} src={publicUrl(img.storage_path)} alt={img.caption || 'Portfolio photo'} loading="lazy" className="shrink-0 w-full h-full object-cover" style={{ scrollSnapAlign: 'start' }} />
        ))}
      </div>

      {/* name, rating and place over the picture, like a hotel listing */}
      <div className="absolute inset-x-0 top-0 px-3 pt-2.5 pb-8 pointer-events-none" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.72), rgba(0,0,0,0))' }}>
        <h1 className="text-[17px] font-bold leading-tight text-white drop-shadow" style={{ fontFamily: "'Cabin', sans-serif" }}>{companyName}</h1>
        <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-white/90">
          {rating?.average != null ? (
            <>
              <StarBar value={rating.average} />
              <strong>{rating.average.toFixed(1)}</strong>
              <span className="text-white/70">({rating.count})</span>
            </>
          ) : (
            <span className="text-white/75">{rating ? 'New · no reviews yet' : ' '}</span>
          )}
        </div>
        {place && <p className="text-[11px] text-white/75 leading-tight mt-0.5">{place}</p>}
        {painter && painter.status !== 'approved' && <p className="text-[10px] text-amber-300 mt-0.5">Shown to customers once approved</p>}
      </div>

      {/* this picture's caption and corner buttons */}
      {here && (
        <div className="absolute top-2 right-2 flex gap-1.5">
          <button type="button" aria-label="Edit caption" onClick={() => { setEditingId(here.id); setEditCaption(here.caption); }} className={small}>✎</button>
          <button type="button" aria-label="Remove photo" onClick={() => handleDelete(here)} className={small}>✕</button>
        </div>
      )}
      {here?.caption && editingId !== here.id && (
        <p className="absolute inset-x-12 bottom-6 text-center text-[11px] text-white drop-shadow truncate pointer-events-none">{here.caption}</p>
      )}
      {here && editingId === here.id && (
        <div className="absolute inset-x-0 bottom-0 z-20 flex gap-1 p-2 bg-black/75">
          <input
            value={editCaption}
            maxLength={140}
            autoFocus
            onChange={(e) => setEditCaption(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') saveCaption(here); if (e.key === 'Escape') setEditingId(null); }}
            placeholder="Caption"
            className="flex-1 min-w-0 px-2 py-1 bg-[var(--bg-page)] border border-[var(--input-border)] rounded text-[var(--text-primary)] text-xs focus:outline-none focus:border-[var(--accent)]"
          />
          <button type="button" onClick={() => saveCaption(here)} className="px-2 bg-[var(--accent)] text-[var(--accent-ink)] text-xs rounded font-semibold">OK</button>
        </div>
      )}

      {/* camera + at the bottom left to add photos */}
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading || !painter}
        aria-label={uploading ? 'Uploading photos' : 'Add photos'}
        className="absolute left-2 bottom-2 z-10 w-9 h-9 rounded-full bg-black/60 text-white flex items-center justify-center backdrop-blur-sm disabled:opacity-50"
      >
        {uploading ? <span className="text-[10px]">…</span> : <CameraPlus />}
      </button>
      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />

      {/* dots: how far through the pictures you are */}
      {count > 1 && (
        <div className="absolute inset-x-0 bottom-2.5 flex justify-center gap-1 pointer-events-none" aria-label={`Photo ${Math.min(current, count - 1) + 1} of ${count}`}>
          {images?.map((img, i) => (
            <span key={img.id} className={`rounded-full transition-all ${i === Math.min(current, count - 1) ? 'w-2 h-2 bg-white' : 'w-1.5 h-1.5 bg-white/45'}`} style={{ marginTop: i === Math.min(current, count - 1) ? 0 : 1 }} />
          ))}
        </div>
      )}

      {toast && (
        <p className={`absolute left-1/2 -translate-x-1/2 bottom-12 px-2.5 py-1 rounded-full text-[11px] bg-black/75 ${toast.kind === 'ok' ? 'text-green-300' : 'text-red-300'}`}>{toast.text}</p>
      )}
    </section>
  );
}
