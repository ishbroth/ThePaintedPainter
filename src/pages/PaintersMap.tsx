import { useState } from 'react';
import { MapPin, Star, Phone, Mail } from 'lucide-react';

interface Painter {
  id: number;
  name: string;
  location: string;
  state: string;
  rating: number;
  reviews: number;
  specialties: string[];
  yearsExperience: number;
  image: string;
}

const painters: Painter[] = [
  {
    id: 1,
    name: 'Mike Johnson',
    location: 'San Diego, CA',
    state: 'CA',
    rating: 4.9,
    reviews: 127,
    specialties: ['Interior', 'Exterior', 'Cabinets'],
    yearsExperience: 15,
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200',
  },
  {
    id: 2,
    name: 'Sarah Martinez',
    location: 'Los Angeles, CA',
    state: 'CA',
    rating: 4.8,
    reviews: 98,
    specialties: ['Interior', 'Decorative'],
    yearsExperience: 12,
    image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200',
  },
  {
    id: 3,
    name: 'David Chen',
    location: 'Phoenix, AZ',
    state: 'AZ',
    rating: 4.9,
    reviews: 156,
    specialties: ['Exterior', 'Stucco', 'Commercial'],
    yearsExperience: 20,
    image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200',
  },
  {
    id: 4,
    name: 'Emily Thompson',
    location: 'Denver, CO',
    state: 'CO',
    rating: 4.7,
    reviews: 84,
    specialties: ['Interior', 'Cabinets'],
    yearsExperience: 8,
    image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200',
  },
  {
    id: 5,
    name: 'James Wilson',
    location: 'Austin, TX',
    state: 'TX',
    rating: 4.8,
    reviews: 112,
    specialties: ['Interior', 'Exterior', 'Epoxy'],
    yearsExperience: 18,
    image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200',
  },
  {
    id: 6,
    name: 'Maria Garcia',
    location: 'Miami, FL',
    state: 'FL',
    rating: 4.9,
    reviews: 143,
    specialties: ['Exterior', 'Commercial', 'Waterproofing'],
    yearsExperience: 14,
    image: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200',
  },
  {
    id: 7,
    name: 'Robert Brown',
    location: 'Seattle, WA',
    state: 'WA',
    rating: 4.7,
    reviews: 76,
    specialties: ['Interior', 'Exterior'],
    yearsExperience: 10,
    image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200',
  },
  {
    id: 8,
    name: 'Jennifer Lee',
    location: 'Portland, OR',
    state: 'OR',
    rating: 4.8,
    reviews: 91,
    specialties: ['Interior', 'Decorative', 'Murals'],
    yearsExperience: 11,
    image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
  },
];

const states = ['All States', 'AZ', 'CA', 'CO', 'FL', 'OR', 'TX', 'WA'];

