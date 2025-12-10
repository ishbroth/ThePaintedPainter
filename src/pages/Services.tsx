import { Link } from 'react-router-dom';
import { ArrowRight, Home, Building, Paintbrush, Droplets } from 'lucide-react';

const Services = () => {
  const services = [
    {
      icon: <Home className="w-12 h-12" />,
      title: 'Interior Painting',
      description: 'Transform your living spaces with professional interior painting. We handle walls, ceilings, trim, doors, and more.',
      features: ['Wall painting', 'Ceiling painting', 'Trim & baseboards', 'Door painting', 'Accent walls', 'Color consultation'],
    },
    {
      icon: <Building className="w-12 h-12" />,
      title: 'Exterior Painting',
      description: 'Boost your curb appeal with a fresh exterior paint job. We work with all siding types and handle prep work.',
      features: ['House painting', 'Trim & fascia', 'Deck staining', 'Fence painting', 'Pressure washing', 'Wood repair'],
    },
    {
      icon: <Paintbrush className="w-12 h-12" />,
      title: 'Cabinet Painting',
      description: 'Give your kitchen or bathroom a complete makeover with professionally painted cabinets.',
      features: ['Kitchen cabinets', 'Bathroom vanities', 'Built-in shelving', 'Proper prep & prime', 'Durable finishes', 'Hardware removal'],
    },
    {
      icon: <Droplets className="w-12 h-12" />,
      title: 'Garage Epoxy',
      description: 'Protect and beautify your garage floor with durable epoxy coatings.',
      features: ['Floor preparation', 'Crack repair', 'Epoxy application', 'Decorative flakes', 'Clear topcoat', 'Long-lasting protection'],
    },
  ];

  const commercialServices = [
    'Restaurants',
    'Retail stores',
    'Office spaces',
    'Gas stations',
    'Strip mall units',
    'Small warehouses',
  ];

  return (
    <div>
      {/* Hero */}
      <section className="bg-primary text-white py-20">
        <div className="container-custom">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Our Services</h1>
          <p className="text-xl text-gray-200 max-w-2xl">
            Professional painting services for residential and commercial properties.
          </p>
        </div>
      </section>

      {/* Residential Services */}
      <section className="section-padding">
        <div className="container-custom">
          <h2 className="text-3xl font-bold text-primary mb-4">Residential Services</h2>
          <p className="text-gray-600 mb-12 max-w-2xl">
            From single rooms to whole-house makeovers, we have the expertise to handle any residential painting project.
          </p>

          <div className="grid md:grid-cols-2 gap-8">
            {services.map((service, index) => (
              <div key={index} className="card p-8">
                <div className="text-secondary mb-4">{service.icon}</div>
                <h3 className="text-2xl font-bold text-primary mb-3">{service.title}</h3>
                <p className="text-gray-600 mb-4">{service.description}</p>
                <ul className="grid grid-cols-2 gap-2">
                  {service.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm text-gray-600">
                      <span className="w-1.5 h-1.5 bg-secondary rounded-full"></span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Commercial Services */}
      <section className="section-padding bg-gray-50">
        <div className="container-custom">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-primary mb-4">Commercial Services</h2>
              <p className="text-gray-600 mb-6">
                We also serve small to medium commercial properties. Our flexible scheduling allows us to work around your business hours to minimize disruption.
              </p>
              <ul className="grid grid-cols-2 gap-3 mb-6">
                {commercialServices.map((service, index) => (
                  <li key={index} className="flex items-center gap-2 text-gray-700">
                    <span className="w-2 h-2 bg-secondary rounded-full"></span>
                    {service}
                  </li>
                ))}
              </ul>
              <Link to="/quote" className="btn-secondary inline-flex items-center gap-2">
                Get Commercial Quote
                <ArrowRight size={20} />
              </Link>
            </div>
            <div className="bg-primary rounded-xl p-8 text-white">
              <h3 className="text-2xl font-bold mb-4">Why Businesses Choose Us</h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <span className="text-secondary mt-1">✓</span>
                  Flexible scheduling around business hours
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-secondary mt-1">✓</span>
                  Quick turnarounds to minimize downtime
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-secondary mt-1">✓</span>
                  Licensed and fully insured
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-secondary mt-1">✓</span>
                  Competitive commercial pricing
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-secondary py-16">
        <div className="container-custom text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to Get Started?</h2>
          <p className="text-white/90 mb-8 max-w-xl mx-auto">
            Get an instant quote by answering a few simple questions about your project.
          </p>
          <Link to="/quote" className="bg-white text-primary px-8 py-4 rounded-lg font-semibold hover:bg-gray-100 transition-colors inline-flex items-center gap-2">
            Get Your Free Quote
            <ArrowRight size={20} />
          </Link>
        </div>
      </section>
    </div>
  );
};

export default Services;
