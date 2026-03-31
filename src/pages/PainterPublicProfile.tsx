import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fakePainters } from '../lib/fakePainters';

// ---------------------------------------------------------------------------
// Fake reviews (static, realistic)
// ---------------------------------------------------------------------------
const fakeReviews = [
  {
    name: 'Sarah M.',
    rating: 5,
    date: 'February 2026',
    text: 'Absolutely phenomenal work. The crew was on time, professional, and meticulous about taping and prep. Our living room and kitchen look brand new. Would hire again in a heartbeat.',
  },
  {
    name: 'David L.',
    rating: 5,
    date: 'January 2026',
    text: 'We had the entire exterior of our home repainted and the results exceeded our expectations. They even pointed out some minor wood rot that we were able to fix before painting. Great communication throughout.',
  },
  {
    name: 'Jennifer K.',
    rating: 4,
    date: 'December 2025',
    text: 'Very happy with the quality of work. The color consultation was incredibly helpful — they suggested a palette we never would have considered and it looks amazing. Only minor scheduling hiccup but they made it right.',
  },
  {
    name: 'Marcus T.',
    rating: 5,
    date: 'November 2025',
    text: 'Third time using this crew and they never disappoint. Fair pricing, clean work, and they always leave the place spotless. Highly recommend to anyone looking for reliable painters.',
  },
  {
    name: 'Amy R.',
    rating: 4,
    date: 'October 2025',
    text: 'Solid job on our bedroom and hallway. The finish is smooth and even, and they were careful around our furniture. Price was reasonable compared to other quotes we received.',
  },
];

