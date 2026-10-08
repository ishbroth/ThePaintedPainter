import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * The hero collage (Superman with the houses around him) as a translucent, full-screen background that stays fixed
 * while the page scrolls. It replaces the old faint house photos. The sharp picture starts just below the header
 * (and slides up as the header scrolls away); a blurred copy fills the rest of the screen. On the home page it is
 * stronger; on working pages (forms, dashboards) it is kept very light so it never competes with the content.
 */
const SiteBackground = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    const root = document.documentElement;
    let headerHeight = 0;
    let frame = 0;

    const measure = () => {
      const main = document.querySelector('main');
      headerHeight = main ? Math.max(0, Math.round(main.getBoundingClientRect().top + window.scrollY)) : 0;
      root.style.setProperty('--header-h', `${headerHeight}px`);
      place();
    };
    const place = () => {
      frame = 0;
      root.style.setProperty('--hero-top', `${Math.max(0, headerHeight - window.scrollY)}px`);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(place);
    };

    measure();
    // the header can change height after fonts, the sign-in state or a route change
    const settle = window.setTimeout(measure, 300);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', measure);
    return () => {
      window.clearTimeout(settle);
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', measure);
    };
  }, [pathname]);

  return (
    <div className={`site-hero-bg${pathname === '/' ? ' site-hero-bg--home' : ''}`} aria-hidden="true">
      <div className="site-hero-bg__img" />
    </div>
  );
};

export default SiteBackground;
