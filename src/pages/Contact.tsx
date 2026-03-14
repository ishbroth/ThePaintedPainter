import { Phone, Mail, MapPin, Clock } from 'lucide-react';
import EstimatorPanel from '../components/EstimatorPanel/EstimatorPanel';

const Contact = () => {
  return (
    <div>
      {/* Hero */}
      <section className="bg-primary text-white py-20">
        <div className="container-custom">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Get Your Free Estimate</h1>
          <p className="text-xl text-gray-200 max-w-2xl">
            Answer a few questions and get an instant ballpark estimate for your painting project.
          </p>
        </div>
      </section>

      {/* Estimator + Contact Info */}
      <section className="section-padding" style={{ background: '#222' }}>
        <div className="container-custom">
          <div className="estimator-layout">
            {/* Estimator Panel - 2/3 */}
            <div className="estimator-main">
              <EstimatorPanel />
            </div>

            {/* Contact Info Sidebar - 1/3 */}
            <div className="estimator-sidebar">
              <div className="estimator-sidebar-card">
                <h3 className="estimator-sidebar-title">Contact Us Directly</h3>

                <a href="tel:6197242702" className="estimator-sidebar-item">
                  <div className="estimator-sidebar-icon">
                    <Phone size={20} />
                  </div>
                  <div>
                    <strong>Phone</strong>
                    <p>(619) 724-2702</p>
                    <span>Call or text anytime</span>
                  </div>
                </a>

                <a href="mailto:info@thepaintedpainter.com" className="estimator-sidebar-item">
                  <div className="estimator-sidebar-icon">
                    <Mail size={20} />
                  </div>
                  <div>
                    <strong>Email</strong>
                    <p>info@thepaintedpainter.com</p>
                    <span>We'll respond within 24 hours</span>
                  </div>
                </a>

                <div className="estimator-sidebar-item">
                  <div className="estimator-sidebar-icon">
                    <MapPin size={20} />
                  </div>
                  <div>
                    <strong>Location</strong>
                    <p>San Diego, CA</p>
                    <span>Serving all neighborhoods</span>
                  </div>
                </div>

                <div className="estimator-sidebar-item">
                  <div className="estimator-sidebar-icon">
                    <Clock size={20} />
                  </div>
                  <div>
                    <strong>Hours</strong>
                    <p>Mon - Fri: 7am - 6pm</p>
                    <p>Sat: 8am - 4pm</p>
                    <span>Sunday by appointment</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Contact;
