// Google Analytics (the Google tag G-9CV2JX42F4, loaded in index.html). The site is a single-page app, so the tag's own automatic page view only covers
// the first page: every page the visitor moves to is sent from here. Only the web site loads the tag (not the iOS / Android app, not a local dev server),
// so these calls do nothing there.

type Gtag = (...args: unknown[]) => void;

/** The path without anything personal in it: no query string (emailed links carry tokens), and ids in the path are replaced. */
export function analyticsPath(pathname: string): string {
  return pathname.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id');
}

export function trackPageView(pathname: string): void {
  const gtag = (window as unknown as { gtag?: Gtag }).gtag;
  if (typeof gtag !== 'function') return;
  const path = analyticsPath(pathname);
  gtag('event', 'page_view', { page_path: path, page_location: window.location.origin + path, page_title: document.title });
}
