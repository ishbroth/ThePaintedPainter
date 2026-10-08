import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/** The picture is scaled (equal proportions) to a little wider than the screen, so the roller on the left and the brush on the right both stay in view. */
const WIDTH_OVER_SCREEN = 1.06;
/** Where Superman's body ends, as a share of the picture's height (the estimator card starts around there). */
const BODY_BOTTOM = 0.76;
/** Where the middle of the Superman panel sits on the screen at the start, as a share of the screen height. */
const PANEL_CENTER_AT_START = 0.47;

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
 * On the home page it is stronger; on working pages (forms, dashboards) it is kept very light.
 */
const SiteBackground = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    const root = document.documentElement;
    let frame = 0;
    let size = 0;
    let screenHeight = 0;
    let startShift = 0; // how far up the picture starts (0 = its top is at the top of the page)

    const layout = () => {
      screenHeight = window.innerHeight;
      size = Math.round(window.innerWidth * WIDTH_OVER_SCREEN);
      root.style.setProperty('--hero-size', `${size}px`);
      const overhang = Math.max(0, size - screenHeight);
      // taller than the screen: start with the Superman panel (roller and brush too) on screen instead of the top row of houses
      startShift = overhang > 0 ? -Math.min(overhang, Math.max(0, size * 0.5 - screenHeight * PANEL_CENTER_AT_START)) : 0;
      const main = document.querySelector('main');
      const headerHeight = main ? Math.max(0, Math.round(main.getBoundingClientRect().top + window.scrollY)) : 0;
      // The estimator card starts just under Superman's body, but never above the middle of the screen (so a small scroll
      // is what brings it into view and starts the spoken intro) and never so low that none of it shows.
      const cardTop = Math.min(Math.max(size * BODY_BOTTOM + startShift + 8, screenHeight * 0.52), screenHeight * 0.86);
      root.style.setProperty('--hero-spacer', `${Math.max(0, Math.round(cardTop - headerHeight - 40))}px`);
      place();
    };

    const place = () => {
      frame = 0;
      const overhang = Math.max(0, size - screenHeight);
      const scrollable = document.documentElement.scrollHeight - screenHeight;
      const progress = scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0;
      // from where it starts to the point where its bottom meets the bottom of the screen, reached at the end of the page
      const endShift = -overhang;
      root.style.setProperty('--hero-shift', `${Math.round(startShift + (endShift - startShift) * progress)}px`);
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
      <div className="site-hero-bg__img" />
    </div>
  );
};

export default SiteBackground;
