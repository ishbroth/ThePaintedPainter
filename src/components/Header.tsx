import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { hapticLight, hapticMedium } from '../lib/haptics';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();

  const toggleNav = () => {
    hapticLight();
    setIsMenuOpen(!isMenuOpen);
  };

  const closeMenu = () => {
    hapticLight();
    setIsMenuOpen(false);
  };

  const dashboardPath = profile?.role === 'painter'
    ? '/painter/dashboard'
    : '/customer/dashboard';

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
        <Link to="/" className="logo" onClick={closeMenu}>
          The Painted Painter
        </Link>
        <nav className={`nav ${isMenuOpen ? 'active' : ''}`} id="nav">
          <Link to="/about" onClick={closeMenu}>
            About
          </Link>
          <Link to="/contact" onClick={closeMenu}>
            Get Estimate
          </Link>
          <Link to="/painter-signup" onClick={closeMenu}>
            For Painters
          </Link>
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
                  border: '1px solid #555',
                  color: '#ccc',
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
            <Link to="/auth/customer-sign-in" onClick={closeMenu} className="nav-cta">
              Sign In
            </Link>
          )}
        </nav>
        <button className="mobile-menu" onClick={toggleNav} aria-label="Toggle navigation">
          &#9776;
        </button>
      </div>
    </header>
  );
};

export default Header;
