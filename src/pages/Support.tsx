import { useState } from 'react';

const faqs = [
  {
    question: 'How does The Painted Painter work?',
    answer:
      'Think of us as the Hotwire for painting. You get an instant AI-powered estimate for your project, then choose how you want to proceed: accept a guaranteed price for the best deal, or browse individual painters and pick the one you like best. Painters compete for your job, which means better pricing and faster service for you.',
  },
  {
    question: 'How is the guaranteed price calculated?',
    answer:
      'Our AI estimator factors in room count, total surface area, prep work complexity, regional market rates, and current painter availability in your area. The result is a competitive, transparent price that reflects the real cost of your project.',
  },
  {
    question: 'Do I pay anything upfront?',
    answer:
      'A 10% deposit secures your painter and locks in your price. The remaining balance is paid directly to your painter upon completion of the project. No hidden fees, no surprises.',
  },
  {
    question: 'How are painters vetted?',
    answer:
      'All painters on our platform must provide license information (where required by their state), proof of insurance, and bonding documentation. We verify credentials before they can accept jobs, and we collect customer reviews after every project to maintain quality standards.',
  },
  {
    question: "What if I'm not happy with the work?",
    answer:
      'Your painter handles all touch-ups directly — that is part of their commitment when they accept a job. Our review and rating system helps maintain high quality across the platform. Painters with consistently low ratings are removed.',
  },
  {
    question: 'How do I become a painter on the platform?',
    answer:
      'Click "For Painters" in the header to sign up. You\'ll create a profile, set your pricing preferences, upload your portfolio, and start receiving job offers in your area. It\'s free to join — we only take a small platform fee when you complete a job.',
  },
  {
    question: 'What areas do you serve?',
    answer:
      'We serve all 50 US states. Availability depends on painter coverage in your area. As our network grows, more areas gain full coverage. Enter your zip code when getting an estimate to see available painters near you.',
  },
  {
    question: 'How do I contact support?',
    answer:
      'Email us at contact@thepaintedpainter.com or call (619) 724-2702. Our support team is available Monday through Friday, 8 AM to 6 PM Pacific Time.',
  },
];

const Support = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="bg-[#1a1a1a] text-white">
      {/* Hero */}
      <section className="bg-[#111] text-white py-16 border-b border-[#333]">
        <div className="container-custom text-center">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">Support & Help Center</h1>
          <p className="text-gray-400">Find answers, get in touch, or manage your payments.</p>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-12">
        <div className="container-custom max-w-3xl">
          <h2 className="text-2xl font-bold mb-8 text-center">Frequently Asked Questions</h2>
          <div className="space-y-3">
            {faqs.map((faq, index) => (
              <div key={index} className="border border-[#333] rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleFaq(index)}
                  className="w-full flex items-center justify-between px-6 py-4 text-left bg-[#222] hover:bg-[#2a2a2a] transition-colors cursor-pointer"
                >
                  <span className="font-semibold text-white pr-4">{faq.question}</span>
                  <span className="text-[#f5a623] text-xl flex-shrink-0">
                    {openIndex === index ? '−' : '+'}
                  </span>
                </button>
                {openIndex === index && (
                  <div className="px-6 py-4 bg-[#1a1a1a] border-t border-[#333]">
                    <p className="text-gray-300 leading-relaxed">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-12 bg-[#222]">
        <div className="container-custom max-w-3xl">
          <h2 className="text-2xl font-bold mb-8 text-center">Contact Support</h2>
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div className="bg-[#1a1a1a] border border-[#333] rounded-lg p-6">
              <div className="text-[#f5a623] text-3xl mb-4">
                <svg width="32" height="32" fill="currentColor" viewBox="0 0 24 24" className="mx-auto">
                  <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
                </svg>
              </div>
              <h3 className="font-bold mb-2">Email</h3>
              <a
                href="mailto:contact@thepaintedpainter.com"
                className="text-[#74b9ff] hover:underline text-sm"
              >
                contact@thepaintedpainter.com
              </a>
            </div>
            <div className="bg-[#1a1a1a] border border-[#333] rounded-lg p-6">
              <div className="text-[#f5a623] text-3xl mb-4">
                <svg width="32" height="32" fill="currentColor" viewBox="0 0 24 24" className="mx-auto">
                  <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                </svg>
              </div>
              <h3 className="font-bold mb-2">Phone</h3>
              <a href="tel:6197242702" className="text-[#74b9ff] hover:underline text-sm">
                (619) 724-2702
              </a>
            </div>
            <div className="bg-[#1a1a1a] border border-[#333] rounded-lg p-6">
              <div className="text-[#f5a623] text-3xl mb-4">
                <svg width="32" height="32" fill="currentColor" viewBox="0 0 24 24" className="mx-auto">
                  <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
                </svg>
              </div>
              <h3 className="font-bold mb-2">Support Hours</h3>
              <p className="text-gray-400 text-sm">Monday - Friday</p>
              <p className="text-gray-400 text-sm">8:00 AM - 6:00 PM PT</p>
            </div>
          </div>
        </div>
      </section>

      {/* PayPal Payment Section */}
      <section className="payment-section">
        <h3>For Credit Card Customers:</h3>
        <p>
          Please use the PayPal Button below for a Secure Transaction.
          <br />
          Sign into PayPal or Continue as a Guest. Your Total will Load Automatically.
          <br />
          Thank You!
        </p>
        <a href="https://www.paypal.com" className="paypal-btn" target="_blank" rel="noopener noreferrer">
          Pay by PayPal
        </a>
        <div className="payment-icons">
          <span className="payment-icon" style={{ background: '#1a1f71' }}>
            VISA
          </span>
          <span className="payment-icon" style={{ background: '#eb001b' }}>
            MC
          </span>
          <span className="payment-icon" style={{ background: '#006fcf' }}>
            AMEX
          </span>
          <span className="payment-icon" style={{ background: '#ff5f00' }}>
            DISC
          </span>
        </div>
      </section>

      {/* AI Assistant Placeholder */}
      <section className="py-12">
        <div className="container-custom max-w-3xl">
          <h2 className="text-2xl font-bold mb-8 text-center">AI Support Assistant</h2>
          <div className="bg-[#222] border border-[#333] rounded-lg overflow-hidden">
            {/* Chat header */}
            <div className="bg-[#111] px-6 py-3 border-b border-[#333] flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-sm text-gray-300 font-semibold">Painted Painter Assistant</span>
            </div>
            {/* Chat body */}
            <div className="p-6 min-h-[160px]">
              <div className="flex items-start gap-3 mb-6">
                <div className="w-8 h-8 rounded-full bg-[#f5a623] flex items-center justify-center flex-shrink-0">
                  <span className="text-black font-bold text-sm">AI</span>
                </div>
                <div className="bg-[#2a2a2a] border border-[#444] rounded-lg px-4 py-3 max-w-md">
                  <p className="text-gray-300 text-sm">
                    Hi! I'm the Painted Painter assistant. How can I help you today?
                  </p>
                </div>
              </div>
            </div>
            {/* Chat input */}
            <div className="px-6 pb-6">
              <div className="flex gap-3">
                <input
                  type="text"
                  disabled
                  placeholder="Coming Soon"
                  className="flex-1 bg-[#333] border border-[#555] rounded-lg px-4 py-3 text-sm text-gray-500 cursor-not-allowed"
                />
                <button
                  disabled
                  className="bg-[#444] text-gray-500 px-6 py-3 rounded-lg text-sm font-semibold cursor-not-allowed"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Support;
