import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { dashboardPathForRole } from '../lib/auth/roleRoutes.ts';
import { faceIdName, onFaceIdOffer, saveFaceId, savedFaceIds, type FaceIdOffer, type SavedAccount } from '../lib/faceid';
import { useFaceIdSignIn } from '../lib/faceidSignIn';
import { isNativeApp } from '../lib/platform';

const roleName = (role: SavedAccount['role']): string => (role === 'painter' ? 'Painter' : role === 'customer' ? 'Customer' : 'Admin');

const backdrop = 'fixed inset-0 z-[3000] bg-black/60 flex items-center justify-center p-4';
const card = 'w-full max-w-[380px] bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl shadow-lg p-5 text-[var(--text-primary)]';
const primary = 'w-full py-2.5 px-4 bg-[var(--accent-blue)] hover:bg-[var(--accent-blue-hover)] disabled:opacity-50 text-[var(--accent-blue-ink)] font-semibold rounded-lg';
const ghost = 'w-full py-2.5 px-4 border border-[var(--border-strong)] text-[var(--text-secondary)] rounded-lg disabled:opacity-50';

/**
 * In the app only. Two things: (1) after a sign-in with a password, "Use Face ID next time?"; (2) when the app opens signed out and an account was saved that way,
 * the phone's check starts at once. With one saved account that is all; with a customer and a painter account (or any two) saved on this phone, they are asked
 * which one first.
 */
export default function FaceIdPrompt() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const faceSignIn = useFaceIdSignIn();
  const [offer, setOffer] = useState<(FaceIdOffer & { name: string }) | null>(null);
  const [gate, setGate] = useState<{ accounts: SavedAccount[]; name: string; note?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const tried = useRef(false);

  useEffect(() => onFaceIdOffer((o) => {
    if (savedFaceIds().some((a) => a.email === o.email.trim().toLowerCase())) return;
    void faceIdName().then((name) => { if (name) setOffer({ ...o, name }); });
  }), []);

  const signInTo = async (account: SavedAccount, name: string, accounts: SavedAccount[]) => {
    setBusy(true);
    const result = await faceSignIn(account);
    setBusy(false);
    if (result.ok) {
      setGate(null);
      if (pathname === '/') navigate(dashboardPathForRole(account.role)); // a link that opened the app on some other page stays there
    } else if (result.cancelled) setGate(null);
    else setGate({ accounts, name, note: result.message });
  };

  // opening the app signed out, with something saved: the check starts by itself (once per time the app opens)
  useEffect(() => {
    if (tried.current || !isNativeApp() || loading || user) return;
    tried.current = true;
    const accounts = savedFaceIds();
    if (accounts.length === 0) return;
    void faceIdName().then((name) => {
      if (!name) return;
      if (accounts.length === 1) void signInTo(accounts[0], name, accounts);
      else setGate({ accounts, name });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user]);

  if (offer) {
    const yes = async () => {
      setBusy(true);
      await saveFaceId(offer.email, offer.password, offer.role);
      setOffer(null);
      setBusy(false);
    };
    return (
      <div className={backdrop} role="dialog" aria-modal="true" aria-label={`Use ${offer.name} next time`} onClick={() => setOffer(null)}>
        <div className={card} onClick={(e) => e.stopPropagation()}>
          <h2 className="text-lg font-bold mb-2">Use {offer.name} next time?</h2>
          <p className="text-sm text-[var(--text-secondary)] mb-4">
            Sign in to your {roleName(offer.role).toLowerCase()} account with {offer.name} instead of typing your email and password. It is saved only on this phone, locked behind {offer.name}.
          </p>
          <div className="space-y-2">
            <button type="button" className={primary} disabled={busy} onClick={() => void yes()}>{busy ? 'Saving…' : `Use ${offer.name}`}</button>
            <button type="button" className={ghost} disabled={busy} onClick={() => setOffer(null)}>Not now</button>
          </div>
        </div>
      </div>
    );
  }

  if (gate && !user) {
    return (
      <div className={backdrop} role="dialog" aria-modal="true" aria-label="Sign in with biometrics" onClick={() => setGate(null)}>
        <div className={card} onClick={(e) => e.stopPropagation()}>
          <h2 className="text-lg font-bold mb-2">Sign in with {gate.name}</h2>
          <p className="text-sm text-[var(--text-secondary)] mb-3">{gate.accounts.length > 1 ? 'Which account?' : gate.accounts[0].email}</p>
          {gate.note && <p className="text-sm text-[var(--danger)] mb-3">{gate.note}</p>}
          <div className="space-y-2">
            {gate.accounts.map((a) => (
              <button key={a.email} type="button" className={primary} disabled={busy} onClick={() => void signInTo(a, gate.name, gate.accounts)}>
                {roleName(a.role)} · {a.email}
              </button>
            ))}
            <button type="button" className={ghost} disabled={busy} onClick={() => setGate(null)}>Not now</button>
          </div>
        </div>
      </div>
    );
  }
  return null;
}
