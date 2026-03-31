import { useState } from 'react';

interface JobOffer {
  id: number;
  customerName: string;
  city: string;
  state: string;
  projectType: string;
  summary: string;
  estimatedPrice: string;
  date: string;
  status: 'pending' | 'accepted' | 'declined';
}

const initialOffers: JobOffer[] = [
  {
    id: 1,
    customerName: 'Sarah Johnson',
    city: 'Dallas',
    state: 'TX',
    projectType: 'Interior - Full Home',
    summary: '4 bedrooms, 2 bathrooms, living room and kitchen. Walls only, no ceilings. Light prep work needed.',
    estimatedPrice: '$2,450',
    date: '2026-03-30',
    status: 'pending',
  },
  {
    id: 2,
    customerName: 'Mike Rodriguez',
    city: 'Fort Worth',
    state: 'TX',
    projectType: 'Exterior - House',
    summary: 'Single-story ranch, approximately 1,800 sq ft. Full exterior repaint including trim and shutters.',
    estimatedPrice: '$3,100',
    date: '2026-03-28',
    status: 'pending',
  },
  {
    id: 3,
    customerName: 'Emily Chen',
    city: 'Plano',
    state: 'TX',
    projectType: 'Interior - Single Room',
    summary: 'Master bedroom accent wall and ceiling repaint. Room is approximately 14x16.',
    estimatedPrice: '$650',
    date: '2026-03-27',
    status: 'pending',
  },
  {
    id: 4,
    customerName: 'David Thompson',
    city: 'Arlington',
    state: 'TX',
    projectType: 'Commercial - Office',
    summary: 'Small office space, 3 rooms plus reception area. Neutral color scheme. Weekend work preferred.',
    estimatedPrice: '$1,800',
    date: '2026-03-25',
    status: 'pending',
  },
  {
    id: 5,
    customerName: 'Lisa Patel',
    city: 'Irving',
    state: 'TX',
    projectType: 'Interior - Kitchen Cabinets',
    summary: 'Refinish 24 kitchen cabinet faces and drawers. Currently dark oak, wants bright white.',
    estimatedPrice: '$1,200',
    date: '2026-03-24',
    status: 'pending',
  },
];

export default function PainterOffers() {
  const [offers, setOffers] = useState<JobOffer[]>(initialOffers);

  const handleAccept = (id: number) => {
    setOffers((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status: 'accepted' as const } : o))
    );
  };

  const handleDecline = (id: number) => {
    setOffers((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status: 'declined' as const } : o))
    );
  };

  const pendingOffers = offers.filter((o) => o.status === 'pending');
  const respondedOffers = offers.filter((o) => o.status !== 'pending');

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-1">Job Offers</h1>
      <p className="text-gray-400 text-sm mb-6">
        Review and respond to incoming job requests from customers.
      </p>

      {/* Pending */}
      <h2 className="text-lg font-semibold text-white mb-3">
        Pending ({pendingOffers.length})
      </h2>
      {pendingOffers.length === 0 ? (
        <div className="bg-[#222] border border-[#333] rounded-xl p-8 text-center mb-8">
          <p className="text-gray-400">No pending offers right now.</p>
        </div>
      ) : (
        <div className="space-y-4 mb-8">
          {pendingOffers.map((offer) => (
            <div key={offer.id} className="bg-[#222] border border-[#333] rounded-xl p-5">
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <h3 className="text-white font-semibold">{offer.projectType}</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-900/40 text-yellow-400 font-medium">
                      Pending
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 mb-3">{offer.summary}</p>
                  <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                    <span>Customer: <span className="text-gray-300">{offer.customerName}</span></span>
                    <span>Location: <span className="text-gray-300">{offer.city}, {offer.state}</span></span>
                    <span>Date: <span className="text-gray-300">{offer.date}</span></span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <p className="text-xl font-bold text-[#f5a623]">{offer.estimatedPrice}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAccept(offer.id)}
                      className="px-4 py-2 bg-green-700 hover:bg-green-600 text-white text-sm font-semibold rounded-lg transition-colors"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => handleDecline(offer.id)}
                      className="px-4 py-2 border border-red-600 text-red-400 hover:bg-red-900/30 text-sm font-semibold rounded-lg transition-colors"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Responded */}
      {respondedOffers.length > 0 && (
        <>
          <h2 className="text-lg font-semibold text-white mb-3">
            Responded ({respondedOffers.length})
          </h2>
          <div className="space-y-4">
            {respondedOffers.map((offer) => (
              <div
                key={offer.id}
                className="bg-[#222] border border-[#333] rounded-xl p-5 opacity-70"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-white font-semibold">{offer.projectType}</h3>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          offer.status === 'accepted'
                            ? 'bg-green-900/40 text-green-400'
                            : 'bg-red-900/40 text-red-400'
                        }`}
                      >
                        {offer.status === 'accepted' ? 'Accepted' : 'Declined'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      {offer.customerName} - {offer.city}, {offer.state}
                    </p>
                  </div>
                  <p className="text-lg font-bold text-gray-400">{offer.estimatedPrice}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
