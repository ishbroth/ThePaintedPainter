import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { fakePainters } from '../lib/fakePainters';

// Carousel 1 (4 triplets)
const carousel1Triplets = [
  { before: '/thumbnail_IMG_3202.jpg', art: '/Knight.jpg', after: '/thumbnail_IMG_3205.jpg', caption: 'Painting with Honor.' },
  { before: '/thumbnail_IMG_3262.jpg', art: '/PresidentStatue2.jpg', after: '/thumbnail_IMG_3308.jpg', caption: 'Monumental Paint Jobs.' },
  { before: '/thumbnail_IMG_3215.jpg', art: '/Shamu.jpg', after: '/thumbnail_IMG_3217.jpg', caption: 'Quality Craftsmanship.' },
  { before: '/thumbnail_IMG_2142.jpg', art: '/Washington.jpg', after: '/thumbnail_IMG_2154.jpg', caption: 'Revolutionary House Painting.' },
];

// Carousel 2 (4 triplets)
const carousel2Triplets = [
  { before: '/thumbnail_IMG_2546.jpg', art: '/TheButler.jpg', after: '/thumbnail_IMG_3006.jpg', caption: 'Painting, at Your Service.' },
  { before: '/thumbnail_IMG_1768.jpg', art: '/Godzilla2.jpg', after: '/thumbnail_IMG_1837.jpg', caption: 'Monster Paint Projects.' },
  { before: '/thumbnail_IMG_8022.jpg', art: '/Yoda2.jpg', after: '/thumbnail_IMG_8085.jpg', caption: 'Your walls are on the dark side.' },
  { before: '/thumbnail_IMG_7414-adb98c1.jpg', art: '/ChuckNorris.jpg', after: '/thumbnail_IMG_2293-68d2003.jpg', caption: 'Kick-Ass Paint Jobs.' },
];

// Carousel 3 (4 triplets)
const carousel3Triplets = [
  { before: '/thumbnail_IMG_8544.jpg', art: '/Hendrix.jpg', after: '/thumbnail_IMG_8560.jpg', caption: 'Rocking Paint Jobs.' },
  { before: '/thumbnail_IMG_8748.jpg', art: '/Unicorn.jpg', after: '/thumbnail_IMG_8799.jpg', caption: "Great Painting, it's not a Myth." },
  { before: '/thumbnail_IMG_9403.jpg', art: '/Hulk2.jpg', after: '/thumbnail_IMG_9414.jpg', caption: "Slammin' Paint Jobs, Brother." },
  { before: '/thumbnail_IMG_3218.jpg', art: '/MonaLisa2.jpg', after: '/thumbnail_IMG_3228.jpg', caption: 'Every Project is a Work of Art.' },
];

// Carousel 4 (4 triplets)
const carousel4Triplets = [
  { before: '/thumbnail_IMG_7217.jpg', art: '/Fireman.jpg', after: '/thumbnail_IMG_7242.jpg', caption: 'Painting with Honor.' },
  { before: '/thumbnail_IMG_7611.jpg', art: '/KoolAidMan.jpg', after: '/thumbnail_IMG_7631.jpg', caption: 'Refreshed Paint.' },
  { before: '/thumbnail_IMG_8862.jpg', art: '/Lassie.jpg', after: '/thumbnail_IMG_20220921_093911857.jpg', caption: 'Nationwide Coverage.' },
  { before: '/thumbnail_IMG_3195.jpg', art: '/Sphinx.jpg', after: '/thumbnail_IMG_3199.jpg', caption: 'Monumental Paint Jobs.' },
];

const reviews = [
  {
    image: '/thumbnail_IMG_8022.jpg',
    text: '"The Painted Painter was awesome! He painted our airbnb rental and it was from drab to published..."',
    link: 'https://www.yelp.com/biz/the-painted-painter-san-diego',
    source: 'From Yelp',
  },
  {
    image: '/thumbnail_IMG_8544.jpg',
    text: '"The paint job looks amazing. The Painted Painter is fast and efficient, his pricing can\'t be beat."',
    link: '#',
    source: 'From Google',
  },
  {
    image: '/thumbnail_IMG_8560.jpg',
    text: '"I hired The Painted Painter when I did move-in... loved them! Great..."',
    link: '#',
    source: 'From NextDoor',
  },
];

