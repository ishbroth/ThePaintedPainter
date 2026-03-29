import { Link } from 'react-router-dom';

const About = () => {
  return (
    <div className="bg-[#1a1a1a] text-white">
      {/* Hero */}
      <section className="bg-[#111] text-white py-16 border-b border-[#333]">
        <div className="container-custom text-center">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">San Diego's Underground Painting Company</h1>
          <p className="text-gray-400">Professional. Reliable. Veteran-Owned.</p>
        </div>
      </section>

      {/* About Content */}
      <section className="py-12">
        <div className="container-custom max-w-3xl">
          <h2 className="text-2xl font-bold mb-6 text-center">About The Painted Painter</h2>

          <p className="text-gray-300 mb-6 leading-relaxed">
            The Painted Painter provides comprehensive painting services throughout San Diego for residential and commercial properties. Our services include interior and exterior painting, kitchen and bathroom updates, cabinet refinishing, garage floors, powerwashing, and wallpaper removal.
          </p>

          <h3 className="text-xl font-bold mb-4 mt-8">Our Quote Process</h3>
          <p className="text-gray-300 mb-4">Getting an estimate is easy:</p>
          <ul className="text-gray-300 mb-6 list-disc ml-6 space-y-2">
            <li>Text or call us at <a href="tel:6197242702" className="text-[#74b9ff] hover:underline">(619) 724-2702</a></li>
            <li>Submit photos and descriptions online through our <Link to="/quote" className="text-[#74b9ff] hover:underline">quote form</Link></li>
            <li>Request a walkthrough for complex projects</li>
            <li>Typically receive estimates within one business day</li>
            <li>Scheduling typically occurs 3-5 weeks out</li>
          </ul>

          <h3 className="text-xl font-bold mb-4 mt-8">What's Included</h3>
          <p className="text-gray-300 mb-4">Every project includes:</p>
          <ul className="text-gray-300 mb-6 list-disc ml-6 space-y-2">
            <li>All paint and necessary materials, tools, and equipment including ladders and protective gear</li>
            <li>Surface protection and floor coverings</li>
            <li>Prep work including priming and pressure washing</li>
            <li>Minor surface repairs using our "build-back-better approach"</li>
            <li>Standard 2-coat application</li>
            <li>Work by skilled professionals during business hours</li>
          </ul>

          <h3 className="text-xl font-bold mb-4 mt-8">Quality Products</h3>
          <p className="text-gray-300 mb-6 leading-relaxed">
            We use only consumer-reviewed, science-backed products (typically Behr brand). We offer a 14-day callback period for touch-ups and cover product failures for up to one year.
          </p>
        </div>
      </section>

      {/* Process Section */}
      <section className="py-12 bg-[#222] text-white">
        <div className="container-custom">
          <h2 className="text-2xl font-bold mb-8 text-center">Our Process</h2>
          <div className="grid md:grid-cols-5 gap-6 max-w-4xl mx-auto">
            {[
              { num: '1', title: 'Get a Quote', desc: 'Contact us with your project details. Send photos via text or our online form for a quick estimate.' },
              { num: '2', title: 'Schedule', desc: 'Once approved, we\'ll schedule your project. Typical lead time is 3-5 weeks.' },
              { num: '3', title: 'Preparation', desc: 'We prep surfaces, protect floors and furniture, and ensure everything is ready for paint.' },
              { num: '4', title: 'Paint', desc: 'Professional application with quality products. Standard 2-coat coverage for lasting results.' },
              { num: '5', title: 'Final Walkthrough', desc: 'We do a final inspection together. 14-day callback period for any touch-ups needed.' },
            ].map((step) => (
              <div key={step.num} className="text-center">
                <div className="w-12 h-12 bg-[#f5a623] text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                  {step.num}
                </div>
                <h4 className="font-bold mb-2">{step.title}</h4>
                <p className="text-sm text-gray-400">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-12">
        <div className="container-custom max-w-3xl">
          <h2 className="text-2xl font-bold mb-6 text-center">Pricing & Payment</h2>
          <ul className="text-gray-300 mb-6 list-disc ml-6 space-y-2">
            <li>No upfront payment until project start</li>
            <li>10% deposit collected at project start</li>
            <li>Potential 20% materials draw mid-project</li>
            <li>Balance due upon completion</li>
          </ul>

          <h3 className="text-xl font-bold mb-4 mt-8">We Accept</h3>
          <div className="flex flex-wrap gap-4 text-gray-300">
            <span className="px-4 py-2 bg-[#222] rounded">Cash</span>
            <span className="px-4 py-2 bg-[#222] rounded">Check</span>
            <span className="px-4 py-2 bg-[#222] rounded">Credit Card (Square)</span>
            <span className="px-4 py-2 bg-[#222] rounded">PayPal</span>
            <span className="px-4 py-2 bg-[#222] rounded">Venmo</span>
            <span className="px-4 py-2 bg-[#222] rounded">Zelle</span>
          </div>
        </div>
      </section>

      {/* Owner Section */}
      <section className="py-12 bg-[#222] text-white">
        <div className="container-custom max-w-3xl">
          <h2 className="text-2xl font-bold mb-6 text-center">Meet Isaac</h2>
          <div className="grid md:grid-cols-3 gap-8 items-start">
            <div className="md:col-span-1">
              <img src="/IMG_6989.PNG" alt="Isaac - Owner of The Painted Painter" className="w-full rounded-lg" />
            </div>
            <div className="md:col-span-2">
              <p className="text-gray-400 mb-4 leading-relaxed">
                Isaac is a veteran who started painting while attending college on the G.I. Bill. What began as a way to earn money between classes grew into a passion for transforming spaces.
              </p>
              <p className="text-gray-400 mb-4 leading-relaxed">
                He holds both a California contractor's license (Lic# 1019026) and a realtor's license, giving him unique insight into how paint can enhance property value.
              </p>
              <p className="text-gray-400 mb-4 leading-relaxed">
                Over the years, Isaac has completed projects across San Diego neighborhoods including homes, restaurants, and churches. His attention to detail and commitment to quality has earned The Painted Painter a loyal following of repeat customers.
              </p>
              <p className="text-gray-400 leading-relaxed">
                Beyond house painting, Isaac is also an artist, creating custom murals and artwork. You can see some of his art pieces featured on our <Link to="/" className="text-[#74b9ff] hover:underline">homepage</Link>.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Gallery Section */}
      <section className="py-12">
        <div className="container-custom">
          <h2 className="text-2xl font-bold mb-8 text-center">Recent Projects</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {[
              '/thumbnail_IMG_8022.jpg',
              '/thumbnail_IMG_8544.jpg',
              '/thumbnail_IMG_8560.jpg',
              '/thumbnail_IMG_8748.jpg',
              '/thumbnail_IMG_9403.jpg',
              '/thumbnail_IMG_9414.jpg',
            ].map((img, index) => (
              <div key={index} className="aspect-square overflow-hidden rounded-lg">
                <img src={img} alt={`San Diego painting project ${index + 1}`} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 bg-[#111] text-center">
        <div className="container-custom">
          <h2 className="text-2xl font-bold mb-4">Ready to Transform Your Space?</h2>
          <p className="text-gray-400 mb-8">Get a free quote for your painting project today!</p>
          <Link to="/quote" className="cta-button">
            Get Your Quote
          </Link>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-12 text-center">
        <div className="container-custom">
          <h2 className="text-2xl font-bold mb-6">Contact Us</h2>
          <p className="text-2xl mb-2">
            <a href="tel:6197242702" className="text-[#74b9ff] hover:underline">(619) 724-2702</a>
          </p>
          <p className="text-gray-400 mb-6">
            Email: <a href="mailto:iw@thepaintedpainter.com" className="text-[#74b9ff] hover:underline">iw@thepaintedpainter.com</a>
          </p>
          <div className="flex justify-center gap-4">
            <a href="https://www.facebook.com/thepaintedpainter" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">
              <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
            </a>
            <a href="https://www.instagram.com/thepaintedpainter" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">
              <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
            </a>
            <a href="https://www.yelp.com/biz/the-painted-painter-san-diego" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">
              <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M20.16 12.594l-4.995 1.433c-.96.276-1.74-.8-1.176-1.63l2.905-4.308c.376-.558 1.206-.376 1.386.25l1.398 4.63c.148.558-.518 1.073-1.518.625zm-7.166 5.1l-.9-5.164c-.18-.97 1.03-1.588 1.79-.924l3.93 3.396c.462.398.21 1.156-.38 1.28l-3.53.754c-.6.128-1.09-.342-.91-1.342zm-2.166-6.594l-5.11-1.178c-.96-.22-.96-1.6 0-1.82l5.11-1.178c.6-.138 1.09.4.91 1.09l-.91 2.996zm-3.166 1.9l4.166 3.396c.76.62.34 1.82-.63 1.82h-4.166c-.59 0-.94-.63-.59-1.09l1.22-4.126zm6.332-8.5c.18-.97 1.54-.97 1.72 0l.9 5.164c.18 1-.31 1.47-.91 1.342l-3.53-.754c-.59-.124-.842-.882-.38-1.28l2.2-4.472z"/></svg>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
};

export default About;
