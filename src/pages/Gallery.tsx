import { useState } from 'react';
import { X } from 'lucide-react';

const Gallery = () => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');

  const galleryItems = [
    { id: 1, category: 'interior', title: 'Modern Living Room', image: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800' },
    { id: 2, category: 'exterior', title: 'Craftsman Home', image: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800' },
    { id: 3, category: 'cabinets', title: 'White Kitchen Cabinets', image: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800' },
    { id: 4, category: 'interior', title: 'Master Bedroom', image: 'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?w=800' },
    { id: 5, category: 'epoxy', title: 'Garage Epoxy Floor', image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800' },
    { id: 6, category: 'exterior', title: 'Victorian Home', image: 'https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=800' },
    { id: 7, category: 'interior', title: 'Home Office', image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800' },
    { id: 8, category: 'cabinets', title: 'Navy Blue Cabinets', image: 'https://images.unsplash.com/photo-1556909114-44e3e70034e2?w=800' },
    { id: 9, category: 'exterior', title: 'Modern Exterior', image: 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800' },
    { id: 10, category: 'interior', title: 'Dining Room', image: 'https://images.unsplash.com/photo-1617806118233-18e1de247200?w=800' },
    { id: 11, category: 'commercial', title: 'Restaurant Interior', image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800' },
    { id: 12, category: 'exterior', title: 'Beach House', image: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800' },
  ];

  const categories = [
    { id: 'all', label: 'All Projects' },
    { id: 'interior', label: 'Interior' },
    { id: 'exterior', label: 'Exterior' },
    { id: 'cabinets', label: 'Cabinets' },
    { id: 'epoxy', label: 'Epoxy' },
    { id: 'commercial', label: 'Commercial' },
  ];

  const filteredItems = filter === 'all'
    ? galleryItems
    : galleryItems.filter(item => item.category === filter);

  return (
    <div>
      {/* Hero */}
      <section className="bg-primary text-white py-20">
        <div className="container-custom">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Our Gallery</h1>
          <p className="text-xl text-gray-200 max-w-2xl">
            Browse our portfolio of completed painting projects.
          </p>
        </div>
      </section>

      {/* Gallery */}
      <section className="section-padding">
        <div className="container-custom">
          {/* Filter Tabs */}
          <div className="flex flex-wrap justify-center gap-3 mb-12">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setFilter(cat.id)}
                className={`px-6 py-2 rounded-full font-medium transition-colors ${
                  filter === cat.id
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Gallery Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="card cursor-pointer group"
                onClick={() => setSelectedImage(item.image)}
              >
                <div className="relative h-64 overflow-hidden">
                  <img
                    src={item.image}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-primary/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-white font-semibold">{item.title}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Lightbox */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <button
            className="absolute top-4 right-4 text-white hover:text-secondary transition-colors"
            onClick={() => setSelectedImage(null)}
          >
            <X size={32} />
          </button>
          <img
            src={selectedImage}
            alt="Gallery preview"
            className="max-w-full max-h-[90vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

export default Gallery;