// Smooth continuous scrolling carousel component
const SmoothCarousel = ({
  triplets,
  speed = 30,
}: {
  triplets: typeof carousel1Triplets;
  speed?: number;
}) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  const duplicatedTriplets = [...triplets, ...triplets];

  return (
    <section className="carousel-section fade-in" ref={ref}>
      <div className="smooth-carousel-container">
        <div
          className="smooth-carousel-track"
          style={{
            animationDuration: `${speed}s`,
          }}
        >
          {duplicatedTriplets.map((triplet, index) => (
            <div key={index} className="carousel-triplet">
              <div className="carousel-slide">
                <img src={triplet.before} alt="Before" />
              </div>
              <div className="carousel-slide art-slide">
                <img src={triplet.art} alt={triplet.caption} />
                <div className="art-caption">{triplet.caption}</div>
              </div>
              <div className="carousel-slide">
                <img src={triplet.after} alt="After" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// Collect all deals from fake painters
const allDeals = fakePainters.flatMap((painter) =>
  painter.deals.map((deal) => ({
    ...deal,
    painterName: painter.company_name,
    city: painter.city,
    state: painter.state,
    painterId: painter.id,
    rating: painter.rating,
  }))
);

// Deals of the Day rotating display
const DealsOfTheDay = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [locationFilter, setLocationFilter] = useState('');
  const [filteredDeals, setFilteredDeals] = useState(allDeals);

  useEffect(() => {
    if (locationFilter.trim()) {
      const lower = locationFilter.toLowerCase();
      const filtered = allDeals.filter(
        (d) =>
          d.city.toLowerCase().includes(lower) ||
          d.state.toLowerCase().includes(lower)
      );
      setFilteredDeals(filtered.length > 0 ? filtered : allDeals);
    } else {
      setFilteredDeals(allDeals);
    }
    setCurrentIndex(0);
  }, [locationFilter]);

  useEffect(() => {
    if (filteredDeals.length === 0) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % filteredDeals.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [filteredDeals]);

  const currentDeal = filteredDeals[currentIndex];
  if (!currentDeal) return null;

  return (
    <section className="deals-section fade-in">
      <h2>Deals of the Day</h2>
      <p className="deals-subtitle">Exclusive offers from painters across the country</p>

      <div className="deals-filter">
        <input
          type="text"
          placeholder="Filter by city or state..."
          value={locationFilter}
          onChange={(e) => setLocationFilter(e.target.value)}
          className="deals-filter-input"
        />
      </div>

      <Link
        to={`/painters/${currentDeal.painterId}`}
        className="deal-card-link"
      >
        <div className="deal-card">
          <div className="deal-badge">DEAL</div>
          <h3 className="deal-title">{currentDeal.title}</h3>
          <p className="deal-description">{currentDeal.description}</p>
          <div className="deal-meta">
            <span className="deal-painter">{currentDeal.painterName}</span>
            <span className="deal-location">
              {currentDeal.city}, {currentDeal.state}
            </span>
            <span className="deal-rating">{'★'.repeat(Math.round(currentDeal.rating))} {currentDeal.rating.toFixed(1)}</span>
          </div>
          <p className="deal-price">{currentDeal.price}</p>
          <span className="deal-cta">View Painter Profile →</span>
        </div>
      </Link>

      <div className="deals-dots">
        {filteredDeals.slice(0, 10).map((_, i) => (
          <span
            key={i}
            className={`deals-dot ${i === currentIndex % 10 ? 'active' : ''}`}
          />
        ))}
      </div>
    </section>
  );
};

const Home = () => {
  useEffect(() => {
    const fadeElements = document.querySelectorAll('.fade-in');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );

    fadeElements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div>
      {/* Estimate CTA — Above Hero */}
      <section className="quote-section">
        <div className="estimate-cta-card">
          <h2>Get a Free Painting Estimate</h2>
          <p>Answer a few quick questions and get an instant AI-powered estimate for your project.</p>
          <Link to="/contact" className="estimate-cta-button">
            Get Your Estimate
          </Link>
        </div>
      </section>

      {/* Hero Collage */}
      <section className="hero-collage">
        <div className="collage-wrapper">
          <img src="/IMG_7201.PNG" alt="The Painted Painter" />
        </div>
      </section>

      {/* Platform Description */}
      <section className="about-text fade-in">
        <h2>The Ultimate Painter Booking Site</h2>
        <p>
          The Painted Painter is the Priceline of house painting. Get an instant AI-powered estimate
          for your project, then choose a guaranteed price for the best deal or browse and select from
          vetted, licensed painters in your area. Painters compete to offer you the best price and
          service — you pick the option that works for you, lock it in with a small deposit, and your
          painter handles the rest.
        </p>
        <p className="slogan">Transparent pricing. Verified painters. Nationwide coverage.</p>
      </section>

      <div className="divider"></div>

      {/* Carousel 1 */}
      <SmoothCarousel triplets={carousel1Triplets} speed={40} />

      <div className="divider"></div>

      {/* Reviews Section */}
      <section className="reviews-section fade-in">
        <h2>REVIEWS:</h2>
        <div className="reviews-grid">
          {reviews.map((review, index) => (
            <div key={index} className="review-card">
              <div className="review-stars">★★★★★</div>
              <img src={review.image} alt="Review" className="review-image" />
              <p className="review-text">{review.text}</p>
              <a href={review.link} className="review-link" target="_blank" rel="noopener noreferrer">
                Read full review →
              </a>
              <p className="review-source">{review.source}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="divider"></div>

      {/* Carousel 2 */}
      <SmoothCarousel triplets={carousel2Triplets} speed={35} />

      <div className="divider"></div>

      {/* Deals of the Day — Replaces PayPal Section */}
      <DealsOfTheDay />

      <div className="divider"></div>

      {/* Carousel 3 */}
      <SmoothCarousel triplets={carousel3Triplets} speed={35} />

      <div className="divider"></div>

      {/* Carousel 4 */}
      <SmoothCarousel triplets={carousel4Triplets} speed={40} />

      <div className="divider"></div>

      {/* Painters Map Section */}
      <section className="map-section fade-in">
        <h2>Find Painters Near You</h2>
        <p className="map-subtitle">Browse verified painters across the country</p>
        <div className="home-map-container">
          <div className="home-map-placeholder">
            <p>Interactive Map</p>
            <p className="map-note">Google Maps integration coming soon</p>
            <Link to="/painters-map" className="map-link-btn">
              View Full Painters Map →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