const PaintersMap = () => {
  const [selectedState, setSelectedState] = useState('All States');
  const [selectedPainter, setSelectedPainter] = useState<Painter | null>(null);

  const filteredPainters = selectedState === 'All States'
    ? painters
    : painters.filter(p => p.state === selectedState);

  return (
    <div>
      {/* Hero */}
      <section className="bg-primary text-white py-20">
        <div className="container-custom">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Painter's Map</h1>
          <p className="text-xl text-gray-200 max-w-2xl">
            Meet our network of trusted, vetted painters across the country. Quality work, wherever you are.
          </p>
        </div>
      </section>

      {/* Map Section */}
      <section className="section-padding">
        <div className="container-custom">
          {/* Filter */}
          <div className="mb-8 flex flex-wrap items-center gap-4">
            <span className="font-medium text-gray-700">Filter by state:</span>
            <div className="flex flex-wrap gap-2">
              {states.map((state) => (
                <button
                  key={state}
                  onClick={() => setSelectedState(state)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    selectedState === state
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {state}
                </button>
              ))}
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Map Placeholder */}
            <div className="lg:col-span-2">
              <div className="bg-gray-100 rounded-xl h-[500px] relative overflow-hidden">
                {/* Simplified US Map representation */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <MapPin className="w-16 h-16 text-secondary mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">Interactive Map Coming Soon</h3>
                    <p className="text-gray-500 max-w-md">
                      View our painters across the country. Currently serving {painters.length} locations nationwide.
                    </p>
                  </div>
                </div>

                {/* Painter markers (simplified positions) */}
                <div className="absolute inset-0">
                  {filteredPainters.map((painter, index) => (
                    <button
                      key={painter.id}
                      className={`absolute transform -translate-x-1/2 -translate-y-1/2 transition-all ${
                        selectedPainter?.id === painter.id ? 'scale-125 z-10' : ''
                      }`}
                      style={{
                        left: `${20 + (index % 4) * 20}%`,
                        top: `${25 + Math.floor(index / 4) * 35}%`,
                      }}
                      onClick={() => setSelectedPainter(painter)}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg ${
                        selectedPainter?.id === painter.id ? 'bg-secondary' : 'bg-primary'
                      }`}>
                        <MapPin className="text-white" size={20} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Painter Details / List */}
            <div>
              {selectedPainter ? (
                <div className="card p-6">
                  <button
                    onClick={() => setSelectedPainter(null)}
                    className="text-sm text-gray-500 hover:text-primary mb-4"
                  >
                    ← Back to list
                  </button>
                  <img
                    src={selectedPainter.image}
                    alt={selectedPainter.name}
                    className="w-24 h-24 rounded-full object-cover mx-auto mb-4"
                  />
                  <h3 className="text-xl font-bold text-primary text-center mb-1">{selectedPainter.name}</h3>
                  <p className="text-gray-500 text-center mb-4">{selectedPainter.location}</p>

                  <div className="flex items-center justify-center gap-1 mb-4">
                    <Star className="text-yellow-500 fill-yellow-500" size={18} />
                    <span className="font-semibold">{selectedPainter.rating}</span>
                    <span className="text-gray-500">({selectedPainter.reviews} reviews)</span>
                  </div>

                  <div className="space-y-3 mb-6">
                    <div>
                      <span className="text-sm font-medium text-gray-700">Experience:</span>
                      <span className="ml-2 text-gray-600">{selectedPainter.yearsExperience} years</span>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-700">Specialties:</span>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {selectedPainter.specialties.map((s) => (
                          <span key={s} className="px-2 py-1 bg-gray-100 rounded text-sm text-gray-600">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <a href="tel:6197242702" className="btn-secondary w-full inline-flex items-center justify-center gap-2">
                      <Phone size={18} />
                      Request This Painter
                    </a>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                  <h3 className="font-semibold text-gray-700 sticky top-0 bg-white py-2">
                    {filteredPainters.length} Painters Found
                  </h3>
                  {filteredPainters.map((painter) => (
                    <div
                      key={painter.id}
                      className="card p-4 cursor-pointer hover:shadow-lg transition-shadow"
                      onClick={() => setSelectedPainter(painter)}
                    >
                      <div className="flex gap-4">
                        <img
                          src={painter.image}
                          alt={painter.name}
                          className="w-16 h-16 rounded-full object-cover"
                        />
                        <div className="flex-1">
                          <h4 className="font-semibold text-primary">{painter.name}</h4>
                          <p className="text-sm text-gray-500">{painter.location}</p>
                          <div className="flex items-center gap-1 mt-1">
                            <Star className="text-yellow-500 fill-yellow-500" size={14} />
                            <span className="text-sm font-medium">{painter.rating}</span>
                            <span className="text-xs text-gray-400">({painter.reviews})</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Join Network CTA */}
      <section className="bg-gray-50 py-16">
        <div className="container-custom text-center">
          <h2 className="text-3xl font-bold text-primary mb-4">Are You a Professional Painter?</h2>
          <p className="text-gray-600 mb-8 max-w-xl mx-auto">
            Join our network of trusted painters and get connected with customers in your area.
          </p>
          <a href="mailto:painters@thepaintedpainter.com" className="btn-secondary inline-flex items-center gap-2">
            <Mail size={20} />
            Apply to Join Our Network
          </a>
        </div>
      </section>
    </div>
  );
};

export default PaintersMap;
