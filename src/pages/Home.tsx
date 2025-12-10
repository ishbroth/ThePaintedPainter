import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Star, ChevronLeft, ChevronRight } from 'lucide-react';

const Home = () => {
  const [currentSlide, setCurrentSlide] = useState(0);

  // Hero collage image from the website
  const heroImage = 'https://img1.wsimg.com/isteam/ip/d8c87176-1549-49d9-97f8-f9e6fa38b25f/IMG_7201.PNG/:/cr=t:0%25,l:0%25,w:100%25,h:100%25/rs=h:500,cg:true';

  // Project showcase slides - will be replaced with actual images
  const projectSlides = [
    { image: 'https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=800', caption: 'Every Project is a Work of Art.' },
    { image: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800', caption: 'Monumental Portraits.' },
    { image: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=800', caption: 'Kick-Ass House Painting.' },
    { image: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800', caption: 'Painting with Honor.' },
  ];

  // Reviews
  const reviews = [
    {
      text: '"Isaac was awesome! He painted our entire exterior and it was from blistering to polished [...]"',
      link: 'Read full review',
      source: 'From Yelp',
      rating: 5,
    },
    {
      text: '"The paint job looks amazing. Isaac is fast and efficient, fair pricing can\'t be beat."',
      link: 'Read full review',
      source: 'From Google',
      rating: 5,
    },
    {
      text: '"I used Isaac from the Painted Painter and he did move-in my new condo, loved him! Great..."',
      link: 'Read full review',
      source: 'From NextDoor',
      rating: 5,
    },
  ];

  // Local San Diego showcase slides
  const localSlides = [
    { image: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=600', caption: '' },
    { image: 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=600', caption: '' },
    { image: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=600', caption: '' },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % projectSlides.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [projectSlides.length]);

  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % projectSlides.length);
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + projectSlides.length) % projectSlides.length);

  return (
    <div className="bg-black text-white">
      {/* Hero Section */}
      <section className="py-8">
        <div className="container-custom text-center">
          {/* Hero Image Collage */}
          <div className="max-w-lg mx-auto mb-6">
            <img
              src={heroImage}
              alt="The Painted Painter"
              className="w-full h-auto"
            />
          </div>

          {/* License info */}
          <p className="text-gray-400 text-sm mb-2">San Diego Painting Service</p>
          <p className="text-gray-400 text-sm mb-6">Lic# 1019026</p>

          {/* CTA Button */}
          <a
            href="tel:6197242702"
            className="inline-block border border-secondary text-secondary px-8 py-3 text-sm tracking-wider hover:bg-secondary hover:text-black transition-colors"
          >
            CALL/TEXT (619) 724-2702
          </a>
        </div>
      </section>

      {/* Quote Form Section */}
      <section className="py-12 bg-black">
        <div className="container-custom">
          <h2 className="text-xl font-bold mb-8 tracking-wider">GET YOUR PAINTING QUOTE!</h2>

          <div className="max-w-xl">
            <div className="bg-white p-6 mb-4">
              <p className="text-black font-medium mb-4">Request a Quote and Send Pictures Below!</p>
              <div className="space-y-3">
                <input type="text" placeholder="Name*" className="input-field" />
                <input type="email" placeholder="Email*" className="input-field" />
                <input type="tel" placeholder="Phone*" className="input-field" />
                <input type="text" placeholder="Address/ZIP*" className="input-field" />
                <textarea
                  placeholder="Describe your project. Interior or exterior? How many rooms, or square feet? Just walls or trim too? Anything else?**"
                  rows={4}
                  className="input-field resize-none"
                />
                <input type="text" placeholder="When Would You Like this Done?**" className="input-field" />
              </div>

              <div className="flex justify-between items-center mt-4 text-sm text-gray-600">
                <span>📎 To Send PICTURES, Click Here!</span>
                <span>Attachments (0)</span>
              </div>

              <button className="w-full bg-black text-white py-3 mt-4 text-sm tracking-wider hover:bg-gray-800 transition-colors">
                PERFECT, SUBMIT IT!
              </button>

              <p className="text-xs text-gray-500 mt-3">
                This site is protected by reCAPTCHA and the Google Privacy Policy and Terms of Service apply.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Fast & Affordable Section */}
      <section className="py-12 text-center">
        <div className="container-custom max-w-3xl">
          <h2 className="text-2xl font-bold mb-6">Fast & Affordable Interior & Exterior Painting</h2>
          <p className="text-gray-300 leading-relaxed mb-4">
            Providing professional residential painting services, specializing in transforming beautiful
            homes all over San Diego with a personal touch.
          </p>
          <p className="text-gray-300 leading-relaxed mb-4">
            The Painted Painter is a licensed contractor with 18+ years of experience engineering
            hundreds of painting projects and saving customers thousands with efficient painting
            methods and quality products.
          </p>
          <p className="text-gray-400 italic mt-6">
            Translation: Walls. Paint. Good. Fast.
          </p>
        </div>
      </section>

      {/* Gold Divider */}
      <div className="gold-divider" />

      {/* Project Carousel */}
      <section className="py-12 relative">
        <div className="container-custom">
          <div className="relative overflow-hidden">
            <div
              className="flex transition-transform duration-500"
              style={{ transform: `translateX(-${currentSlide * 100}%)` }}
            >
              {projectSlides.map((slide, index) => (
                <div key={index} className="w-full flex-shrink-0">
                  <div className="relative h-80 md:h-96">
                    <img
                      src={slide.image}
                      alt={slide.caption}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <p className="text-white text-2xl md:text-3xl font-bold text-center px-4">
                        {slide.caption}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Navigation arrows */}
            <button
              onClick={prevSlide}
              className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 p-2 hover:bg-black/70 transition-colors"
            >
              <ChevronLeft className="text-white" size={24} />
            </button>
            <button
              onClick={nextSlide}
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 p-2 hover:bg-black/70 transition-colors"
            >
              <ChevronRight className="text-white" size={24} />
            </button>
          </div>
        </div>
      </section>

      {/* Gold Divider */}
      <div className="gold-divider" />

      {/* Reviews Section */}
      <section className="py-16">
        <div className="container-custom">
          <h2 className="text-2xl font-bold text-center mb-12 tracking-wider">REVIEWS:</h2>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {reviews.map((review, index) => (
              <div key={index} className="bg-[#1a1a1a] p-6 text-center">
                {/* Stars */}
                <div className="flex justify-center gap-1 mb-4">
                  {[...Array(review.rating)].map((_, i) => (
                    <Star key={i} className="text-secondary fill-secondary" size={20} />
                  ))}
                </div>

                <p className="text-gray-300 text-sm mb-4 italic">{review.text}</p>

                <a href="#" className="text-secondary text-sm hover:underline block mb-2">
                  {review.link} →
                </a>
                <span className="text-gray-500 text-xs">{review.source}</span>
              </div>
            ))}
          </div>

          {/* More Reviews Button */}
          <div className="text-center mt-12">
            <a
              href="https://www.yelp.com/biz/the-painted-painter-san-diego"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block border border-white text-white px-8 py-3 text-sm tracking-wider hover:bg-white hover:text-black transition-colors"
            >
              MORE REVIEWS HERE!
            </a>
          </div>
        </div>
      </section>

      {/* Gold Divider */}
      <div className="gold-divider" />

      {/* Local San Diego Section */}
      <section className="py-16">
        <div className="container-custom text-center">
          <p className="text-gray-400 text-sm mb-8">Local San Diego Painter.</p>

          {/* Local showcase images */}
          <div className="grid grid-cols-3 gap-2 mb-8">
            {localSlides.map((slide, index) => (
              <div key={index} className="relative h-40 md:h-64 overflow-hidden">
                <img
                  src={slide.image}
                  alt="Local San Diego project"
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>

          <p className="text-gray-300 text-sm max-w-2xl mx-auto mb-8">
            Offering interior & exterior painting services for residential properties, The Painted Painter delivers
            consistent workmanship, no-nonsense service, realistic scheduling, and competitive pricing to all
            neighborhoods of San Diego.
          </p>

          <Link
            to="/about"
            className="inline-block border border-white text-white px-8 py-3 text-sm tracking-wider hover:bg-white hover:text-black transition-colors"
          >
            ABOUT
          </Link>
        </div>
      </section>

      {/* Gold Divider */}
      <div className="gold-divider" />

      {/* Your Walls are on the Dark Side */}
      <section className="py-16 text-center">
        <div className="container-custom">
          <p className="text-gray-400 text-lg">Your Walls are on the Dark Side.</p>
        </div>
      </section>

      {/* Gold Divider */}
      <div className="gold-divider" />

      {/* PayPal Section */}
      <section className="py-16 text-center">
        <div className="container-custom">
          <h3 className="text-xl font-bold mb-4 tracking-wider">FOR CREDIT CARD CUSTOMERS:</h3>
          <p className="text-gray-400 text-sm mb-2">Please use the PayPal Button Below for a Secure Transaction.</p>
          <p className="text-gray-400 text-sm mb-6">Sign into PayPal or Continue as a Guest. Your Total will Load Automatically.</p>
          <p className="text-gray-400 text-sm mb-6">Thank You!</p>

          <a
            href="https://www.paypal.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block border border-white text-white px-8 py-3 text-sm tracking-wider hover:bg-white hover:text-black transition-colors"
          >
            PAY BY PAYPAL
          </a>
        </div>
      </section>

      {/* Gold Divider */}
      <div className="gold-divider" />

      {/* Painter to the Rescue */}
      <section className="py-16 text-center">
        <div className="container-custom">
          <p className="text-gray-400 text-lg">Painter to the Rescue.</p>
        </div>
      </section>
    </div>
  );
};

export default Home;
