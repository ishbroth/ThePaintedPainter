import { Link } from 'react-router-dom';
import type { CSSProperties } from 'react';

/** Lets someone on either sign-in page switch to the other — painters have
 * no other discoverable way to reach their sign-in page (the header's "Sign
 * In" link only points at the customer one). */
export default function SignInRoleToggle({ active }: { active: 'customer' | 'painter' }) {
  const tabStyle = (isActive: boolean): CSSProperties => ({
    flex: 1,
    textAlign: 'center',
    padding: '8px 0',
    fontSize: '0.85rem',
    fontWeight: 600,
    textDecoration: 'none',
    borderBottom: isActive ? '2px solid var(--accent-blue)' : '2px solid var(--border-strong)',
    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
  });

  return (
    <div
      className="flex mb-6"
      style={{
        display: 'flex',
        background: 'color-mix(in srgb, var(--accent-blue) 12%, transparent)',
        borderRadius: 10,
        padding: 4,
      }}
    >
      <Link to="/auth/customer-sign-in" style={tabStyle(active === 'customer')}>
        Customer
      </Link>
      <Link to="/auth/painter-sign-in" style={tabStyle(active === 'painter')}>
        Painter
      </Link>
    </div>
  );
}
