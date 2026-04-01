import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { fakePainters } from '../lib/fakePainters';

const ALL_SERVICES = [
  'Interior Painting',
  'Exterior Painting',
  'Cabinet Painting',
  'Commercial Painting',
  'Color Consultation',
  'Deck Staining',
  'Drywall Repair',
  'Epoxy Flooring',
  'Fence Painting',
  'Popcorn Ceiling Removal',
  'Pressure Washing',
  'Wallpaper Removal',
] as const;

const PaintersMap = () => {
  const [locationQuery, setLocationQuery] = useState('');
  const [serviceFilter, setServiceFilter] = useState('');

  const filtered = useMemo(() => {
    const q = locationQuery.trim().toLowerCase();
    return fakePainters.filter((p) => {
      if (q) {
        const matchesLocation =
          p.city.toLowerCase().includes(q) ||
          p.state.toLowerCase().includes(q) ||
          p.zip_code.includes(q);
        if (!matchesLocation) return false;
      }
      if (serviceFilter) {
        if (!p.services.includes(serviceFilter)) return false;
      }
      return true;
    });
  }, [locationQuery, serviceFilter]);

  const clearFilters = () => {
    setLocationQuery('');
    setServiceFilter('');
  };

  const hasFilters = locationQuery !== '' || serviceFilter !== '';

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white">
      {/* Hero */}
      <section className="bg-[#111] border-b border-[#333] py-16 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-3">
            Find Painters <span className="text-[#f5a623]">Nationwide</span>
          </h1>
          <p className="text-lg text-gray-400 max-w-2xl">
            Browse our network of 50 vetted, professional painters across the
            country. Filter by location or service to find the right team for
            your project.
          </p>
        </div>
      </section>

      {/* Search / filter bar */}
      <section className="border-b border-[#333] bg-[#1a1a1a] sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="City, state, or zip..."
            value={locationQuery}
            onChange={(e) => setLocationQuery(e.target.value)}
            className="bg-[#222] border border-[#444] rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#f5a623] w-full sm:w-64"
          />

          <select
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
            className="bg-[#222] border border-[#444] rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-[#f5a623] w-full sm:w-auto"
          >
            <option value="">All Services</option>
            {ALL_SERVICES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="text-sm text-[#f5a623] hover:text-white transition-colors"
            >
              Clear filters
            </button>
          )}

          <span className="ml-auto text-sm text-gray-400">
            Showing {filtered.length} of {fakePainters.length} painters
          </span>
        </div>
      </section>

      {/* Results */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {filtered.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-xl text-gray-400">
              No painters found matching your filters.
            </p>
            <button
              onClick={clearFilters}
              className="mt-4 text-[#f5a623] hover:text-white text-sm transition-colors"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Left — painter cards */}
            <div className="space-y-4 max-h-[calc(100vh-220px)] overflow-y-auto pr-2 scrollbar-thin">
              {filtered.map((p) => (
                <div
                  key={p.id}
                  className="bg-[#222] border border-[#333] rounded-xl p-5 hover:border-[#f5a623] transition-colors"
                >
                  {/* Company + location */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <Link
                        to={`/painters/${p.id}`}
                        className="text-lg font-semibold text-[#f5a623] hover:text-white transition-colors"
                      >
                        {p.company_name}
                      </Link>
                      <p className="text-sm text-gray-400">
                        {p.city}, {p.state}
                      </p>
                    </div>

                    {/* Rating */}
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-yellow-400">&#9733;</span>
                      <span className="font-semibold text-sm">
                        {p.rating.toFixed(1)}
                      </span>
                      <span className="text-xs text-gray-500">
                        ({p.review_count})
                      </span>
                    </div>
                  </div>

                  {/* Meta row */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400 mb-3">
                    <span>{p.years_experience} yrs exp</span>
                    <span>Crew of {p.crew_size}</span>

                    {/* Badges */}
                    <span className="flex items-center gap-1">
                      <span
                        className={`inline-block w-2 h-2 rounded-full ${
                          p.is_licensed ? 'bg-green-500' : 'bg-gray-600'
                        }`}
                      />
                      Licensed
                    </span>
                    <span className="flex items-center gap-1">
                      <span
                        className={`inline-block w-2 h-2 rounded-full ${
                          p.is_insured ? 'bg-green-500' : 'bg-gray-600'
                        }`}
                      />
                      Insured
                    </span>
                    <span className="flex items-center gap-1">
                      <span
                        className={`inline-block w-2 h-2 rounded-full ${
                          p.is_bonded ? 'bg-green-500' : 'bg-gray-600'
                        }`}
                      />
                      Bonded
                    </span>
                  </div>

                  {/* Top 3 services */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    {p.services.slice(0, 3).map((s) => (
                      <span
                        key={s}
                        className="bg-[#2a2a2a] border border-[#444] rounded-full px-3 py-0.5 text-xs text-gray-300"
                      >
                        {s}
                      </span>
                    ))}
                  </div>

                  {/* Current deal */}
                  {p.deals.length > 0 && (
                    <div className="bg-[#2a2200] border border-[#f5a623]/30 rounded-lg px-3 py-2 text-sm">
                      <span className="font-semibold text-[#f5a623]">
                        {p.deals[0].title}
                      </span>
                      <span className="text-gray-400">
                        {' '}
                        &mdash; {p.deals[0].description} &middot;{' '}
                        {p.deals[0].price}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Right — map placeholder */}
            <div className="hidden lg:block">
              <div className="bg-[#222] border border-[#333] rounded-xl h-[calc(100vh-220px)] sticky top-[90px] flex flex-col items-center justify-center text-center px-6">
                <div className="text-gray-500 text-5xl mb-4">&#128506;</div>
                <p className="text-gray-400 text-lg font-medium mb-2">
                  Map view &mdash; Google Maps API key required
                </p>
                <p className="text-gray-600 text-sm max-w-xs">
                  Set <code className="text-gray-400">VITE_GOOGLE_MAPS_API_KEY</code>{' '}
                  in your <code className="text-gray-400">.env</code> file to
                  enable the interactive map.
                </p>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default PaintersMap;
