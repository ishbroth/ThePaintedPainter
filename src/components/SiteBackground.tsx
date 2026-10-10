import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/** The picture is just the Superman panel: its width over its height. */
const ASPECT = 1566 / 774;
/** The picture is a little taller than the screen (so it has room to move as the page scrolls) but never wider than 1.35x the screen. */
const HEIGHT_OVER_SCREEN = 1.1;
const MAX_WIDTH_OVER_SCREEN = 1.35;
/** Where the "The Painted Painter" lettering sits in the picture, as shares of its height (top of the letters, bottom of the letters). */
const TITLE_TOP = 0.4655;
const TITLE_BOTTOM = 0.6492;
/** The estimator card starts this many pixels below the lettering. */
const CARD_GAP = 34;

/**
 * Superman (the painter with the roller and the brush) as a translucent background.
 *
 * - Just the Superman panel, no houses. It is scaled (equal proportions) to fill the screen from top to bottom, never much
 *   wider than the screen, so on a laptop the roller and the brush stay near the edges and Superman fills the view.
 * - It is not pinned. As you scroll, it moves up slowly, in proportion to how much page there is to scroll, so the bottom
 *   of the picture and the bottom of the page come into view together.
 * - On a tall, narrow screen (a phone) the picture can be shorter than the screen; a blurred copy fills the rest.
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
      // taller than the screen by a little, unless that would make it wider than the screen allows (then it is as wide as allowed)
      const width = Math.round(Math.min(screenHeight * HEIGHT_OVER_SCREEN * ASPECT, window.innerWidth * MAX_WIDTH_OVER_SCREEN));
      size = Math.round(width / ASPECT); // the picture's height
      startShift = 0; // its top is at the top of the screen
      root.style.setProperty('--hero-w', `${width}px`);
      root.style.setProperty('--hero-size', `${size}px`);
      // the estimator card starts a little below the lettering (and never so low that none of it shows)
      const cardTop = Math.min(Math.round(size * TITLE_BOTTOM + CARD_GAP), Math.round(screenHeight * 0.85));
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
