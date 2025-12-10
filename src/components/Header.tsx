import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();

  const navLinks = [
    { path: '/', label: 'THE PAINTED PAINTER' },
    { path: '/about', label: 'ABOUT' },
    { path: '/quote', label: 'BOOK NOW!' },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="bg-black sticky top-0 z-50">
      {/* Phone number bar */}
      <div className="bg-black text-white py-2 text-center border-b border-gray-800">
        <a href="tel:6197242702" className="text-sm tracking-wider hover:text-secondary transition-colors">
          (619) 724-2702
        </a>
      </div>

      {/* Main navigation */}
      <nav className="bg-black py-4">
        <div className="container-custom">
          <div className="flex items-center justify-center">
            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-8">
              {navLinks.map((link, index) => (
                <div key={link.path} className="flex items-center gap-8">
                  <Link
                    to={link.path}
                    className={`text-sm tracking-wider font-medium transition-colors ${
                      isActive(link.path)
                        ? 'text-secondary'
                        : 'text-white hover:text-secondary'
                    }`}
                  >
                    {link.label}
                  </Link>
                  {index < navLinks.length - 1 && (
                    <span className="text-gray-600">|</span>
                  )}
                </div>
              ))}
            </div>

            {/* Mobile menu button */}
            <button
              className="md:hidden p-2 text-white"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Toggle menu"
            >
              {isMenuOpen ? <X size={28} /> : <Menu size={28} />}
            </button>
          </div>

          {/* Mobile Navigation */}
          {isMenuOpen && (
            <div className="md:hidden mt-4 pb-4 border-t border-gray-800 pt-4">
              <div className="flex flex-col items-center gap-4">
                {navLinks.map((link) => (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`text-sm tracking-wider font-medium py-2 ${
                      isActive(link.path)
                        ? 'text-secondary'
                        : 'text-white'
                    }`}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
};

export default Header;
