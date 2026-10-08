import { useLocation } from 'react-router-dom';

/**
 * The hero image (Superman with the roller and brush) as a translucent, full-screen background that stays fixed while
 * the page scrolls. It replaces the old faint house photos. On the home page it is stronger; on working pages (forms,
 * dashboards) it is kept very light so it never competes with the content.
 */
const SiteBackground = () => {
  const { pathname } = useLocation();
  return <div className={`site-hero-bg${pathname === '/' ? ' site-hero-bg--home' : ''}`} aria-hidden="true" />;
};

export default SiteBackground;
