import { Facebook, Instagram } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-black text-white border-t border-gray-800">
      <div className="container-custom py-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          {/* Copyright */}
          <p className="text-gray-500 text-xs">
            Copyright &copy; {new Date().getFullYear()} The Painted Painter - All Rights Reserved.
          </p>

          {/* Social Links */}
          <div className="flex gap-4">
            <a
              href="https://www.facebook.com/thepaintedpainter"
              target="_blank"
              rel="noopener noreferrer"
              className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center hover:bg-secondary transition-colors"
            >
              <Facebook size={16} />
            </a>
            <a
              href="https://www.instagram.com/thepaintedpainter"
              target="_blank"
              rel="noopener noreferrer"
              className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center hover:bg-secondary transition-colors"
            >
              <Instagram size={16} />
            </a>
            <a
              href="https://www.yelp.com/biz/the-painted-painter-san-diego"
              target="_blank"
              rel="noopener noreferrer"
              className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center hover:bg-secondary transition-colors"
            >
              <span className="text-xs font-bold">Y</span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
