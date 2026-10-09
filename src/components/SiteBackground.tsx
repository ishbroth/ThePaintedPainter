import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/** The picture is scaled (equal proportions) to a little wider than the screen, so the roller on the left and the brush on the right both stay in view. */
const WIDTH_OVER_SCREEN = 1.03;
/** Where the "The Painted Painter" lettering sits in the picture, as shares of its height (top of the letters, bottom of the letters). */
const TITLE_TOP = 0.4956;
const TITLE_BOTTOM = 0.5594;
/** The estimator card starts a little below the lettering. */
const CARD_BELOW_TITLE = 0.565;
/** Where the painting mask starts (just below the eyes), as a share of the picture's height: the carousel's bottom edge sits there, covering the eyes. */
const EYE_LEVEL = 0.388;
/** The top carousel's pictures: the other carousels' size (200px tall) times 1.25. Smaller only when the screen is too short to fit that above the mask. */
const HERO_CAROUSEL_HEIGHT = 250;
/** How far down the picture the bottom of the brush reaches (share of the picture's height); it has to stay on screen at the start. */
const BRUSH_BOTTOM = 0.72;
/** Extra nudge down, as a share of the screen height (about 54px on a 900px-tall screen). */
const EXTRA_DOWN = 0.06;

/**
 * The hero collage (Superman with the houses around him) as a translucent background.
 *
 * - It keeps its true proportions and is scaled so its width fills the screen (and spills a little past both sides), so
 *   Superman is centred across, with the roller and the brush in view. On most screens that makes it taller than the screen,
 *   so it also spills past the bottom; it starts positioned so the Superman panel (roller and brush included) is on screen.
 * - It is not pinned. As you scroll, it moves up slowly, in proportion to how much page there is to scroll, so the bottom
 *   of the picture and the bottom of the page come into view together.
 * - On a tall, narrow screen the picture can end up shorter than the screen; a blurred copy fills the rest and it stays put.
 *
 * On the home page it is stronger, and the "The Painted Painter" lettering is opaque until the estimator card covers it; on
 * working pages (forms, dashboards) everything, lettering included, is kept very light.
 */
const SiteBackground = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    const root = document.documentElement;
    const isHome = pathname === '/';
    let frame = 0;
    let size = 0;
    let screenHeight = 0;
    let startShift = 0; // how far up the picture starts (0 = its top is at the top of the page)

    const layout = () => {
      screenHeight = window.innerHeight;
      size = Math.round(window.innerWidth * WIDTH_OVER_SCREEN);
      root.style.setProperty('--hero-size', `${size}px`);
      const overhang = Math.max(0, size - screenHeight);
      // taller than the screen: start as far down as possible (the most of the top row of houses) while the brush is still on screen
      // (nudged a little further down than that: the brush handle's tip may sit just past the bottom edge)
      startShift = overhang > 0 ? -Math.min(overhang, Math.max(0, size * BRUSH_BOTTOM - screenHeight + 10 - screenHeight * EXTRA_DOWN)) : 0;
      const main = document.querySelector('main');
      const headerHeight = main ? Math.max(0, Math.round(main.getBoundingClientRect().top + window.scrollY)) : 0;
      // The estimator card starts just under Superman's body, but never above the middle of the screen (so a small scroll
      // is what brings it into view and starts the spoken intro) and never so low that none of it shows.
      const cardTop = Math.min(Math.max(size * CARD_BELOW_TITLE + startShift + 8, screenHeight * 0.52), screenHeight * 0.86);
      // the carousel under the header ends at Superman's eye level
      // Room between the header and the mask. The pictures are a fixed size; any extra room sits between the header and them,
      // so their bottom edge always rests at the mask (covering the eyes).
      const room = Math.max(0, Math.round(size * EYE_LEVEL + startShift - headerHeight));
      const carouselHeight = Math.min(HERO_CAROUSEL_HEIGHT, Math.max(60, room));
      const carouselGap = Math.max(0, room - carouselHeight);
      root.style.setProperty('--hero-carousel-h', `${carouselHeight}px`);
      root.style.setProperty('--hero-carousel-gap', `${carouselGap}px`);
      root.style.setProperty('--hero-spacer', `${Math.max(0, Math.round(cardTop - headerHeight - carouselGap - carouselHeight - 40))}px`);
      place();
    };

    const place = () => {
      frame = 0;
      const overhang = Math.max(0, size - screenHeight);
      const scrollable = document.documentElement.scrollHeight - screenHeight;
      const progress = scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0;
      // from where it starts to the point where its bottom meets the bottom of the screen, reached at the end of the page
      const endShift = -overhang;
      const shift = Math.round(startShift + (endShift - startShift) * progress);
      root.style.setProperty('--hero-shift', `${shift}px`);

      // Home page only: the lettering is fully opaque until the estimator card starts to cover it; once the card is over it,
      // the lettering is back to the same translucency as the rest of the picture (the card hides it while that happens).
      if (isHome) {
        const card = document.querySelector('.chat-estimator-card');
        let opacity = 1;
        if (card) {
          const titleTop = shift + size * TITLE_TOP;
          const titleBottom = shift + size * TITLE_BOTTOM;
          const cardTop = card.getBoundingClientRect().top;
          opacity = Math.min(1, Math.max(0, (cardTop - titleTop) / Math.max(1, titleBottom - titleTop)));
        }
        root.style.setProperty('--hero-title-opacity', opacity.toFixed(3));
      }
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(place);
    };

    layout();
    // the header and the page height can change after fonts load, sign-in state or a route change
    const settle = window.setTimeout(layout, 300);
    const settleLate = window.setTimeout(layout, 1500);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', layout);
    return () => {
      window.clearTimeout(settle);
      window.clearTimeout(settleLate);
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', layout);
    };
  }, [pathname]);

  return (
    <div className={`site-hero-bg${pathname === '/' ? ' site-hero-bg--home' : ''}`} aria-hidden="true">
      <div className="site-hero-bg__stage">
        <div className="site-hero-bg__img" />
        {/* just the lettering, opaque, on the home page only; it is part of the picture and moves with it */}
        <div className="site-hero-bg__title" />
      </div>
    </div>
  );
};

export default SiteBackground;
