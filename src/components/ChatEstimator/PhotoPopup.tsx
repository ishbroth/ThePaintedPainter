import { useEffect, useRef, useState } from 'react';
import { compressImage, MAX_POPUP_PHOTOS } from '../../lib/chatEstimator/photoUpload';

interface Slot {
  file: File;
  url: string;
  caption: string;
}

interface Props {
  onClose: () => void;
  /** Uploads and attaches the photos; rejects (with a message) if something goes wrong. */
  onSubmit: (photos: { file: File; caption: string }[]) => Promise<void>;
}

/** Up to five photos in one go: pick or take each, add a short note if you like, and they are shrunk before upload. */
const PhotoPopup = ({ onClose, onSubmit }: Props) => {
  const [slots, setSlots] = useState<(Slot | null)[]>(() => Array(MAX_POPUP_PHOTOS).fill(null));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const pickingIndex = useRef(0);
  const slotsRef = useRef(slots);
  slotsRef.current = slots;

  // free the preview URLs when the popup goes away
  useEffect(
    () => () => {
      slotsRef.current.forEach((s) => s && URL.revokeObjectURL(s.url));
    },
    [],
  );

  function pick(index: number) {
    pickingIndex.current = index;
    inputRef.current?.click();
  }

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith('image/'));
    e.target.value = '';
    if (files.length === 0) return;
    setError('');
    try {
      const prepared = await Promise.all(files.map((f) => compressImage(f)));
      setSlots((prev) => {
        const next = [...prev];
        // the chosen slot first, then any further photos fill the empty slots after it
        let at = pickingIndex.current;
        for (const file of prepared) {
          while (at < next.length && next[at] && at !== pickingIndex.current) at++;
          if (at >= next.length) break;
          if (next[at]) URL.revokeObjectURL(next[at]!.url);
          next[at] = { file, url: URL.createObjectURL(file), caption: next[at]?.caption ?? '' };
          at++;
        }
        return next;
      });
    } catch {
      setError("That photo couldn't be read. Try a different one?");
    }
  }

  function remove(index: number) {
    setSlots((prev) => {
      const next = [...prev];
      if (next[index]) URL.revokeObjectURL(next[index]!.url);
      next[index] = null;
      return next;
    });
  }

  function setCaption(index: number, caption: string) {
    setSlots((prev) => prev.map((s, i) => (i === index && s ? { ...s, caption } : s)));
  }

  const chosen = slots.filter((s): s is Slot => !!s);

  async function submit() {
    if (chosen.length === 0 || busy) return;
    setBusy(true);
    setError('');
    try {
      await onSubmit(chosen.map((s) => ({ file: s.file, caption: s.caption.trim() })));
    } catch {
      setError("Couldn't upload the photos. Try again?");
      setBusy(false);
    }
  }

  return (
    <div className="chat-photo-modal-overlay" onClick={busy ? undefined : onClose}>
      <div className="chat-photo-modal chat-photo-modal-wide" onClick={(e) => e.stopPropagation()}>
        <h3>{'\u{1F4CE}'} Attach photos</h3>
        <p className="chat-photo-tip">
          Take photos from far away so the whole room or property is in the picture, unless you are showing damage.
        </p>
        <div className="chat-photo-slots">
          {slots.map((slot, i) => (
            <div key={i} className="chat-photo-slot">
              {slot ? (
                <>
                  <div className="chat-photo-slot-frame">
                    <img src={slot.url} alt={`Photo ${i + 1}`} />
                    <button type="button" className="chat-photo-slot-remove" onClick={() => remove(i)} aria-label={`Remove photo ${i + 1}`} disabled={busy}>
                      ×
                    </button>
                  </div>
                  <input
                    className="chat-photo-slot-caption"
                    value={slot.caption}
                    onChange={(e) => setCaption(i, e.target.value)}
                    placeholder="Note (optional)"
                    maxLength={120}
                    disabled={busy}
                  />
                </>
              ) : (
                <button type="button" className="chat-photo-slot-empty" onClick={() => pick(i)} disabled={busy}>
                  <span aria-hidden="true">+</span>
                  <span>Photo {i + 1}</span>
                </button>
              )}
            </div>
          ))}
        </div>
        <p className="chat-photo-fine">Up to {MAX_POPUP_PHOTOS} photos. They are shrunk automatically before they upload.</p>
        <input ref={inputRef} type="file" accept="image/*" multiple onChange={onFiles} style={{ display: 'none' }} />
        {error && <p className="chat-photo-error">{error}</p>}
        <div className="chat-photo-modal-actions">
          <button type="button" className="chat-photo-cancel" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="chat-photo-submit" onClick={submit} disabled={busy || chosen.length === 0}>
            {busy ? 'Uploading…' : chosen.length > 1 ? `Attach ${chosen.length} photos` : 'Attach photo'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PhotoPopup;
