import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fakePainters } from '../../lib/fakePainters.ts';

export default function CustomerReviewForm() {
  const { painterId } = useParams<{ painterId: string }>();

  const painter = fakePainters.find((p) => p.id === painterId);
  const painterName = painter?.company_name ?? 'Unknown Painter';

  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) return;
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="max-w-2xl text-center py-12">
        <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
          <svg
            className="w-8 h-8 text-green-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-white mb-4">
          Review Submitted!
        </h1>
        <p className="text-gray-400 mb-8">
          Thank you for reviewing {painterName}. Your feedback helps other
          customers find great painters.
        </p>
        <Link
          to="/customer/dashboard/projects"
          className="inline-block px-6 py-3 bg-[#f5a623] text-black font-semibold rounded-lg hover:bg-[#e09510] transition-colors"
        >
          Back to Projects
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <Link
        to="/customer/dashboard/projects"
        className="text-gray-400 hover:text-white text-sm mb-6 inline-block transition-colors"
      >
        &larr; Back to Projects
      </Link>

      <h1 className="text-3xl font-bold text-white mb-2">Leave a Review</h1>
      <p className="text-gray-400 mb-8">
        Share your experience with{' '}
        <span className="text-[#f5a623] font-semibold">{painterName}</span>
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Star Rating */}
        <div>
          <label className="block text-gray-400 text-sm mb-3">
            Rating <span className="text-red-400">*</span>
          </label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                className="text-3xl transition-colors focus:outline-none"
              >
                <svg
                  className={`w-10 h-10 ${
                    star <= (hoverRating || rating)
                      ? 'text-[#f5a623]'
                      : 'text-[#444]'
                  } transition-colors`}
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </button>
            ))}
          </div>
          {rating === 0 && (
            <p className="text-gray-500 text-xs mt-2">
              Click a star to set your rating
            </p>
          )}
        </div>

        {/* Title */}
        <div>
          <label
            htmlFor="reviewTitle"
            className="block text-gray-400 text-sm mb-2"
          >
            Review Title
          </label>
          <input
            id="reviewTitle"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-3 bg-[#222] border border-[#333] rounded-lg text-white focus:outline-none focus:border-[#f5a623] transition-colors"
            placeholder="Summarize your experience"
          />
        </div>

        {/* Body */}
        <div>
          <label
            htmlFor="reviewBody"
            className="block text-gray-400 text-sm mb-2"
          >
            Your Review
          </label>
          <textarea
            id="reviewBody"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            className="w-full px-4 py-3 bg-[#222] border border-[#333] rounded-lg text-white focus:outline-none focus:border-[#f5a623] transition-colors resize-y"
            placeholder="Tell others about your experience with this painter..."
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={rating === 0}
          className={`px-6 py-3 font-semibold rounded-lg transition-colors ${
            rating === 0
              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
              : 'bg-[#f5a623] text-black hover:bg-[#e09510]'
          }`}
        >
          Submit Review
        </button>
      </form>
    </div>
  );
}
