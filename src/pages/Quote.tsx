import { useState } from 'react';
import { ArrowRight, ArrowLeft, MapPin, Home, Building, Check } from 'lucide-react';

type QuoteStep = 'address' | 'property-type' | 'project-type' | 'interior' | 'exterior' | 'details' | 'contact' | 'result';

interface QuoteData {
  address: string;
  zipCode: string;
  propertyType: 'residential' | 'commercial' | null;
  commercialType: string;
  projectType: 'interior' | 'exterior' | 'both' | null;
  // Interior options
  rooms: string[];
  walls: boolean;
  ceilings: boolean;
  trim: boolean;
  doors: boolean;
  cabinets: boolean;
  colorChange: boolean;
  // Exterior options
  sidingType: string;
  exteriorTrim: boolean;
  deck: boolean;
  fence: boolean;
  garageDoor: boolean;
  // Details
  squareFootage: string;
  stories: string;
  condition: string;
  vacant: boolean;
  timeline: string;
  // Contact
  name: string;
  email: string;
  phone: string;
  notes: string;
}

const Quote = () => {
  const [step, setStep] = useState<QuoteStep>('address');
  const [data, setData] = useState<QuoteData>({
    address: '',
    zipCode: '',
    propertyType: null,
    commercialType: '',
    projectType: null,
    rooms: [],
    walls: true,
    ceilings: false,
    trim: false,
    doors: false,
    cabinets: false,
    colorChange: false,
    sidingType: '',
    exteriorTrim: false,
    deck: false,
    fence: false,
    garageDoor: false,
    squareFootage: '',
    stories: '1',
    condition: 'good',
    vacant: false,
    timeline: 'flexible',
    name: '',
    email: '',
    phone: '',
    notes: '',
  });

  const updateData = (updates: Partial<QuoteData>) => {
    setData(prev => ({ ...prev, ...updates }));
  };

  const toggleRoom = (room: string) => {
    setData(prev => ({
      ...prev,
      rooms: prev.rooms.includes(room)
        ? prev.rooms.filter(r => r !== room)
        : [...prev.rooms, room]
    }));
  };

  const calculateEstimate = () => {
    // Base rates per sq ft
    let baseRate = 2.5; // Interior per sq ft
    const sqft = parseInt(data.squareFootage) || 1500;

    let total = 0;

    if (data.projectType === 'interior' || data.projectType === 'both') {
      let interiorRate = baseRate;
      if (data.ceilings) interiorRate += 0.5;
      if (data.trim) interiorRate += 0.3;
      if (data.doors) interiorRate += 0.2;
      if (data.colorChange) interiorRate += 0.3;
      total += sqft * interiorRate;
      if (data.cabinets) total += 2500; // Cabinet painting estimate
    }

    if (data.projectType === 'exterior' || data.projectType === 'both') {
      let exteriorRate = 3.0; // Higher for exterior
      if (data.exteriorTrim) exteriorRate += 0.4;
      if (parseInt(data.stories) > 1) exteriorRate += 0.5;
      total += sqft * exteriorRate;
      if (data.deck) total += 800;
      if (data.fence) total += 600;
      if (data.garageDoor) total += 350;
    }

    // Condition multiplier
    if (data.condition === 'minor-repair') total *= 1.15;
    if (data.condition === 'major-repair') total *= 1.35;

    // Zip code adjustment (simplified - would use real data)
    const zipPrefix = data.zipCode.substring(0, 3);
    const highCostZips = ['921', '920', '902', '900', '941', '940']; // CA coastal areas
    if (highCostZips.includes(zipPrefix)) total *= 1.2;

    return Math.round(total);
  };

  const nextStep = () => {
    const steps: QuoteStep[] = ['address', 'property-type', 'project-type', 'interior', 'exterior', 'details', 'contact', 'result'];
    const currentIndex = steps.indexOf(step);

    // Skip interior/exterior based on selection
    if (step === 'project-type') {
      if (data.projectType === 'interior') {
        setStep('interior');
        return;
      } else if (data.projectType === 'exterior') {
        setStep('exterior');
        return;
      } else {
        setStep('interior');
        return;
      }
    }

    if (step === 'interior' && data.projectType === 'interior') {
      setStep('details');
      return;
    }

    if (step === 'interior' && data.projectType === 'both') {
      setStep('exterior');
      return;
    }

    if (step === 'exterior') {
      setStep('details');
      return;
    }

    if (currentIndex < steps.length - 1) {
      setStep(steps[currentIndex + 1]);
    }
  };

  const prevStep = () => {
    const steps: QuoteStep[] = ['address', 'property-type', 'project-type', 'interior', 'exterior', 'details', 'contact', 'result'];
    const currentIndex = steps.indexOf(step);

    if (step === 'exterior' && data.projectType === 'both') {
      setStep('interior');
      return;
    }

    if (step === 'exterior' && data.projectType === 'exterior') {
      setStep('project-type');
      return;
    }

    if (step === 'details' && data.projectType === 'interior') {
      setStep('interior');
      return;
    }

    if (step === 'details' && (data.projectType === 'exterior' || data.projectType === 'both')) {
      setStep('exterior');
      return;
    }

    if (currentIndex > 0) {
      setStep(steps[currentIndex - 1]);
    }
  };

  const rooms = [
    'Living Room', 'Dining Room', 'Kitchen', 'Master Bedroom',
    'Bedroom 2', 'Bedroom 3', 'Bedroom 4', 'Bathroom',
    'Master Bathroom', 'Hallway', 'Stairway', 'Office/Den',
    'Basement', 'Garage Interior', 'Laundry Room', 'Entryway'
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <section className="bg-primary text-white py-12">
        <div className="container-custom">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Get Your Instant Quote</h1>
          <p className="text-gray-200">Answer a few questions and we'll provide an estimate in seconds.</p>
        </div>
      </section>

      {/* Progress Bar */}
      <div className="bg-white border-b">
        <div className="container-custom py-4">
          <div className="flex items-center justify-between max-w-2xl mx-auto">
            {['Address', 'Property', 'Project', 'Details', 'Contact', 'Quote'].map((label, index) => (
              <div key={label} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                  index <= ['address', 'property-type', 'project-type', 'details', 'contact', 'result'].indexOf(step)
                    ? 'bg-secondary text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}>
                  {index + 1}
                </div>
                {index < 5 && <div className={`w-8 md:w-16 h-1 mx-1 ${
                  index < ['address', 'property-type', 'project-type', 'details', 'contact', 'result'].indexOf(step)
                    ? 'bg-secondary'
                    : 'bg-gray-200'
                }`} />}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="container-custom py-12">
        <div className="max-w-2xl mx-auto">
          <div className="card p-8">
            {/* Address Step */}
            {step === 'address' && (
              <div>
                <h2 className="text-2xl font-bold text-primary mb-6">Where is your property located?</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                      <input
                        type="text"
                        className="input-field pl-10"
                        placeholder="123 Main Street"
                        value={data.address}
                        onChange={(e) => updateData({ address: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ZIP Code</label>
                    <input
                      type="text"
                      className="input-field max-w-[200px]"
                      placeholder="92101"
                      maxLength={5}
                      value={data.zipCode}
                      onChange={(e) => updateData({ zipCode: e.target.value.replace(/\D/g, '') })}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Property Type Step */}
            {step === 'property-type' && (
              <div>
                <h2 className="text-2xl font-bold text-primary mb-6">What type of property is this?</h2>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    className={`p-6 rounded-lg border-2 transition-all ${
                      data.propertyType === 'residential'
                        ? 'border-secondary bg-secondary/10'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => updateData({ propertyType: 'residential' })}
                  >
                    <Home className={`w-12 h-12 mx-auto mb-3 ${data.propertyType === 'residential' ? 'text-secondary' : 'text-gray-400'}`} />
                    <span className="font-semibold">Residential</span>
                    <p className="text-sm text-gray-500 mt-1">Home, condo, apartment</p>
                  </button>
                  <button
                    className={`p-6 rounded-lg border-2 transition-all ${
                      data.propertyType === 'commercial'
                        ? 'border-secondary bg-secondary/10'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => updateData({ propertyType: 'commercial' })}
                  >
                    <Building className={`w-12 h-12 mx-auto mb-3 ${data.propertyType === 'commercial' ? 'text-secondary' : 'text-gray-400'}`} />
                    <span className="font-semibold">Commercial</span>
                    <p className="text-sm text-gray-500 mt-1">Office, retail, restaurant</p>
                  </button>
                </div>

                {data.propertyType === 'commercial' && (
                  <div className="mt-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Type of business</label>
                    <select
                      className="input-field"
                      value={data.commercialType}
                      onChange={(e) => updateData({ commercialType: e.target.value })}
                    >
                      <option value="">Select type...</option>
                      <option value="restaurant">Restaurant</option>
                      <option value="retail">Retail Store</option>
                      <option value="office">Office Space</option>
                      <option value="gas-station">Gas Station</option>
                      <option value="strip-mall">Strip Mall Unit</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Project Type Step */}
            {step === 'project-type' && (
              <div>
                <h2 className="text-2xl font-bold text-primary mb-6">What are you looking to paint?</h2>
                <div className="space-y-4">
                  {[
                    { value: 'interior', label: 'Interior Only', desc: 'Walls, ceilings, trim, doors inside' },
                    { value: 'exterior', label: 'Exterior Only', desc: 'Outside walls, trim, deck, fence' },
                    { value: 'both', label: 'Both Interior & Exterior', desc: 'Complete inside and outside' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                        data.projectType === option.value
                          ? 'border-secondary bg-secondary/10'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => updateData({ projectType: option.value as 'interior' | 'exterior' | 'both' })}
                    >
                      <span className="font-semibold">{option.label}</span>
                      <p className="text-sm text-gray-500">{option.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Interior Options Step */}
            {step === 'interior' && (
              <div>
                <h2 className="text-2xl font-bold text-primary mb-6">Interior Details</h2>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-3">Which rooms need painting?</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {rooms.map((room) => (
                      <button
                        key={room}
                        className={`px-3 py-2 rounded-lg text-sm transition-all ${
                          data.rooms.includes(room)
                            ? 'bg-secondary text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                        onClick={() => toggleRoom(room)}
                      >
                        {room}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-3">What needs to be painted?</label>
                  <div className="space-y-3">
                    {[
                      { key: 'walls', label: 'Walls' },
                      { key: 'ceilings', label: 'Ceilings' },
                      { key: 'trim', label: 'Trim / Baseboards' },
                      { key: 'doors', label: 'Doors' },
                      { key: 'cabinets', label: 'Kitchen/Bathroom Cabinets' },
                    ].map((item) => (
                      <label key={item.key} className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          className="w-5 h-5 text-secondary rounded"
                          checked={data[item.key as keyof QuoteData] as boolean}
                          onChange={(e) => updateData({ [item.key]: e.target.checked })}
                        />
                        <span>{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-5 h-5 text-secondary rounded"
                      checked={data.colorChange}
                      onChange={(e) => updateData({ colorChange: e.target.checked })}
                    />
                    <span>Changing colors (dark to light or vice versa)?</span>
                  </label>
                  <p className="text-sm text-gray-500 ml-8">This may require additional coats</p>
                </div>
              </div>
            )}

            {/* Exterior Options Step */}
            {step === 'exterior' && (
              <div>
                <h2 className="text-2xl font-bold text-primary mb-6">Exterior Details</h2>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Siding Type</label>
                  <select
                    className="input-field"
                    value={data.sidingType}
                    onChange={(e) => updateData({ sidingType: e.target.value })}
                  >
                    <option value="">Select siding type...</option>
                    <option value="stucco">Stucco</option>
                    <option value="wood">Wood</option>
                    <option value="vinyl">Vinyl</option>
                    <option value="brick">Brick</option>
                    <option value="fiber-cement">Fiber Cement (Hardie)</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-3">What else needs painting?</label>
                  <div className="space-y-3">
                    {[
                      { key: 'exteriorTrim', label: 'Trim, Fascia & Soffits' },
                      { key: 'garageDoor', label: 'Garage Door(s)' },
                      { key: 'deck', label: 'Deck / Patio' },
                      { key: 'fence', label: 'Fence' },
                    ].map((item) => (
                      <label key={item.key} className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          className="w-5 h-5 text-secondary rounded"
                          checked={data[item.key as keyof QuoteData] as boolean}
                          onChange={(e) => updateData({ [item.key]: e.target.checked })}
                        />
                        <span>{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Details Step */}
            {step === 'details' && (
              <div>
                <h2 className="text-2xl font-bold text-primary mb-6">A few more details</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Approximate Square Footage</label>
                    <input
                      type="number"
                      className="input-field"
                      placeholder="1500"
                      value={data.squareFootage}
                      onChange={(e) => updateData({ squareFootage: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Number of Stories</label>
                    <select
                      className="input-field"
                      value={data.stories}
                      onChange={(e) => updateData({ stories: e.target.value })}
                    >
                      <option value="1">1 Story</option>
                      <option value="2">2 Stories</option>
                      <option value="3">3+ Stories</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Current Condition</label>
                    <select
                      className="input-field"
                      value={data.condition}
                      onChange={(e) => updateData({ condition: e.target.value })}
                    >
                      <option value="good">Good - Just needs fresh paint</option>
                      <option value="minor-repair">Minor repairs needed (patching, caulking)</option>
                      <option value="major-repair">Major repairs needed (wood rot, extensive damage)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Timeline</label>
                    <select
                      className="input-field"
                      value={data.timeline}
                      onChange={(e) => updateData({ timeline: e.target.value })}
                    >
                      <option value="asap">ASAP</option>
                      <option value="2-weeks">Within 2 weeks</option>
                      <option value="1-month">Within 1 month</option>
                      <option value="flexible">Flexible</option>
                    </select>
                  </div>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-5 h-5 text-secondary rounded"
                      checked={data.vacant}
                      onChange={(e) => updateData({ vacant: e.target.checked })}
                    />
                    <span>Property will be vacant during painting</span>
                  </label>
                </div>
              </div>
            )}

            {/* Contact Step */}
            {step === 'contact' && (
              <div>
                <h2 className="text-2xl font-bold text-primary mb-6">Almost done! Your contact info</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="Your name"
                      value={data.name}
                      onChange={(e) => updateData({ name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      className="input-field"
                      placeholder="your@email.com"
                      value={data.email}
                      onChange={(e) => updateData({ email: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input
                      type="tel"
                      className="input-field"
                      placeholder="(555) 555-5555"
                      value={data.phone}
                      onChange={(e) => updateData({ phone: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Additional Notes (optional)</label>
                    <textarea
                      className="input-field resize-none"
                      rows={3}
                      placeholder="Any other details about your project..."
                      value={data.notes}
                      onChange={(e) => updateData({ notes: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Result Step */}
            {step === 'result' && (
              <div className="text-center">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Check className="w-10 h-10 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-primary mb-2">Your Estimate is Ready!</h2>
                <p className="text-gray-600 mb-8">Based on your project details, here's your estimated cost:</p>

                <div className="bg-gray-50 rounded-xl p-8 mb-8">
                  <div className="text-sm text-gray-500 mb-2">Estimated Total</div>
                  <div className="text-5xl font-bold text-primary mb-2">
                    ${calculateEstimate().toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-500">
                    Range: ${Math.round(calculateEstimate() * 0.85).toLocaleString()} - ${Math.round(calculateEstimate() * 1.15).toLocaleString()}
                  </div>
                </div>

                <p className="text-sm text-gray-500 mb-6">
                  This is an estimate based on average costs. Final pricing may vary based on an in-person assessment.
                </p>

                <div className="space-y-3">
                  <a href="tel:6197242702" className="btn-secondary w-full inline-flex items-center justify-center gap-2">
                    Call to Confirm: (619) 724-2702
                  </a>
                  <button
                    onClick={() => setStep('address')}
                    className="btn-outline w-full"
                  >
                    Start New Quote
                  </button>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            {step !== 'result' && (
              <div className="flex justify-between mt-8 pt-6 border-t">
                {step !== 'address' ? (
                  <button
                    onClick={prevStep}
                    className="flex items-center gap-2 text-gray-600 hover:text-primary transition-colors"
                  >
                    <ArrowLeft size={20} />
                    Back
                  </button>
                ) : (
                  <div />
                )}
                <button
                  onClick={nextStep}
                  className="btn-secondary inline-flex items-center gap-2"
                  disabled={
                    (step === 'address' && (!data.address || !data.zipCode)) ||
                    (step === 'property-type' && !data.propertyType) ||
                    (step === 'project-type' && !data.projectType) ||
                    (step === 'contact' && (!data.name || !data.email || !data.phone))
                  }
                >
                  {step === 'contact' ? 'Get My Quote' : 'Continue'}
                  <ArrowRight size={20} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Quote;
