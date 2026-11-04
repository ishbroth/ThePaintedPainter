import { useEffect, useState } from 'react';
import { chooseAppVoice, listEnglishVoices, previewVoice, type VoiceChoice } from '../../lib/textToSpeech';

/** The app's voice picker: the English voices on this phone, each with a sample, so the best-sounding one can be chosen. */
export default function VoicePicker({ onClose }: { onClose: () => void }) {
  const [voices, setVoices] = useState<VoiceChoice[]>(() => listEnglishVoices());
  useEffect(() => {
    const refresh = () => setVoices(listEnglishVoices());
    window.speechSynthesis?.addEventListener?.('voiceschanged', refresh);
    const t = window.setTimeout(refresh, 600);
    return () => { window.speechSynthesis?.removeEventListener?.('voiceschanged', refresh); window.clearTimeout(t); window.speechSynthesis?.cancel(); };
  }, []);
  const anyChosen = voices.some((v) => v.chosen);
  const pick = (name: string | null) => { chooseAppVoice(name); setVoices(listEnglishVoices()); };
  return (
    <div role="dialog" aria-label="Choose a voice" onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', borderRadius: 14, width: 'min(440px, 100%)', maxHeight: '86vh', overflowY: 'auto', padding: 20 }}>
        <h2 style={{ margin: '0 0 6px', fontSize: '1.2rem' }}>Choose a voice</h2>
        <p style={{ margin: '0 0 12px', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
          These are the voices on your phone. For a more natural one, download an <b>Enhanced</b> or <b>Premium</b> voice in Settings &gt; Accessibility &gt; Spoken Content &gt; Voices &gt; English, then come back here: it appears in the list.
        </p>
        <button type="button" onClick={() => pick(null)} style={{ ...row, borderColor: !anyChosen ? 'var(--accent)' : 'var(--border-strong)' }}>
          <span><b>Automatic</b> <span style={{ color: 'var(--text-secondary)' }}>(the best the phone has)</span></span>
          {!anyChosen && <span aria-label="In use">✓</span>}
        </button>
        {voices.length === 0 && <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>No English voices found yet.</p>}
        {voices.map((v) => (
          <div key={v.name} style={{ ...row, borderColor: v.chosen ? 'var(--accent)' : 'var(--border-strong)', cursor: 'default' }}>
            <span style={{ minWidth: 0 }}>
              <b>{v.name.replace(/\s*\((?:Premium|Enhanced)\)/i, '')}</b>{' '}
              <span style={{ color: v.quality === 'Standard' ? 'var(--text-secondary)' : 'var(--accent)', fontSize: '0.8rem' }}>{v.quality}</span>
              <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{v.lang}{v.automatic && !anyChosen ? ' · in use' : ''}</span>
            </span>
            <span style={{ display: 'flex', gap: 6, flex: 'none' }}>
              <button type="button" onClick={() => previewVoice(v.name)} style={small}>Listen</button>
              <button type="button" onClick={() => pick(v.name)} style={{ ...small, background: v.chosen ? 'var(--accent)' : 'transparent', color: v.chosen ? 'var(--accent-ink)' : 'var(--text-primary)' }}>{v.chosen ? 'Using' : 'Use'}</button>
            </span>
          </div>
        ))}
        <button type="button" onClick={onClose} style={{ marginTop: 14, padding: '10px 16px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: 'var(--accent-ink)', fontWeight: 700, cursor: 'pointer' }}>Done</button>
      </div>
    </div>
  );
}

const row: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, width: '100%', textAlign: 'left', padding: '10px 12px', marginBottom: 8, borderRadius: 10, border: '1px solid var(--border-strong)', background: 'transparent', color: 'var(--text-primary)', font: 'inherit', cursor: 'pointer' };
const small: React.CSSProperties = { padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'transparent', color: 'var(--text-primary)', font: 'inherit', fontSize: '0.85rem', cursor: 'pointer' };
