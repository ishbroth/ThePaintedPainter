import { useState } from 'react';
import { hapticLight } from '../lib/haptics';

/** Floating cartoon-style chat bubble — a small persistent icon in the
 * corner rather than a full inline page section, so it doesn't compete
 * with the actual page content. Expands into a lightweight preview panel
 * on click; the assistant itself is still "coming soon". */
const AssistantBubble = () => {
  const [open, setOpen] = useState(false);

  const toggle = () => {
    hapticLight();
    setOpen((o) => !o);
  };

  return (
    <div style={{ position: 'fixed', right: 20, bottom: 20, zIndex: 1000 }}>
      {open && (
        <div
          style={{
            position: 'absolute',
            bottom: 72,
            right: 0,
            width: 280,
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 16,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            overflow: 'hidden',
          }}
        >
          <div style={{ background: 'var(--bg-chrome)', padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} />
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-faint)' }}>Painted Painter Assistant</span>
          </div>
          <div style={{ padding: 16 }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-faint)', lineHeight: 1.5, margin: 0 }}>
              Hi! I'm the Painted Painter assistant — chat support is coming soon. For now, check the FAQ above or
              reach out to the contact info on this page.
            </p>
          </div>
        </div>
      )}

      <button
        onClick={toggle}
        aria-label="Painted Painter assistant"
        style={{
          width: 60,
          height: 60,
          borderRadius: '50%',
          border: 'none',
          background: 'var(--accent)',
          boxShadow: '0 4px 14px rgba(0,0,0,0.35)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.9rem',
          lineHeight: 1,
        }}
      >
        {open ? '✕' : '🖌️'}
      </button>
    </div>
  );
};

export default AssistantBubble;
