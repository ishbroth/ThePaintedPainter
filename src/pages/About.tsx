import { Link } from 'react-router-dom';

const About = () => {
  return (
    <div className="bg-[#1a1a1a] text-white">
      {/* Hero */}
      <section className="bg-[#111] text-white py-16 border-b border-[#333]">
        <div className="container-custom text-center">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">About The Painted Painter</h1>
          <p className="text-gray-400">The smarter way to book painting projects.</p>
        </div>
      </section>

      {/* Main Description */}
      <section className="py-12">
        <div className="container-custom max-w-3xl">
          <h2 className="text-2xl font-bold mb-6 text-center">The Ultimate Painter Booking Platform</h2>

          <p className="text-gray-300 mb-6 leading-relaxed">
            The Painted Painter is the Hotwire and Priceline for painting. Homeowners answer a few quick questions about their project and receive an instant AI-powered estimate. From there, you can accept a guaranteed price for the best deal or browse individual painters in your area and choose the one that fits your needs. Either way, you get transparent pricing and verified professionals.
          </p>

          <p className="text-gray-300 mb-6 leading-relaxed">
            For painters, the platform is just as straightforward. Sign up, set your rates, and start receiving job offers. You can accept guaranteed-price jobs that are matched to your availability, or wait to be selected directly by customers who browse your profile and portfolio. No bidding wars, no chasing leads — just real jobs from real homeowners.
          </p>

          <p className="text-gray-300 mb-6 leading-relaxed">
            The platform handles pricing, matching, and reviews so painters can focus on what they do best: delivering quality work. Customers get transparent pricing, verified professionals, and a simple way to track their project from estimate to completion.
          </p>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-12 bg-[#222] text-white">
        <div className="container-custom">
          <h2 className="text-2xl font-bold mb-8 text-center">How It Works</h2>
          <div className="grid md:grid-cols-5 gap-6 max-w-4xl mx-auto">
            {[
              {
                num: '1',
                title: 'Get an Estimate',
                desc: 'Answer a few questions about your project and get an instant AI-powered estimate. No waiting, no phone tag.',
              },
              {
                num: '2',
                title: 'Choose Your Option',
                desc: 'Pick the guaranteed price for the best deal, or browse and select a specific painter based on their profile and reviews.',
              },
              {
                num: '3',
                title: 'Secure Your Painter',
                desc: 'Pay a small 10% deposit to lock in your price and painter. The rest is paid directly to the painter upon completion.',
              },
              {
                num: '4',
                title: 'Get It Done',
                desc: 'Your painter handles the project from prep to final coat. Track progress and communicate through the platform.',
              },
              {
                num: '5',
                title: 'Rate & Review',
                desc: 'Share your experience to help other homeowners find great painters. Your feedback keeps the platform honest.',
              },
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

      {/* For Painters */}
      <section className="py-12">
        <div className="container-custom max-w-3xl">
          <h2 className="text-2xl font-bold mb-6 text-center">For Painters</h2>
          <p className="text-gray-300 mb-4 leading-relaxed">
            Stop chasing leads and undercutting yourself on bidding sites. The Painted Painter connects you with homeowners who are ready to book. You set your rates, build your profile, and receive job offers that match your skills and availability.
          </p>
          <ul className="text-gray-300 mb-6 list-disc ml-6 space-y-2">
            <li>Steady stream of qualified leads in your area</li>
            <li>Fair, transparent pricing — no race to the bottom</li>
            <li>No bidding wars — jobs come to you</li>
            <li>Dashboard to manage jobs, schedule, and earnings</li>
            <li>Build your reputation with verified customer reviews</li>
          </ul>
          <div className="text-center">
            <Link to="/painter-signup" className="cta-button">
              Sign Up as a Painter
            </Link>
          </div>
        </div>
      </section>

      {/* For Homeowners */}
      <section className="py-12 bg-[#222] text-white">
        <div className="container-custom max-w-3xl">
          <h2 className="text-2xl font-bold mb-6 text-center">For Homeowners</h2>
          <p className="text-gray-300 mb-4 leading-relaxed">
            Getting your home painted should not be a hassle. With The Painted Painter, you get an instant estimate, compare options, and book a verified professional — all in one place. No phone tag, no waiting days for quotes, no guessing whether the price is fair.
          </p>
          <ul className="text-gray-300 mb-6 list-disc ml-6 space-y-2">
            <li>Instant AI-powered estimates — no waiting for callbacks</li>
            <li>Verified, licensed, and insured painters</li>
            <li>Transparent pricing with no hidden fees</li>
            <li>Track your project from booking to completion</li>
            <li>Only pay the balance when the work is done</li>
          </ul>
          <div className="text-center">
            <Link to="/contact" className="cta-button">
              Get Your Estimate
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 bg-[#111] text-center">
        <div className="container-custom">
          <h2 className="text-2xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-gray-400 mb-8">Whether you're a homeowner or a painter, we've got you covered.</p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/contact" className="cta-button">
              Get an Estimate
            </Link>
            <Link to="/painter-signup" className="cta-button">
              Join as a Painter
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default About;
