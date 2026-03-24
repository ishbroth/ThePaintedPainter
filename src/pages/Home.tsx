import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

// Carousel 1 (4 triplets)
const carousel1Triplets = [
  { before: '/thumbnail_IMG_3202.jpg', art: '/Knight.jpg', after: '/thumbnail_IMG_3205.jpg', caption: 'Painting with Honor.' },
  { before: '/thumbnail_IMG_3262.jpg', art: '/PresidentStatue2.jpg', after: '/thumbnail_IMG_3308.jpg', caption: 'Monumental Paint Jobs.' },
  { before: '/thumbnail_IMG_3215.jpg', art: '/Shamu.jpg', after: '/thumbnail_IMG_3217.jpg', caption: 'Local San Diego Painting.' },
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
  { before: '/thumbnail_IMG_8862.jpg', art: '/Lassie.jpg', after: '/thumbnail_IMG_20220921_093911857.jpg', caption: 'Local San Diego Painting.' },
  { before: '/thumbnail_IMG_3195.jpg', art: '/Sphinx.jpg', after: '/thumbnail_IMG_3199.jpg', caption: 'Monumental Paint Jobs.' },
];

const reviews = [
  {
    image: '/thumbnail_IMG_8022.jpg',
    text: '"Isaac was awesome! He painted our airbnb rental and it was from drab to published..."',
    link: 'https://www.yelp.com/biz/the-painted-painter-san-diego',
    source: 'From Yelp',
  },
  {
    image: '/thumbnail_IMG_8544.jpg',
    text: '"The paint job looks amazing. Isaac is fast and efficient, his pricing can\'t be beat."',
    link: '#',
    source: 'From Google',
  },
  {
    image: '/thumbnail_IMG_8560.jpg',
    text: '"I hired Isaac from the Painted Painter when I did move-in... loved him! Great..."',
    link: '#',
    source: 'From NextDoor',
  },
];

// Smooth continuous scrolling carousel component
const SmoothCarousel = ({
  triplets,
  speed = 30, // seconds for one complete cycle
}: {
  triplets: typeof carousel1Triplets;
  speed?: number;
}) => {
  const ref = useRef<HTMLDivElement>(null);

  // Fade in on scroll
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

  // Duplicate triplets for seamless infinite scroll
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
      {/* Hero Collage */}
      <section className="hero-collage">
        <div className="collage-wrapper">
          <img src="/IMG_7201.PNG" alt="The Painted Painter Logo" />
        </div>
      </section>

      {/* Hero Info */}
      <section className="hero-info">
        <h1>San Diego Painting Service</h1>
        <p className="license">Lic# 1019026</p>
        <a href="tel:6197242702" className="cta-button">
          Call/Text (619) 724-2702
        </a>
      </section>

      {/* Estimate CTA Section */}
      <section className="quote-section">
        <div className="estimate-cta-card">
          <h2>Get a Free Painting Estimate</h2>
          <p>Answer a few quick questions and get an instant ballpark estimate for your project.</p>
          <Link to="/contact" className="estimate-cta-button">
            Get Your Estimate
          </Link>
        </div>
      </section>

      {/* About Text Section */}
      <section className="about-text fade-in">
        <h2>Fast & Affordable Interior & Exterior Painting</h2>
        <p>
          Providing professional residential painting services, specializing in transforming beautiful homes all over
          San Diego with a personal touch.
        </p>
        <p>
          The Painted Painter is a licensed contractor with 18+ years of experience engineering hundreds of painting
          projects and saving customers thousands with efficient painting methods and quality products.
        </p>
        <p className="slogan">Translation: Walls. Paint. Good. Fast.</p>
      </section>

      <div className="divider"></div>

      {/* Carousel 1 */}
      <SmoothCarousel
        triplets={carousel1Triplets}
        speed={40}
      />

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
        <div className="reviews-cta">
          <a href="https://www.yelp.com/biz/the-painted-painter-san-diego" target="_blank" rel="noopener noreferrer">
            More Reviews Here!
          </a>
        </div>
      </section>

      <div className="divider"></div>

      {/* Carousel 2 */}
      <SmoothCarousel
        triplets={carousel2Triplets}
        speed={35}
      />

      <div className="divider"></div>

      {/* Local Painter Section */}
      <section className="local-section fade-in">
        <h3>Local San Diego Painter</h3>
        <p>
          Offering interior & exterior painting services for residential properties, The Painted Painter delivers
          consistent workmanship, no-nonsense service, realistic scheduling, and competitive pricing to all
          neighborhoods of San Diego.
        </p>
        <Link to="/about" className="about-btn">
          About
        </Link>
      </section>

      <div className="divider"></div>

      {/* Carousel 3 */}
      <SmoothCarousel
        triplets={carousel3Triplets}
        speed={35}
      />

      <div className="divider"></div>

      {/* Payment Section */}
      <section className="payment-section fade-in">
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

      <div className="divider"></div>

      {/* Carousel 4 */}
      <SmoothCarousel
        triplets={carousel4Triplets}
        speed={40}
      />
    </div>
  );
};

export default Home;
