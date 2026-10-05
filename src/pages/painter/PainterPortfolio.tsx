import { useCallback, useEffect, useRef, useState } from 'react';
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

export default function PainterPortfolio() {
  const { user } = useAuth();
  const [painter, setPainter] = useState<{ id: string; status: string } | null>(null);
  const [images, setImages] = useState<PortfolioImage[] | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCaption, setEditCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const showToast = (text: string, kind: 'ok' | 'error' = 'ok') => {
    setToast({ kind, text });
    setTimeout(() => setToast(null), 4000);
  };

  const load = useCallback(async () => {
    if (!user) return;
    const { data: p } = await supabase.from('painters').select('id, status').eq('user_id', user.id).maybeSingle();
    if (!p) return setImages([]);
    setPainter(p);
    const { data } = await supabase
      .from('painter_portfolio')
      .select('id, storage_path, caption')
      .eq('painter_id', p.id)
      .order('created_at', { ascending: false });
    setImages((data as PortfolioImage[]) ?? []);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0 || !user || !painter) return;
    const current = images?.length ?? 0;
    const room = MAX_IMAGES - current;
    if (room <= 0) return showToast(`You can have up to ${MAX_IMAGES} images. Remove one to add another.`, 'error');

    setUploading(true);
    let added = 0;
    let skipped = 0;
    for (const file of Array.from(files).slice(0, room)) {
      if (!file.type.startsWith('image/') || file.size > MAX_BYTES) {
        skipped++;
        continue;
      }
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type });
      if (uploadError) {
        skipped++;
        continue;
      }
      const { error: insertError } = await supabase.from('painter_portfolio').insert({ painter_id: painter.id, storage_path: path, caption: '' });
      if (insertError) {
        await supabase.storage.from(BUCKET).remove([path]);
        skipped++;
        continue;
      }
      added++;
    }
    if (fileRef.current) fileRef.current.value = '';
    setUploading(false);
    await load();
    if (added > 0 && skipped === 0) showToast(`${added} image${added === 1 ? '' : 's'} added.`);
    else if (added > 0) showToast(`${added} added; ${skipped} skipped (images only, 8 MB max each).`, 'error');
    else showToast('Nothing was uploaded — use image files under 8 MB.', 'error');
  };

  const handleDelete = async (img: PortfolioImage) => {
    const { error } = await supabase.from('painter_portfolio').delete().eq('id', img.id);
    if (error) return showToast('Couldn\'t remove that image. Please try again.', 'error');
    await supabase.storage.from(BUCKET).remove([img.storage_path]);
    setImages((prev) => (prev ?? []).filter((i) => i.id !== img.id));
    showToast('Image removed.');
  };

  const saveCaption = async (img: PortfolioImage) => {
    const caption = editCaption.trim().slice(0, 140);
    const { error } = await supabase.from('painter_portfolio').update({ caption }).eq('id', img.id);
    if (error) return showToast('Couldn\'t save the caption. Please try again.', 'error');
    setImages((prev) => (prev ?? []).map((i) => (i.id === img.id ? { ...i, caption } : i)));
    setEditingId(null);
    showToast('Caption updated.');
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Portfolio</h1>
          <p className="text-[var(--text-secondary)] text-sm mt-1">
            Showcase your best work.{painter && painter.status !== 'approved' && ' Customers will see these once your application is approved.'}
          </p>
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading || !painter}
          className="px-5 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-[var(--accent-ink)] font-semibold rounded-lg transition-colors text-sm"
        >
          {uploading ? 'Uploading…' : '+ Upload images'}
        </button>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
      </div>

      {toast && (
        <div
          className={`px-4 py-3 rounded-lg mb-6 text-sm border ${
            toast.kind === 'ok'
              ? 'bg-[var(--tint-success-bg)] border-[var(--tint-success-border)] text-[var(--success)]'
              : 'bg-[var(--tint-critical-bg)] border-[var(--tint-critical-border)] text-[var(--danger)]'
          }`}
        >
          {toast.text}
        </div>
      )}

      {images === null ? (
        <p className="text-[var(--text-secondary)]">Loading…</p>
      ) : images.length === 0 ? (
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-12 text-center">
          <p className="text-[var(--text-secondary)] text-lg mb-2">No portfolio images yet</p>
          <p className="text-[var(--text-faint)] text-sm">Upload photos of your completed projects to build your portfolio.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {images.map((img) => (
            <div key={img.id} className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl overflow-hidden group">
              <div className="relative">
                <img src={publicUrl(img.storage_path)} alt={img.caption || 'Portfolio image'} className="w-full h-48 object-cover" loading="lazy" />
                <button
                  onClick={() => handleDelete(img)}
                  className="absolute top-2 right-2 w-8 h-8 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center sm:opacity-0 group-hover:opacity-100 transition-opacity text-sm"
                  title="Delete image"
                  aria-label="Delete image"
                >
                  {'✕'}
                </button>
              </div>
              <div className="p-3">
                {editingId === img.id ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editCaption}
                      maxLength={140}
                      onChange={(e) => setEditCaption(e.target.value)}
                      className="flex-1 px-2 py-1 bg-[var(--bg-page)] border border-[var(--input-border)] rounded text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent)]"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveCaption(img);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      autoFocus
                    />
                    <button onClick={() => saveCaption(img)} className="px-3 py-1 bg-[var(--accent)] text-[var(--accent-ink)] text-sm rounded font-semibold">
                      Save
                    </button>
                  </div>
                ) : (
                  <p
                    className="text-sm text-[var(--text-secondary)] cursor-pointer hover:text-[var(--accent)] transition-colors"
                    onClick={() => {
                      setEditingId(img.id);
                      setEditCaption(img.caption);
                    }}
                    title="Click to edit caption"
                  >
                    {img.caption || 'Add a caption…'}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
