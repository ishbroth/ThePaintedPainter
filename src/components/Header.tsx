import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Phone } from 'lucide-react';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();

  const navLinks = [
    { path: '/', label: 'Home' },
    { path: '/services', label: 'Services' },
    { path: '/about', label: 'About' },
    { path: '/gallery', label: 'Gallery' },
    { path: '/painters-map', label: "Painter's Map" },
    { path: '/contact', label: 'Contact' },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="bg-white shadow-md sticky top-0 z-50">
      {/* Top bar with phone */}
      <div className="bg-primary text-white py-2">
        <div className="container-custom flex justify-between items-center">
          <span className="text-sm">Licensed Contractor #1019026</span>
          <a href="tel:6197242702" className="flex items-center gap-2 text-sm hover:text-secondary transition-colors">
            <Phone size={16} />
            (619) 724-2702
          </a>
        </div>
      </div>

      {/* Main navigation */}
      <nav className="container-custom py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3">
            <img
              src="https://img1.wsimg.com/isteam/ip/d8c87176-1549-49d9-97f8-f9e6fa38b25f/IMG_7201.PNG/:/cr=t:0%25,l:0%25,w:100%25,h:100%25/rs=h:100,cg:true"
              alt="The Painted Painter"
              className="h-12 w-auto"
            />
            <div>
              <h1 className="text-xl font-bold text-primary leading-tight">The Painted</h1>
              <h1 className="text-xl font-bold text-secondary leading-tight">Painter</h1>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`font-medium transition-colors ${
                  isActive(link.path)
                    ? 'text-secondary'
                    : 'text-gray-700 hover:text-primary'
                }`}
              >
                {link.label}
              </Link>
            ))}
            <Link
              to="/quote"
              className="btn-secondary"
            >
              Get Free Quote
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden mt-4 pb-4 border-t pt-4">
            <div className="flex flex-col gap-4">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`font-medium py-2 ${
                    isActive(link.path)
                      ? 'text-secondary'
                      : 'text-gray-700'
                  }`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <Link
                to="/quote"
                className="btn-secondary text-center mt-2"
                onClick={() => setIsMenuOpen(false)}
              >
                Get Free Quote
              </Link>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
};

export default Header;
