import { useState } from 'react';

interface Deal {
  id: number;
  title: string;
  description: string;
  price: string;
  validFrom: string;
  validTo: string;
  active: boolean;
}

const initialDeals: Deal[] = [
  {
    id: 1,
    title: 'Spring Interior Special',
    description: '20% off any interior room painting. Includes premium paint and prep work.',
    price: '$299',
    validFrom: '2026-03-01',
    validTo: '2026-04-30',
    active: true,
  },
  {
    id: 2,
    title: 'Exterior Full House Package',
    description: 'Complete exterior repaint at a fixed rate. Up to 2,500 sq ft.',
    price: '$1,899',
    validFrom: '2026-04-01',
    validTo: '2026-06-30',
    active: true,
  },
  {
    id: 3,
    title: 'Winter Touch-Up Deal',
    description: 'Quick touch-ups on any 2 rooms for a flat rate.',
    price: '$149',
    validFrom: '2025-12-01',
    validTo: '2026-02-28',
    active: false,
  },
];

const emptyDeal = {
  title: '',
  description: '',
  price: '',
  validFrom: '',
  validTo: '',
};

export default function PainterDeals() {
  const [deals, setDeals] = useState<Deal[]>(initialDeals);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(emptyDeal);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const updateField = (field: keyof typeof emptyDeal, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId !== null) {
      setDeals((prev) =>
        prev.map((d) =>
          d.id === editingId ? { ...d, ...formData } : d
        )
      );
      showToast('Deal updated successfully.');
      setEditingId(null);
    } else {
      const newDeal: Deal = {
        id: Date.now(),
        ...formData,
        active: true,
      };
      setDeals((prev) => [newDeal, ...prev]);
      showToast('Deal created successfully.');
    }
    setFormData(emptyDeal);
    setShowForm(false);
  };

  const startEdit = (deal: Deal) => {
    setFormData({
      title: deal.title,
      description: deal.description,
      price: deal.price,
      validFrom: deal.validFrom,
      validTo: deal.validTo,
    });
    setEditingId(deal.id);
    setShowForm(true);
  };

  const handleDelete = (id: number) => {
    setDeals((prev) => prev.filter((d) => d.id !== id));
    showToast('Deal deleted.');
  };

  const toggleActive = (id: number) => {
    setDeals((prev) =>
      prev.map((d) => (d.id === id ? { ...d, active: !d.active } : d))
    );
  };

  const cancelForm = () => {
    setShowForm(false);
    setFormData(emptyDeal);
    setEditingId(null);
  };

  const inputClass =
    'w-full px-3 py-2 bg-[#1a1a1a] border border-[#555] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#f5a623] transition-colors text-sm';

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Deals</h1>
          <p className="text-gray-400 text-sm mt-1">Create and manage your special offers.</p>
        </div>
        {!showForm && (
          <button
            onClick={() => { setShowForm(true); setEditingId(null); setFormData(emptyDeal); }}
            className="px-5 py-2.5 bg-[#f5a623] hover:bg-[#e09500] text-black font-semibold rounded-lg transition-colors text-sm"
          >
            + Create New Deal
          </button>
        )}
      </div>

      {toast && (
        <div className="bg-green-900/30 border border-green-600 text-green-400 px-4 py-3 rounded-lg mb-6 text-sm">
          {toast}
        </div>
      )}

      {/* Create / Edit form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-[#222] border border-[#333] rounded-xl p-6 mb-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">
            {editingId !== null ? 'Edit Deal' : 'New Deal'}
          </h2>
          <div>
            <label className="block text-sm text-gray-300 mb-1">Title</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => updateField('title', e.target.value)}
              placeholder="e.g. Spring Interior Special"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">Description</label>
            <textarea
              required
              value={formData.description}
              onChange={(e) => updateField('description', e.target.value)}
              rows={3}
              placeholder="Describe the deal..."
              className={inputClass + ' resize-vertical'}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-300 mb-1">Price</label>
              <input
                type="text"
                required
                value={formData.price}
                onChange={(e) => updateField('price', e.target.value)}
                placeholder="$299"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Valid From</label>
              <input
                type="date"
                required
                value={formData.validFrom}
                onChange={(e) => updateField('validFrom', e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Valid To</label>
              <input
                type="date"
                required
                value={formData.validTo}
                onChange={(e) => updateField('validTo', e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              className="px-6 py-2 bg-[#f5a623] hover:bg-[#e09500] text-black font-semibold rounded-lg transition-colors text-sm"
            >
              {editingId !== null ? 'Update Deal' : 'Create Deal'}
            </button>
            <button
              type="button"
              onClick={cancelForm}
              className="px-6 py-2 border border-[#555] text-gray-300 hover:text-white hover:border-[#888] rounded-lg transition-colors text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Deals list */}
      {deals.length === 0 ? (
        <div className="bg-[#222] border border-[#333] rounded-xl p-12 text-center">
          <p className="text-gray-400">No deals yet. Create your first deal to attract customers.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {deals.map((deal) => (
            <div
              key={deal.id}
              className={`bg-[#222] border rounded-xl p-5 ${
                deal.active ? 'border-[#333]' : 'border-[#333] opacity-60'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-white font-semibold">{deal.title}</h3>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        deal.active
                          ? 'bg-green-900/40 text-green-400'
                          : 'bg-gray-700 text-gray-400'
                      }`}
                    >
                      {deal.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 mb-2">{deal.description}</p>
                  <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                    <span>Price: <span className="text-[#f5a623] font-semibold">{deal.price}</span></span>
                    <span>Valid: {deal.validFrom} to {deal.validTo}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => toggleActive(deal.id)}
                    className="px-3 py-1.5 text-xs border border-[#555] text-gray-300 hover:text-white hover:border-[#888] rounded-lg transition-colors"
                  >
                    {deal.active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => startEdit(deal)}
                    className="px-3 py-1.5 text-xs border border-[#555] text-gray-300 hover:text-[#f5a623] hover:border-[#f5a623] rounded-lg transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(deal.id)}
                    className="px-3 py-1.5 text-xs border border-[#555] text-red-400 hover:bg-red-900/30 hover:border-red-500 rounded-lg transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
