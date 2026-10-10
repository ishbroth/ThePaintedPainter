import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/** The picture is never narrower than 0.9x, nor wider than 1.3x, the screen's width (equal proportions). */
const MIN_WIDTH_OVER_SCREEN = 0.9;
const MAX_WIDTH_OVER_SCREEN = 1.3;
/** Where the "The Painted Painter" lettering sits in the picture, as shares of its height (top of the letters, bottom of the letters). */
const TITLE_TOP = 0.4956;
const TITLE_BOTTOM = 0.5594;
/** The lettering ends this many pixels above the top of the estimator card. */
const LETTERING_GAP = 14;

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
      const main = document.querySelector('main');
      const headerHeight = main ? Math.max(0, Math.round(main.getBoundingClientRect().top + window.scrollY)) : 0;
      // The estimator card starts at the top of the bottom quarter of the screen, and "The Painted Painter" lettering rests just
      // above it. The picture is scaled (equal proportions) so the lettering lands there with the picture's top at the top of
      // the screen; it is never much narrower than the screen (a bit of the top row can be cut off instead) nor much wider
      // than it (on a tall phone screen the picture then starts a little lower, over the blurred fill).
      let cardTop = Math.round(screenHeight * 0.75);
      const letteringBottom = cardTop - LETTERING_GAP;
      const fit = letteringBottom / TITLE_BOTTOM;
      const maxSize = window.innerWidth * MAX_WIDTH_OVER_SCREEN;
      if (fit > maxSize) {
        // A tall, narrow screen (a phone held upright): the picture can't be big enough to put the lettering that low, so the
        // picture stays at its widest with its top at the top of the screen, and the estimator moves up to stay just below the
        // lettering. Superman, the lettering and the estimator are all pulled up together.
        size = Math.round(maxSize);
        startShift = 0;
        cardTop = Math.round(size * TITLE_BOTTOM + LETTERING_GAP);
      } else {
        size = Math.round(Math.max(window.innerWidth * MIN_WIDTH_OVER_SCREEN, fit));
        startShift = Math.round(letteringBottom - size * TITLE_BOTTOM);
      }
      root.style.setProperty('--hero-size', `${size}px`);
      // (the card sits 40px below the top of the page content that follows the spacer)
      root.style.setProperty('--hero-spacer', `${Math.max(0, cardTop - headerHeight - 40)}px`);
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
