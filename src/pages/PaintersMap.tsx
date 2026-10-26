import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useNetworkPainters } from '../lib/networkPainters';
import { useGoogleMaps } from '../lib/googleMaps';
import { useAuth } from '../lib/auth';
import { estimatorZip } from '../lib/mapCenter';
import PaintersMapView from '../components/PaintersMapView';

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
  const { painters, loading } = useNetworkPainters();
  const mapStatus = useGoogleMaps();
  const { profile } = useAuth();
  const centerZip = profile?.zip_code || estimatorZip();

  const filtered = useMemo(() => {
    const q = locationQuery.trim().toLowerCase();
    return painters.filter((p) => {
      if (q) {
        const matchesLocation =
          (p.city ?? '').toLowerCase().includes(q) ||
          (p.state ?? '').toLowerCase().includes(q) ||
          (p.zip_code ?? '').includes(q);
        if (!matchesLocation) return false;
      }
      if (serviceFilter) {
        if (!p.service_types.includes(serviceFilter)) return false;
      }
      return true;
    });
  }, [painters, locationQuery, serviceFilter]);

  const clearFilters = () => {
    setLocationQuery('');
    setServiceFilter('');
  };

  const hasFilters = locationQuery !== '' || serviceFilter !== '';

  return (
    <div className="min-h-screen text-[var(--text-primary)]">
      {/* Hero */}
      <section className="bg-[var(--bg-chrome)] border-b border-[var(--border)] py-16 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-3">
            Find Painters <span className="text-[var(--accent)]">Nationwide</span>
          </h1>
          <p className="text-lg text-[var(--text-secondary)] max-w-2xl">
            Browse our network of {painters.length} vetted, professional painters across the
            country. Filter by location or service to find the right team for
            your project.
          </p>
        </div>
      </section>

      {/* Search / filter bar */}
      <section className="border-b border-[var(--border)] bg-[var(--bg-page)] sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="City, state, or zip..."
            value={locationQuery}
            onChange={(e) => setLocationQuery(e.target.value)}
            className="bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-lg px-4 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-faint)] focus:outline-none focus:border-[var(--accent)] w-full sm:w-64"
          />

          <select
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
            className="bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-lg px-4 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] w-full sm:w-auto"
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
              className="text-sm text-[var(--accent)] hover:text-[var(--text-primary)] transition-colors"
            >
              Clear filters
            </button>
          )}

          <span className="ml-auto text-sm text-[var(--text-secondary)]">
            Showing {filtered.length} of {painters.length} painters
          </span>
        </div>
      </section>

      {/* Results */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <p className="text-center py-24 text-[var(--text-secondary)]">Loading painters…</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-xl text-[var(--text-secondary)]">
              No painters found matching your filters.
            </p>
            <button
              onClick={clearFilters}
              className="mt-4 text-[var(--accent)] hover:text-[var(--text-primary)] text-sm transition-colors"
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
                  className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-5 hover:border-[var(--accent)] transition-colors"
                >
                  {/* Company + location */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <Link
                        to={`/painters/${p.id}`}
                        className="text-lg font-semibold text-[var(--accent)] hover:text-[var(--text-primary)] transition-colors"
                      >
                        {p.company_name}
                      </Link>
                      <p className="text-sm text-[var(--text-secondary)]">
                        {[p.city, p.state].filter(Boolean).join(', ')}
                      </p>
                    </div>

                    {/* Rating */}
                    <div className="flex items-center gap-1 shrink-0">
                      {p.review_count > 0 ? (
                        <>
                          <span className="text-yellow-400">&#9733;</span>
                          <span className="font-semibold text-sm">{Number(p.avg_rating).toFixed(1)}</span>
                          <span className="text-xs text-[var(--text-faint)]">({p.review_count})</span>
                        </>
                      ) : (
                        <span className="text-xs text-[var(--text-faint)]">New to the network</span>
                      )}
                    </div>
                  </div>

                  {/* Meta row */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--text-secondary)] mb-3">
                    {p.years_in_business != null && <span>{p.years_in_business} yrs in business</span>}
                    {p.crew_size != null && <span>Crew of {p.crew_size}</span>}

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
                    {p.service_types.slice(0, 3).map((s) => (
                      <span
                        key={s}
                        className="bg-[var(--bg-surface-hover)] border border-[var(--border-strong)] rounded-full px-3 py-0.5 text-xs text-[var(--text-secondary)]"
                      >
                        {s}
                      </span>
                    ))}
                  </div>

                </div>
              ))}
            </div>

            {/* Right: the live map (the same painters, updated as they join or leave) */}
            <div className="hidden lg:block">
              <div className="rounded-xl overflow-hidden border border-[var(--border)] h-[calc(100vh-220px)] sticky top-[90px]">
                {mapStatus === 'ready' ? (
                  <PaintersMapView painters={filtered} centerZip={centerZip} height="100%" />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center px-6 bg-[var(--bg-surface)]">
                    <div className="text-[var(--text-faint)] text-5xl mb-4">&#128506;</div>
                    <p className="text-[var(--text-secondary)] text-lg font-medium">
                      {mapStatus === 'loading' ? 'Loading the map…' : 'The map is coming soon.'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default PaintersMap;
