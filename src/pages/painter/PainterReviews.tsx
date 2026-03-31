interface Review {
  id: number;
  customerName: string;
  rating: number;
  date: string;
  text: string;
}

const reviews: Review[] = [
  {
    id: 1,
    customerName: 'Sarah Johnson',
    rating: 5,
    date: '2026-03-28',
    text: 'Absolutely phenomenal work! The team was punctual, professional, and the finished product exceeded our expectations. Our living room looks brand new.',
  },
  {
    id: 2,
    customerName: 'Mike Rodriguez',
    rating: 5,
    date: '2026-03-20',
    text: 'Best painting experience we have ever had. Fair pricing, great communication throughout the project, and the exterior looks stunning.',
  },
  {
    id: 3,
    customerName: 'Emily Chen',
    rating: 4,
    date: '2026-03-15',
    text: 'Great job on the accent wall. The color matching was spot on. Only minor issue was scheduling took a bit longer than expected.',
  },
  {
    id: 4,
    customerName: 'James Wilson',
    rating: 5,
    date: '2026-03-10',
    text: 'Third time using Pro Painters Co. and they never disappoint. The fence looks incredible and was done in a single day.',
  },
  {
    id: 5,
    customerName: 'Amanda Clark',
    rating: 4,
    date: '2026-03-05',
    text: 'Very satisfied with the work on our three rooms. Clean, efficient, and professional. Would recommend to anyone in the DFW area.',
  },
  {
    id: 6,
    customerName: 'Robert Lee',
    rating: 5,
    date: '2026-02-28',
    text: 'Hired them for our entire office suite. The team was respectful of our business hours and completed everything over the weekend as promised.',
  },
  {
    id: 7,
    customerName: 'Karen Martinez',
    rating: 3,
    date: '2026-02-20',
    text: 'Good work overall on the cabinet refinishing. There were a couple of spots that needed touch-ups but they came back and fixed them promptly.',
  },
  {
    id: 8,
    customerName: 'Tom Baker',
    rating: 5,
    date: '2026-02-10',
    text: 'Our house looks like it just came off the lot. Incredible attention to detail on the trim work. Highly recommend Pro Painters Co.',
  },
];

function Stars({ rating, size = 'text-base' }: { rating: number; size?: string }) {
  return (
    <span className={`${size} text-[#f5a623]`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i}>{i < rating ? '\u2605' : '\u2606'}</span>
      ))}
    </span>
  );
}

export default function PainterReviews() {
  const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">Reviews</h1>

      {/* Average rating card */}
      <div className="bg-[#222] border border-[#333] rounded-xl p-8 text-center mb-8">
        <p className="text-5xl font-bold text-white mb-2">{avgRating.toFixed(1)}</p>
        <Stars rating={Math.round(avgRating)} size="text-2xl" />
        <p className="text-gray-400 text-sm mt-2">
          Based on {reviews.length} reviews
        </p>
      </div>

      {/* Reviews list */}
      <div className="space-y-4">
        {reviews.map((review) => (
          <div key={review.id} className="bg-[#222] border border-[#333] rounded-xl p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#333] flex items-center justify-center text-white font-semibold text-sm">
                  {review.customerName.split(' ').map((n) => n[0]).join('')}
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">{review.customerName}</p>
                  <p className="text-xs text-gray-500">{review.date}</p>
                </div>
              </div>
              <Stars rating={review.rating} />
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">{review.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
