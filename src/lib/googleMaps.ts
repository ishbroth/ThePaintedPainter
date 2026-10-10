// Loads the Google Maps script once, on demand (when the home page map is opened), and tells subscribers how it went.
// The key is read from VITE_GOOGLE_MAPS_API_KEY. Until one is set the map shows a friendly "coming soon" panel instead.

import { useEffect, useState } from 'react';

export type GoogleMapsStatus = 'idle' | 'loading' | 'ready' | 'error' | 'no-key';

let status: GoogleMapsStatus = 'idle';
let started = false;
const listeners = new Set<() => void>();

function setStatus(next: GoogleMapsStatus) {
  status = next;
  listeners.forEach((fn) => fn());
}

function mapsReady(): boolean {
  return !!(window.google && window.google.maps && window.google.maps.Map);
}

function waitUntilReady() {
  if (mapsReady()) setStatus('ready');
  else window.setTimeout(waitUntilReady, 100);
}

function load() {
  if (started) return;
  started = true;
  if (mapsReady()) {
    setStatus('ready');
    return;
  }
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
  if (!apiKey) {
    setStatus('no-key');
    return;
  }
  setStatus('loading');
  (window as unknown as { initPaintedPainterMaps: () => void }).initPaintedPainterMaps = waitUntilReady;
  const script = document.createElement('script');
  script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&callback=initPaintedPainterMaps&loading=async`;
  script.async = true;
  script.defer = true;
  script.onerror = () => setStatus('error');
  document.head.appendChild(script);
}

/** Starts loading Google Maps the first time it is used and returns where that stands. */
export function useGoogleMaps(): GoogleMapsStatus {
  const [current, setCurrent] = useState<GoogleMapsStatus>(status);
  useEffect(() => {
    const listener = () => setCurrent(status);
    listeners.add(listener);
    load();
    listener();
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return current;
}
