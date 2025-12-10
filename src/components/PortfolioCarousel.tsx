import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Portfolio images - these will be replaced with actual images from the site
const portfolioItems = [
  {
    id: 1,
    title: 'Modern Living Room',
    category: 'Interior',
    image: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800',
  },
  {
    id: 2,
    title: 'Exterior Home Refresh',
    category: 'Exterior',
    image: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800',
  },
  {
    id: 3,
    title: 'Kitchen Cabinet Makeover',
    category: 'Cabinets',
    image: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800',
  },
  {
    id: 4,
    title: 'Master Bedroom',
    category: 'Interior',
    image: 'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?w=800',
  },
  {
    id: 5,
    title: 'Garage Epoxy Floor',
    category: 'Epoxy',
    image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800',
  },
  {
    id: 6,
    title: 'Victorian Exterior',
    category: 'Exterior',
    image: 'https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=800',
  },
];

const PortfolioCarousel = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [itemsPerView, setItemsPerView] = useState(3);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 640) {
        setItemsPerView(1);
      } else if (window.innerWidth < 1024) {
        setItemsPerView(2);
      } else {
        setItemsPerView(3);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const maxIndex = portfolioItems.length - itemsPerView;

  const next = () => {
    setCurrentIndex((prev) => (prev >= maxIndex ? 0 : prev + 1));
  };

  const prev = () => {
    setCurrentIndex((prev) => (prev <= 0 ? maxIndex : prev - 1));
  };

  // Auto-advance
  useEffect(() => {
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [maxIndex]);

  return (
    <div className="relative">
      {/* Navigation Buttons */}
      <button
        onClick={prev}
        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 bg-white shadow-lg rounded-full p-2 hover:bg-gray-100 transition-colors"
        aria-label="Previous"
      >
        <ChevronLeft size={24} className="text-primary" />
      </button>
      <button
        onClick={next}
        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 bg-white shadow-lg rounded-full p-2 hover:bg-gray-100 transition-colors"
        aria-label="Next"
      >
        <ChevronRight size={24} className="text-primary" />
      </button>

      {/* Carousel Container */}
      <div className="overflow-hidden mx-8">
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{
            transform: `translateX(-${currentIndex * (100 / itemsPerView)}%)`,
          }}
        >
          {portfolioItems.map((item) => (
            <div
              key={item.id}
              className="flex-shrink-0 px-2"
              style={{ width: `${100 / itemsPerView}%` }}
            >
              <div className="card group overflow-hidden">
                <div className="relative h-64 overflow-hidden">
                  <img
                    src={item.image}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="absolute bottom-4 left-4 text-white">
                      <span className="text-xs uppercase tracking-wider text-secondary">{item.category}</span>
                      <h3 className="text-lg font-semibold">{item.title}</h3>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Dots Indicator */}
      <div className="flex justify-center mt-6 gap-2">
        {Array.from({ length: maxIndex + 1 }).map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            className={`w-2 h-2 rounded-full transition-colors ${
              currentIndex === index ? 'bg-secondary' : 'bg-gray-300'
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
};

export default PortfolioCarousel;
