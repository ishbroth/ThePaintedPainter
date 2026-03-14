import { useState } from 'react';
import { Link } from 'react-router-dom';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleNav = () => setIsMenuOpen(!isMenuOpen);

  return (
    <>
      {/* Phone Banner */}
      <div className="phone-banner">
        <a href="tel:6197242702">(619) 724-2702</a>
      </div>

      {/* Header */}
      <header className="header">
        <div className="header-container">
          <Link to="/" className="logo">
            The Painted Painter
          </Link>
          <nav className={`nav ${isMenuOpen ? 'active' : ''}`} id="nav">
            <Link to="/about" onClick={() => setIsMenuOpen(false)}>
              About
            </Link>
            <Link to="/contact" onClick={() => setIsMenuOpen(false)}>
              Book Now!
            </Link>
          </nav>
          <button className="mobile-menu" onClick={toggleNav} aria-label="Toggle navigation">
            &#9776;
          </button>
        </div>
      </header>
    </>
  );
};

export default Header;
