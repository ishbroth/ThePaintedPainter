import { useState } from 'react';
import { Link } from 'react-router-dom';
import { hapticLight } from '../lib/haptics';
import AssistantBubble from '../components/AssistantBubble';

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
    hapticLight();
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="text-[var(--text-primary)]">
      {/* Hero */}
      <section className="bg-[var(--bg-chrome)] text-[var(--text-primary)] py-16 border-b border-[var(--border)]">
        <div className="container-custom text-center">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">Support & Help Center</h1>
          <p className="text-[var(--text-secondary)]">Find answers or get in touch.</p>
        </div>
      </section>

      {/* Intro — shortened from the old About page */}
      <section className="py-12">
        <div className="container-custom max-w-3xl">
          <p className="text-[var(--text-secondary)] leading-relaxed text-center">
            The Painted Painter is Hotwire for painting: answer a few quick questions and get an instant AI-powered
            estimate. Accept our guaranteed price for the best deal, or browse painters in your area and pick the
            one that fits — either way, pricing is transparent and every painter is verified.
          </p>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-12 bg-[var(--bg-surface)]">
        <div className="container-custom max-w-3xl">
          <h2 className="text-2xl font-bold mb-8 text-center">Frequently Asked Questions</h2>
          <div className="space-y-3">
            {faqs.map((faq, index) => (
              <div key={index} className="border border-[var(--border)] rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleFaq(index)}
                  className="w-full flex items-center justify-between px-6 py-4 text-left bg-[var(--bg-page)] hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer"
                >
                  <span className="font-semibold text-[var(--text-primary)] pr-4">{faq.question}</span>
                  <span className="text-[var(--accent)] text-xl flex-shrink-0">
                    {openIndex === index ? '−' : '+'}
                  </span>
                </button>
                {openIndex === index && (
                  <div className="px-6 py-4 bg-[var(--bg-surface)] border-t border-[var(--border)]">
                    <p className="text-[var(--text-secondary)] leading-relaxed">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-12">
        <div className="container-custom max-w-3xl">
          <h2 className="text-2xl font-bold mb-8 text-center">Contact Support</h2>
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-6">
              <div className="text-[var(--accent)] text-3xl mb-4">
                <svg width="32" height="32" fill="currentColor" viewBox="0 0 24 24" className="mx-auto">
                  <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
                </svg>
              </div>
              <h3 className="font-bold mb-2">Email</h3>
              <a
                href="mailto:contact@thepaintedpainter.com"
                className="text-[var(--accent-blue)] hover:underline text-sm"
              >
                contact@thepaintedpainter.com
              </a>
            </div>
            <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-6">
              <div className="text-[var(--accent)] text-3xl mb-4">
                <svg width="32" height="32" fill="currentColor" viewBox="0 0 24 24" className="mx-auto">
                  <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                </svg>
              </div>
              <h3 className="font-bold mb-2">Phone</h3>
              <a href="tel:6197242702" className="text-[var(--accent-blue)] hover:underline text-sm">
                (619) 724-2702
              </a>
            </div>
            <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-6">
              <div className="text-[var(--accent)] text-3xl mb-4">
                <svg width="32" height="32" fill="currentColor" viewBox="0 0 24 24" className="mx-auto">
                  <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
                </svg>
              </div>
              <h3 className="font-bold mb-2">Support Hours</h3>
              <p className="text-[var(--text-secondary)] text-sm">Monday - Friday</p>
              <p className="text-[var(--text-secondary)] text-sm">8:00 AM - 6:00 PM PT</p>
            </div>
          </div>
        </div>
      </section>

      {/* Rest of the old About page, condensed */}
      <section className="py-12 bg-[var(--bg-surface)]">
        <div className="container-custom max-w-3xl">
          <p className="text-[var(--text-secondary)] leading-relaxed text-center">
            Painters sign up, set their rates, and start receiving job offers — no bidding wars, no chasing leads.
            The platform handles pricing, matching, and reviews so painters can focus on the work, and customers get
            transparent pricing with a simple way to track a project from estimate to completion.
          </p>
        </div>
      </section>

      <section className="py-12">
        <div className="container-custom">
          <h2 className="text-2xl font-bold mb-8 text-center">How It Works</h2>
          <div className="grid md:grid-cols-5 gap-6 max-w-4xl mx-auto">
            {[
              { num: '1', title: 'Get an Estimate', desc: 'Answer a few questions and get an instant AI-powered estimate.' },
              { num: '2', title: 'Choose Your Option', desc: 'Take the guaranteed price, or pick a specific painter by profile and reviews.' },
              { num: '3', title: 'Secure Your Painter', desc: 'A 10% deposit locks in your price and painter.' },
              { num: '4', title: 'Get It Done', desc: 'Your painter handles prep through final coat. Track progress on the platform.' },
              { num: '5', title: 'Rate & Review', desc: 'Share your experience to help other homeowners and keep the platform honest.' },
            ].map((step) => (
              <div key={step.num} className="text-center">
                <div className="w-12 h-12 bg-[var(--accent)] text-[var(--text-primary)] rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                  {step.num}
                </div>
                <h4 className="font-bold mb-2">{step.title}</h4>
                <p className="text-sm text-[var(--text-secondary)]">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12 bg-[var(--bg-surface)]">
        <div className="container-custom max-w-4xl grid md:grid-cols-2 gap-10">
          <div>
            <h2 className="text-xl font-bold mb-4">For Homeowners</h2>
            <p className="text-[var(--text-secondary)] mb-4 text-sm leading-relaxed">
              Get an instant estimate, compare options, and book a verified professional — all in one place. No phone
              tag, no waiting days for pricing.
            </p>
            <ul className="text-[var(--text-secondary)] mb-6 list-disc ml-5 space-y-1.5 text-sm">
              <li>Instant AI-powered estimates</li>
              <li>Verified, licensed, and insured painters</li>
              <li>Transparent pricing with no hidden fees</li>
              <li>Only pay the balance when the work is done</li>
            </ul>
            <Link to="/" className="cta-button">
              Get Your Estimate
            </Link>
          </div>
          <div>
            <h2 className="text-xl font-bold mb-4">For Painters</h2>
            <p className="text-[var(--text-secondary)] mb-4 text-sm leading-relaxed">
              Stop chasing leads and undercutting yourself on bidding sites. Set your rates, build your profile, and
              get job offers that match your skills and availability.
            </p>
            <ul className="text-[var(--text-secondary)] mb-6 list-disc ml-5 space-y-1.5 text-sm">
              <li>Steady stream of qualified leads in your area</li>
              <li>Fair, transparent pricing — no race to the bottom</li>
              <li>Dashboard to manage jobs, schedule, and earnings</li>
              <li>Build your reputation with verified customer reviews</li>
            </ul>
            <Link to="/painter-signup" className="cta-button">
              Sign Up as a Painter
            </Link>
          </div>
        </div>
      </section>

      <AssistantBubble />
    </div>
  );
};

export default Support;