// ---------------------------------------------------------------------------
// Star display helper
// ---------------------------------------------------------------------------
function Stars({ rating, size = 'text-lg' }: { rating: number; size?: string }) {
  const full = Math.floor(rating);
  const hasHalf = rating - full >= 0.25 && rating - full < 0.75;
  const empty = 5 - full - (hasHalf ? 1 : 0);
  return (
    <span className={`${size} text-[#f5a623] inline-flex items-center`}>
      {'★'.repeat(full)}
      {hasHalf && '½'}
      {'☆'.repeat(empty)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Badge helper
// ---------------------------------------------------------------------------
function Badge({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${
        active
          ? 'bg-green-900/40 text-green-400 border border-green-700'
          : 'bg-gray-800 text-gray-500 border border-gray-700'
      }`}
    >
      {active ? (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      )}
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Lightbox component
// ---------------------------------------------------------------------------
function Lightbox({
  images,
  index,
  onClose,
  onPrev,
  onNext,
}: {
  images: string[];
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-4 right-4 text-white text-3xl font-bold hover:text-gray-300 z-50"
        aria-label="Close"
      >
        &times;
      </button>

      {images.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); onPrev(); }}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-white text-4xl font-bold hover:text-gray-300 z-50"
          aria-label="Previous image"
        >
          &#8249;
        </button>
      )}

      <img
        src={images[index]}
        alt={`Portfolio ${index + 1}`}
        className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain"
        onClick={(e) => e.stopPropagation()}
      />

      {images.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white text-4xl font-bold hover:text-gray-300 z-50"
          aria-label="Next image"
        >
          &#8250;
        </button>
      )}

      <div className="absolute bottom-4 text-gray-400 text-sm">
        {index + 1} / {images.length}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
const PainterPublicProfile = () => {
  const { id } = useParams<{ id: string }>();
  const painter = fakePainters.find((p) => p.id === id);

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // 404
  if (!painter) {
    return (
      <div className="bg-[#1a1a1a] text-white min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <h1 className="text-3xl font-bold">Painter Not Found</h1>
        <p className="text-gray-400">We couldn't find a painter with that ID.</p>
        <Link to="/painters-map" className="cta-button mt-4">
          Browse Painters Map
        </Link>
      </div>
    );
  }

  // Average rating from fake reviews (weighted with painter.rating)
  const avgReviewRating =
    Math.round(
      ((fakeReviews.reduce((sum, r) => sum + r.rating, 0) / fakeReviews.length + painter.rating) / 2) * 10
    ) / 10;

  return (
    <div className="bg-[#1a1a1a] text-white">
      {/* ----------------------------------------------------------------- */}
      {/* 1. Hero Section */}
      {/* ----------------------------------------------------------------- */}
      <section className="bg-[#111] py-16 border-b border-[#333]">
        <div className="container-custom text-center">
          <h1 className="text-3xl md:text-4xl font-bold mb-3">{painter.company_name}</h1>
          <p className="text-gray-400 text-lg mb-4">
            {painter.city}, {painter.state} {painter.zip_code}
          </p>

          <div className="flex items-center justify-center gap-3 mb-4">
            <Stars rating={painter.rating} size="text-2xl" />
            <span className="text-white font-semibold text-lg">{painter.rating.toFixed(1)}</span>
            <span className="text-gray-400">({painter.review_count} reviews)</span>
          </div>

          <span className="inline-block bg-[#f5a623] text-black font-bold px-4 py-1.5 rounded-full text-sm">
            {painter.years_experience} Years Experience
          </span>
        </div>
      </section>

      {/* ----------------------------------------------------------------- */}
      {/* 2. Company Info */}
      {/* ----------------------------------------------------------------- */}
      <section className="py-12">
        <div className="container-custom max-w-3xl">
          <h2 className="text-2xl font-bold mb-6 text-center">Company Info</h2>

          <div className="grid sm:grid-cols-2 gap-6 mb-8">
            <div className="bg-[#222] rounded-lg p-5 border border-[#333]">
              <p className="text-gray-400 text-sm mb-1">Owner</p>
              <p className="text-white font-semibold">{painter.owner_name}</p>
            </div>
            <div className="bg-[#222] rounded-lg p-5 border border-[#333]">
              <p className="text-gray-400 text-sm mb-1">Phone</p>
              <p className="text-white font-semibold">{painter.phone}</p>
            </div>
            <div className="bg-[#222] rounded-lg p-5 border border-[#333]">
              <p className="text-gray-400 text-sm mb-1">Crew Size</p>
              <p className="text-white font-semibold">{painter.crew_size} members</p>
            </div>
            {painter.license_number && (
              <div className="bg-[#222] rounded-lg p-5 border border-[#333]">
                <p className="text-gray-400 text-sm mb-1">License #</p>
                <p className="text-white font-semibold">{painter.license_number}</p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap justify-center gap-3">
            <Badge label="Licensed" active={painter.is_licensed} />
            <Badge label="Insured" active={painter.is_insured} />
            <Badge label="Bonded" active={painter.is_bonded} />
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------------- */}
      {/* 3. Bio Section */}
      {/* ----------------------------------------------------------------- */}
      <section className="py-12 bg-[#222]">
        <div className="container-custom max-w-3xl">
          <h2 className="text-2xl font-bold mb-6 text-center">About Us</h2>
          <p className="text-gray-300 leading-relaxed text-center">{painter.bio}</p>
        </div>
      </section>

      {/* ----------------------------------------------------------------- */}
      {/* 4. Services Section */}
      {/* ----------------------------------------------------------------- */}
      <section className="py-12">
        <div className="container-custom max-w-3xl">
          <h2 className="text-2xl font-bold mb-6 text-center">Services Offered</h2>
          <div className="flex flex-wrap justify-center gap-3">
            {painter.services.map((service) => (
              <span
                key={service}
                className="bg-[#333] text-white px-4 py-2 rounded-full text-sm font-medium border border-[#444] hover:border-[#f5a623] transition-colors"
              >
                {service}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------------- */}
      {/* 5. Portfolio Gallery */}
      {/* ----------------------------------------------------------------- */}
      {painter.portfolio_images.length > 0 && (
        <section className="py-12 bg-[#222]">
          <div className="container-custom">
            <h2 className="text-2xl font-bold mb-8 text-center">Portfolio</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
              {painter.portfolio_images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setLightboxIndex(i)}
                  className="overflow-hidden rounded-lg border border-[#333] hover:border-[#f5a623] transition-colors focus:outline-none focus:ring-2 focus:ring-[#f5a623]"
                >
                  <img
                    src={img}
                    alt={`Portfolio ${i + 1}`}
                    className="w-full h-48 object-cover hover:scale-105 transition-transform duration-300"
                  />
                </button>
              ))}
            </div>
          </div>

          {lightboxIndex !== null && (
            <Lightbox
              images={painter.portfolio_images}
              index={lightboxIndex}
              onClose={() => setLightboxIndex(null)}
              onPrev={() =>
                setLightboxIndex((prev) =>
                  prev !== null
                    ? (prev - 1 + painter.portfolio_images.length) % painter.portfolio_images.length
                    : 0
                )
              }
              onNext={() =>
                setLightboxIndex((prev) =>
                  prev !== null
                    ? (prev + 1) % painter.portfolio_images.length
                    : 0
                )
              }
            />
          )}
        </section>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* 6. Active Deals */}
      {/* ----------------------------------------------------------------- */}
      {painter.deals.length > 0 && (
        <section className="py-12">
          <div className="container-custom max-w-3xl">
            <h2 className="text-2xl font-bold mb-8 text-center">Active Deals</h2>
            <div className="grid sm:grid-cols-2 gap-6">
              {painter.deals.map((deal, i) => (
                <div
                  key={i}
                  className="bg-[#222] border border-[#333] rounded-lg p-6 relative overflow-hidden"
                >
                  <span className="absolute top-3 right-3 bg-[#f5a623] text-black text-xs font-bold px-2 py-1 rounded">
                    DEAL
                  </span>
                  <h3 className="text-lg font-bold mb-2 pr-16">{deal.title}</h3>
                  <p className="text-gray-400 text-sm mb-4">{deal.description}</p>
                  <p className="text-[#f5a623] text-2xl font-bold">{deal.price}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* 7. Reviews Section */}
      {/* ----------------------------------------------------------------- */}
      <section className="py-12 bg-[#222]">
        <div className="container-custom max-w-3xl">
          <h2 className="text-2xl font-bold mb-2 text-center">Customer Reviews</h2>

          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mt-2">
              <Stars rating={avgReviewRating} size="text-3xl" />
              <span className="text-2xl font-bold text-white">{avgReviewRating.toFixed(1)}</span>
            </div>
            <p className="text-gray-400 mt-1">Based on {painter.review_count} reviews</p>
          </div>

          <div className="space-y-6">
            {fakeReviews.map((review, i) => (
              <div key={i} className="bg-[#1a1a1a] border border-[#333] rounded-lg p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-semibold text-white">{review.name}</p>
                    <p className="text-gray-500 text-sm">{review.date}</p>
                  </div>
                  <Stars rating={review.rating} />
                </div>
                <p className="text-gray-300 leading-relaxed">{review.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------------- */}
      {/* 8. CTA Section */}
      {/* ----------------------------------------------------------------- */}
      <section className="py-12 bg-[#111] text-center border-t border-[#333]">
        <div className="container-custom">
          <h2 className="text-2xl font-bold mb-4">Interested in {painter.company_name}?</h2>
          <p className="text-gray-400 mb-8">Get a free estimate or browse more painters in your area.</p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/contact" className="cta-button">
              Get an Estimate
            </Link>
            <Link
              to="/painters-map"
              className="inline-block px-6 py-3 border border-[#555] text-white rounded-lg font-semibold hover:border-[#f5a623] hover:text-[#f5a623] transition-colors"
            >
              Back to Painters Map
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default PainterPublicProfile;
