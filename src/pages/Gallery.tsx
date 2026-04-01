import { useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { fakePainters } from '../lib/fakePainters';

interface GalleryImage {
  id: string;
  image: string;
  painterId: string;
  companyName: string;
  city: string;
  state: string;
  category: string;
}

// Build gallery from fake painters' portfolios
function buildGallery(): GalleryImage[] {
  const images: GalleryImage[] = [];

  fakePainters.forEach((painter) => {
    // Derive a category from painter services
    const serviceCategories: Record<string, string> = {
      'Interior Painting': 'interior',
      'Exterior Painting': 'exterior',
      'Cabinet Painting': 'cabinets',
      'Cabinet Refinishing': 'cabinets',
      'Epoxy Flooring': 'epoxy',
      'Epoxy Garage Floor': 'epoxy',
      'Commercial Painting': 'commercial',
      'Deck Staining': 'exterior',
      'Fence Staining': 'exterior',
      'Drywall Repair': 'interior',
      'Popcorn Ceiling Removal': 'interior',
    };

    painter.portfolio_images.forEach((img, idx) => {
      // Try to match a category from painter services
      let category = 'interior'; // default
      for (const service of painter.services) {
        for (const [key, cat] of Object.entries(serviceCategories)) {
          if (service.toLowerCase().includes(key.toLowerCase())) {
            category = cat;
            break;
          }
        }
      }
      // Alternate categories for variety
      if (idx % 3 === 1 && painter.services.some(s => s.toLowerCase().includes('exterior'))) category = 'exterior';
      if (idx % 5 === 0 && painter.services.some(s => s.toLowerCase().includes('cabinet'))) category = 'cabinets';

      images.push({
        id: `${painter.id}-${idx}`,
        image: img,
        painterId: painter.id,
        companyName: painter.company_name,
        city: painter.city,
        state: painter.state,
        category,
      });
    });
  });

  // Shuffle for variety
  for (let i = images.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [images[i], images[j]] = [images[j], images[i]];
  }

  return images;
}

const allImages = buildGallery();

const Gallery = () => {
  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null);
  const [filter, setFilter] = useState('all');
  const [visibleCount, setVisibleCount] = useState(24);

  const categories = [
    { id: 'all', label: 'All Projects' },
    { id: 'interior', label: 'Interior' },
    { id: 'exterior', label: 'Exterior' },
    { id: 'cabinets', label: 'Cabinets' },
    { id: 'epoxy', label: 'Epoxy' },
    { id: 'commercial', label: 'Commercial' },
  ];

  const filteredImages = filter === 'all'
    ? allImages
    : allImages.filter(img => img.category === filter);

  const visibleImages = filteredImages.slice(0, visibleCount);

  return (
    <div className="bg-[#1a1a1a] text-white" style={{ minHeight: '100vh' }}>
      {/* Hero */}
      <section className="bg-[#111] text-white py-16 border-b border-[#333]">
        <div className="container-custom text-center">
          <h1
            className="text-3xl md:text-4xl font-bold mb-3"
            style={{ fontFamily: "'Cabin', sans-serif" }}
          >
            Project Gallery
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Browse real work from verified painters across the country.
          </p>
        </div>
      </section>

      {/* Gallery */}
      <section style={{ padding: '40px 20px' }}>
        <div className="container-custom">
          {/* Filter Tabs */}
          <div className="flex flex-wrap justify-center gap-3 mb-10">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => { setFilter(cat.id); setVisibleCount(24); }}
                style={{
                  padding: '8px 20px',
                  borderRadius: '20px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  transition: 'all 0.2s',
                  background: filter === cat.id ? '#f5a623' : '#333',
                  color: filter === cat.id ? '#111' : '#ccc',
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <p className="text-center text-gray-500 text-sm mb-6">
            {filteredImages.length} project{filteredImages.length !== 1 ? 's' : ''} found
          </p>

          {/* Gallery Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {visibleImages.map((item) => (
              <div
                key={item.id}
                className="group cursor-pointer"
                style={{
                  borderRadius: '10px',
                  overflow: 'hidden',
                  background: '#222',
                }}
              >
                <div
                  className="relative h-56 overflow-hidden"
                  onClick={() => setSelectedImage(item)}
                >
                  <img
                    src={item.image}
                    alt={`Work by ${item.companyName}`}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-white font-semibold text-sm">View</span>
                  </div>
                </div>
                <Link
                  to={`/painters/${item.painterId}`}
                  style={{
                    display: 'block',
                    padding: '10px 14px',
                    textDecoration: 'none',
                  }}
                >
                  <p style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 600, margin: 0 }}>
                    {item.companyName}
                  </p>
                  <p style={{ color: '#888', fontSize: '0.75rem', margin: '2px 0 0' }}>
                    {item.city}, {item.state}
                  </p>
                </Link>
              </div>
            ))}
          </div>

          {/* Load More */}
          {visibleCount < filteredImages.length && (
            <div className="text-center mt-10">
              <button
                onClick={() => setVisibleCount((c) => c + 24)}
                style={{
                  padding: '12px 32px',
                  background: 'transparent',
                  border: '2px solid #f5a623',
                  color: '#f5a623',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                }}
              >
                Load More
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Lightbox */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <button
            className="absolute top-4 right-4 text-white hover:text-[#f5a623] transition-colors"
            onClick={() => setSelectedImage(null)}
          >
            <X size={32} />
          </button>
          <div className="text-center" onClick={(e) => e.stopPropagation()}>
            <img
              src={selectedImage.image}
              alt={`Work by ${selectedImage.companyName}`}
              className="max-w-full max-h-[80vh] object-contain mx-auto"
            />
            <div className="mt-4">
              <Link
                to={`/painters/${selectedImage.painterId}`}
                style={{ color: '#f5a623', fontWeight: 600, textDecoration: 'none', fontSize: '0.95rem' }}
              >
                {selectedImage.companyName}
              </Link>
              <p className="text-gray-400 text-sm mt-1">
                {selectedImage.city}, {selectedImage.state}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Gallery;
