import { useState } from 'react';
import { Link } from 'react-router-dom';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleNav = () => setIsMenuOpen(!isMenuOpen);
  const closeMenu = () => setIsMenuOpen(false);

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
          <Link to="/auth/customer-sign-in" onClick={closeMenu} className="nav-cta">
            Sign In
          </Link>
        </nav>
        <button className="mobile-menu" onClick={toggleNav} aria-label="Toggle navigation">
          &#9776;
        </button>
      </div>
    </header>
  );
};

export default Header;
