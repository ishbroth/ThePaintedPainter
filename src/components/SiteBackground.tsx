import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/** How much taller than the screen the picture is, so its bottom runs past the bottom of the screen. */
const HEIGHT_OVER_SCREEN = 1.12;
/** Where Superman's body ends, as a share of the picture's height (the estimator card starts just under it). */
const BODY_BOTTOM = 0.76;

/**
 * The hero collage (Superman with the houses around him) as a translucent background. It is stretched to fill the screen
 * (a little past the left, right and bottom edges is fine), starts at the very top of the page where the header is, and
 * instead of staying exactly fixed it travels in proportion to how far you have scrolled through the page: at the top of
 * the page you see the top of the picture, at the bottom of the page you see its bottom. A blurred copy fills any gap.
 * On the home page it is stronger; on working pages (forms, dashboards) it is kept very light.
 */
const SiteBackground = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    const root = document.documentElement;
    let frame = 0;
    let boxHeight = 0;
    let screenHeight = 0;

    const layout = () => {
      screenHeight = window.innerHeight;
      const screenWidth = window.innerWidth;
      boxHeight = Math.round(screenHeight * HEIGHT_OVER_SCREEN);
      // wide screens stretch the picture sideways to fill; narrow ones crop the sides rather than squash it too far
      const boxWidth = Math.round(Math.min(Math.max(boxHeight, screenWidth * 1.04), screenWidth * 1.5));
      const main = document.querySelector('main');
      const headerHeight = main ? Math.max(0, Math.round(main.getBoundingClientRect().top + window.scrollY)) : 0;
      root.style.setProperty('--hero-w', `${boxWidth}px`);
      root.style.setProperty('--hero-h', `${boxHeight}px`);
      // the estimator card starts just below Superman's body, but never above the middle of the screen
      const cardTop = Math.max(screenHeight * 0.52, boxHeight * BODY_BOTTOM);
      root.style.setProperty('--hero-spacer', `${Math.max(0, Math.round(cardTop - headerHeight - 40))}px`);
      place();
    };

    const place = () => {
      frame = 0;
      const scrollable = document.documentElement.scrollHeight - screenHeight;
      const progress = scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0;
      // by the end of the page the picture has moved up by exactly its overhang past the screen
      root.style.setProperty('--hero-shift', `${-Math.round((boxHeight - screenHeight) * progress)}px`);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(place);
    };

    layout();
    // the header and page height can change after fonts load, sign-in state or a route change
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
