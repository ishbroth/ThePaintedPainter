import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { hapticLight, hapticMedium } from '../lib/haptics';

const Header = () => {
  const { user, profile, loading, signOut } = useAuth();
  const navigate = useNavigate();

  const closeMenu = () => {
    hapticLight();
  };

  const dashboardPath = profile?.role === 'painter'
    ? '/painter/dashboard'
    : '/customer/dashboard';

  // The two links that depend on who is signed in. A painter has no use for the estimator, so it becomes their dashboard, and "For Painters" becomes
  // their projects; a customer keeps the estimator and gets their own projects in place of "For Painters". While we do not yet know whose account it is,
  // neither is shown (so the wrong ones never flash).
  const isPainter = profile?.role === 'painter';
  const isCustomer = profile?.role === 'customer';
  const unknown = loading || (!!user && !profile);

  const displayName = profile?.display_name || (profile?.role === 'painter' ? 'Painter Dashboard' : 'My Dashboard');

  const handleSignOut = async () => {
    hapticMedium();
    closeMenu();
    await signOut();
    navigate('/');
  };

  return (
    <header className="header">
      <div className="header-container">
        <nav className="nav" id="nav">
          {!unknown && (isPainter ? (
            <Link to="/painter/dashboard" onClick={closeMenu}>
              Dashboard
            </Link>
          ) : (
            <Link to="/#estimator" onClick={closeMenu}>
              Get Your Price
            </Link>
          ))}
          {!unknown && (isPainter ? (
            <Link to="/painter/dashboard/projects" onClick={closeMenu}>
              My Projects
            </Link>
          ) : isCustomer ? (
            <Link to="/customer/dashboard/projects" onClick={closeMenu}>
              My Projects
            </Link>
          ) : (
            <Link to="/painter-signup" onClick={closeMenu}>
              For Painters
            </Link>
          ))}
          <Link to="/support" onClick={closeMenu}>
            Support
          </Link>
          {user ? (
            <>
              <Link to={dashboardPath} onClick={closeMenu} className="nav-cta">
                {displayName}
              </Link>
              <button
                onClick={handleSignOut}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--input-border)',
                  color: 'var(--text-faint)',
                  padding: '6px 14px',
                  fontSize: '0.75rem',
                  letterSpacing: '1.5px',
                  textTransform: 'uppercase' as const,
                  cursor: 'pointer',
                  borderRadius: '4px',
                  fontFamily: 'inherit',
                }}
              >
                Sign Out
              </button>
            </>
          ) : (
            <Link to="/auth/sign-in" onClick={closeMenu} className="nav-cta">
              Sign In
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Header;
