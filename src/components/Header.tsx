import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { hapticLight } from '../lib/haptics';

const Header = () => {
  const { user, profile, loading } = useAuth();

  const closeMenu = () => {
    hapticLight();
  };

  // Signed in, the header is just three links. A painter has no use for the estimator: Dashboard (offers, calendar, jobs), Profile and Support. A customer:
  // Get Your Price, Dashboard and Support. Signed out: Get Your Price, For Painters, Support and Sign In. While we do not yet know whose account it is, only
  // Support is shown (so the wrong links never flash).
  const isPainter = profile?.role === 'painter';
  const isCustomer = profile?.role === 'customer';
  const unknown = loading || (!!user && !profile);

  return (
    <header className="header">
      <div className="header-container">
        <nav className="nav" id="nav">
          {!unknown && !isPainter && (
            <Link to="/#estimator" onClick={closeMenu}>
              Get Your Price
            </Link>
          )}
          {!unknown && isPainter && (
            <Link to="/painter/dashboard" onClick={closeMenu}>
              Dashboard
            </Link>
          )}
          {!unknown && isPainter && (
            <Link to="/painter/dashboard/profile" onClick={closeMenu}>
              Profile
            </Link>
          )}
          {!unknown && isCustomer && (
            <Link to="/customer/dashboard" onClick={closeMenu}>
              Dashboard
            </Link>
          )}
          {!unknown && !user && (
            <Link to="/painter-signup" onClick={closeMenu}>
              For Painters
            </Link>
          )}
          <Link to="/support" onClick={closeMenu}>
            Support
          </Link>
          {!user && !loading && (
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
