import { useEffect, useState, type ReactNode } from 'react';
import { ThemeContext, type Theme } from './ThemeContext';

// Bumped from 'tpp-theme' when the default flipped from dark to light —
// every visit before that change had already written 'dark' into
// localStorage under the old key (the effect below saves on every mount,
// not just on an explicit toggle), so reusing that key would keep reading
// back 'dark' for anyone who'd ever visited before, masking the new
// default behind a hard refresh forever. A fresh key means everyone gets
// the new default once, while still fully respecting any toggle they make
// afterward (which persists under this same new key going forward).
const STORAGE_KEY = 'tpp-theme-v2';

function getInitialTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // ignore (private browsing, etc.)
  }
  // Default to light for anyone who hasn't picked a preference yet.
  return 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // ignore
    }
  }, [theme]);

  const setTheme = (next: Theme) => setThemeState(next);
  const toggleTheme = () => setThemeState((t) => (t === 'dark' ? 'light' : 'dark'));

  return (
    <ThemeContext value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext>
  );
}
