import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { resolveAddress, suggestAddresses, type AddressSuggestion, type PickedAddress } from '../lib/addressAutocomplete';

/**
 * A street address box that suggests real addresses (Google) as you type. Choosing one calls onPick with the street, city, state and ZIP so the
 * rest of the form can fill itself. Typing without choosing works as a plain text box.
 */
export default function AddressField({
  value, onChange, onPick, placeholder = 'Street address', id, className, style, autoComplete = 'street-address',
}: {
  value: string;
  onChange: (text: string) => void;
  onPick: (address: PickedAddress) => void;
  placeholder?: string;
  id?: string;
  className?: string;
  style?: CSSProperties;
  autoComplete?: string;
}) {
  const [items, setItems] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const latest = useRef(0);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => () => window.clearTimeout(timer.current), []);
  // a tap or click anywhere else closes the list
  useEffect(() => {
    const close = (e: Event) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);

  const type = (text: string) => {
    onChange(text);
    window.clearTimeout(timer.current);
    const mine = ++latest.current;
    timer.current = window.setTimeout(async () => {
      const found = await suggestAddresses(text);
      if (mine !== latest.current) return;
      setItems(found);
      setOpen(found.length > 0);
    }, 220);
  };

  const choose = async (s: AddressSuggestion) => {
    setOpen(false);
    setItems([]);
    onChange(s.main);
    const picked = await resolveAddress(s);
    if (picked) { onChange(picked.street); onPick(picked); }
  };

  return (
    <div ref={box} style={{ position: 'relative' }}>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => type(e.target.value)}
        onFocus={() => items.length > 0 && setOpen(true)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={className}
        style={style}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
      />
      {open && items.length > 0 && (
        <ul
          role="listbox"
          style={{
            position: 'absolute', left: 0, right: 0, top: 'calc(100% + 4px)', zIndex: 50, margin: 0, padding: 4, listStyle: 'none',
            background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 10, boxShadow: '0 10px 30px rgba(0,0,0,0.35)', maxHeight: 260, overflowY: 'auto',
          }}
        >
          {items.map((s) => (
            <li key={s.id} role="option" aria-selected={false}>
              <button
                type="button"
                onPointerDown={(e) => { e.preventDefault(); void choose(s); }}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 10px', background: 'transparent', border: 'none', borderRadius: 8, color: 'var(--text-primary)', cursor: 'pointer', font: 'inherit' }}
              >
                <span style={{ fontWeight: 600 }}>{s.main}</span>
                {s.secondary && <span style={{ color: 'var(--text-secondary)', fontSize: '0.85em' }}> {s.secondary}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
