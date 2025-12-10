import { Link } from 'react-router-dom';
import { ArrowRight, Star, CheckCircle, Clock, Shield, Users } from 'lucide-react';
import PortfolioCarousel from '../components/PortfolioCarousel';

const Home = () => {
  const features = [
    {
      icon: <Clock className="w-8 h-8" />,
      title: 'Fast & Efficient',
      description: '18+ years of experience with streamlined processes for quick turnarounds.',
    },
    {
      icon: <Shield className="w-8 h-8" />,
      title: 'Licensed & Insured',
      description: 'Fully licensed contractor (#1019026) with comprehensive insurance coverage.',
    },
    {
      icon: <Star className="w-8 h-8" />,
      title: 'Quality Products',
      description: 'We use only premium paints and materials for lasting results.',
    },
    {
      icon: <Users className="w-8 h-8" />,
      title: 'Nationwide Network',
      description: 'Access to trusted painters across the country through our network.',
    },
  ];

  const services = [
    { name: 'Interior Painting', image: 'https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=400' },
    { name: 'Exterior Painting', image: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=400' },
    { name: 'Cabinet Painting', image: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400' },
    { name: 'Garage Epoxy', image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400' },
  ];

  return (
    <div>
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary to-primary-dark text-white py-20 md:py-32">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="container-custom relative z-10">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Fast & Affordable
              <span className="block text-secondary">Interior & Exterior Painting</span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-200 mb-8">
              Transform your home with professional painting services.
              Get an instant quote in minutes, not days.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/quote" className="btn-secondary inline-flex items-center justify-center gap-2">
                Get Instant Quote
                <ArrowRight size={20} />
              </Link>
              <a href="tel:6197242702" className="btn-outline border-white text-white hover:bg-white hover:text-primary inline-flex items-center justify-center gap-2">
                Call (619) 724-2702
              </a>
            </div>

            {/* Trust indicators */}
            <div className="flex flex-wrap items-center gap-6 mt-10 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle className="text-secondary" size={20} />
                <span>Licensed #1019026</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="text-secondary" size={20} />
                <span>18+ Years Experience</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="text-secondary" size={20} />
                <span>Free Estimates</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="section-padding bg-gray-50">
        <div className="container-custom">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-primary mb-4">
              Why Choose The Painted Painter?
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              We've engineered hundreds of painting projects with efficient methods and quality products.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="card p-6 text-center hover:shadow-xl transition-shadow">
                <div className="text-secondary mb-4 flex justify-center">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold text-primary mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Portfolio Carousel */}
      <section className="section-padding">
        <div className="container-custom">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-primary mb-4">
              Our Recent Work
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Browse through some of our recent painting projects across San Diego and beyond.
            </p>
          </div>
          <PortfolioCarousel />
          <div className="text-center mt-8">
            <Link to="/gallery" className="btn-outline inline-flex items-center gap-2">
              View Full Gallery
              <ArrowRight size={20} />
            </Link>
          </div>
        </div>
      </section>

      {/* Services Preview */}
      <section className="section-padding bg-gray-50">
        <div className="container-custom">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-primary mb-4">
              Our Services
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              From interior walls to exterior facades, we handle all your painting needs.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {services.map((service, index) => (
              <div key={index} className="card group cursor-pointer">
                <div className="relative overflow-hidden h-48">
                  <img
                    src={service.image}
                    alt={service.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-primary/60 flex items-center justify-center">
                    <h3 className="text-white text-xl font-semibold">{service.name}</h3>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-8">
            <Link to="/services" className="btn-primary inline-flex items-center gap-2">
              View All Services
              <ArrowRight size={20} />
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-secondary py-16">
        <div className="container-custom text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Transform Your Space?
          </h2>
          <p className="text-white/90 text-lg mb-8 max-w-2xl mx-auto">
            Get an instant quote in minutes. Answer a few questions and we'll provide you with a competitive estimate.
          </p>
          <Link to="/quote" className="bg-white text-primary px-8 py-4 rounded-lg font-semibold hover:bg-gray-100 transition-colors inline-flex items-center gap-2">
            Get Your Free Quote Now
            <ArrowRight size={20} />
          </Link>
        </div>
      </section>
    </div>
  );
};

export default Home;
