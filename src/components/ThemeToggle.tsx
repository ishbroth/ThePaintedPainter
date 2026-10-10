import { useTheme } from '../lib/theme';
import { hapticLight } from '../lib/haptics';

/** Long, thin light/dark toggle bar shown directly under the header on
 * every page — "Light Mode" / switch / "Dark Mode" all on one line. */
const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === 'light';

  // the bar floats over the picture, so the words get a soft halo in the page's own background colour to stay readable
  const halo = isLight
    ? '0 0 3px rgba(255,255,255,0.95), 0 0 7px rgba(255,255,255,0.9), 0 0 12px rgba(255,255,255,0.8)'
    : '0 0 3px rgba(0,0,0,0.95), 0 0 7px rgba(0,0,0,0.9), 0 0 12px rgba(0,0,0,0.8)';

  const handleToggle = () => {
    hapticLight();
    toggleTheme();
  };

  return (
    <div
      style={{
        background: 'transparent',
        padding: '3px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
      }}
    >
      <span
        style={{
          fontSize: '0.7rem',
          letterSpacing: '1px',
          textTransform: 'uppercase',
          fontWeight: 700,
          color: isLight ? 'var(--accent)' : 'var(--text-primary)',
          textShadow: halo,
        }}
      >
        Light Mode
      </span>

      <button
        type="button"
        role="switch"
        aria-checked={!isLight}
        aria-label="Toggle light or dark mode"
        onClick={handleToggle}
        style={{
          position: 'relative',
          width: 68,
          height: 16,
          borderRadius: 3,
          border: '1px solid var(--border-strong)',
          background: isLight ? 'var(--bg-surface-hover)' : 'var(--accent)',
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'background 0.2s ease',
          padding: 0,
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 1,
            left: isLight ? 1 : 45,
            width: 20,
            height: 12,
            borderRadius: 2,
            background: isLight ? 'var(--accent)' : 'var(--bg-page)',
            transition: 'left 0.2s ease',
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          }}
        />
      </button>

      <span
        style={{
          fontSize: '0.7rem',
          letterSpacing: '1px',
          textTransform: 'uppercase',
          fontWeight: 700,
          color: isLight ? 'var(--text-primary)' : 'var(--accent)',
          textShadow: halo,
        }}
      >
        Dark Mode
      </span>
    </div>
  );
};

export default ThemeToggle;
