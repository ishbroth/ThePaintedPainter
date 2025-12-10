import { Link } from 'react-router-dom';
import { Phone, Mail, MapPin, Facebook, Instagram } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-primary text-white">
      <div className="container-custom py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Company Info */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center">
                <span className="text-white font-bold">PP</span>
              </div>
              <div>
                <h3 className="font-bold leading-tight">The Painted</h3>
                <h3 className="font-bold text-secondary leading-tight">Painter</h3>
              </div>
            </div>
            <p className="text-gray-300 text-sm">
              Professional residential and commercial painting services in San Diego and nationwide through our network of trusted painters.
            </p>
            <p className="text-gray-400 text-sm mt-2">
              License #1019026
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold text-lg mb-4">Quick Links</h4>
            <ul className="space-y-2">
              <li>
                <Link to="/services" className="text-gray-300 hover:text-secondary transition-colors">
                  Services
                </Link>
              </li>
              <li>
                <Link to="/about" className="text-gray-300 hover:text-secondary transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link to="/gallery" className="text-gray-300 hover:text-secondary transition-colors">
                  Gallery
                </Link>
              </li>
              <li>
                <Link to="/quote" className="text-gray-300 hover:text-secondary transition-colors">
                  Get a Quote
                </Link>
              </li>
              <li>
                <Link to="/painters-map" className="text-gray-300 hover:text-secondary transition-colors">
                  Painter's Map
                </Link>
              </li>
            </ul>
          </div>

          {/* Services */}
          <div>
            <h4 className="font-semibold text-lg mb-4">Services</h4>
            <ul className="space-y-2 text-gray-300 text-sm">
              <li>Interior Painting</li>
              <li>Exterior Painting</li>
              <li>Cabinet Painting</li>
              <li>Garage Epoxy</li>
              <li>Wood Staining</li>
              <li>Commercial Painting</li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-semibold text-lg mb-4">Contact Us</h4>
            <div className="space-y-3">
              <a href="tel:6197242702" className="flex items-center gap-3 text-gray-300 hover:text-secondary transition-colors">
                <Phone size={18} />
                (619) 724-2702
              </a>
              <a href="mailto:info@thepaintedpainter.com" className="flex items-center gap-3 text-gray-300 hover:text-secondary transition-colors">
                <Mail size={18} />
                info@thepaintedpainter.com
              </a>
              <div className="flex items-start gap-3 text-gray-300">
                <MapPin size={18} className="mt-1 flex-shrink-0" />
                <span>San Diego, CA & Nationwide</span>
              </div>
            </div>

            {/* Social Links */}
            <div className="flex gap-4 mt-4">
              <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-secondary transition-colors">
                <Facebook size={24} />
              </a>
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-secondary transition-colors">
                <Instagram size={24} />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-gray-700">
        <div className="container-custom py-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-gray-400">
            <p>&copy; {new Date().getFullYear()} The Painted Painter. All rights reserved.</p>
            <div className="flex gap-4">
              <Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
              <Link to="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
