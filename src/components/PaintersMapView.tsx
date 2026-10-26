import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import type { NetworkPainter } from '../lib/networkPainters';
import { LOCAL_ZOOM, US_VIEW, zipToLatLng } from '../lib/mapCenter';

// The Painted Painter's version of the map: orange paint-drop pins for painters, orange numbered circles where they cluster.
const ACCENT = '#ff7a3d';

const pinIcon = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="34" height="48" viewBox="0 0 34 48">
    <path d="M17 0C7.6 0 0 7.4 0 16.6 0 29 17 48 17 48s17-19 17-31.4C34 7.4 26.4 0 17 0z" fill="${ACCENT}"/>
    <circle cx="17" cy="16.5" r="11" fill="white"/>
    <!-- a paintbrush -->
    <g transform="rotate(35 17 16.5)">
      <rect x="15.6" y="7" width="2.8" height="8" rx="1.2" fill="#8a5a2b"/>
      <rect x="14.6" y="14.5" width="4.8" height="2.6" fill="#b9bec6"/>
      <path d="M14.6 17.1h4.8l-.6 5.2q-1.8 1.2-3.6 0z" fill="${ACCENT}"/>
    </g>
  </svg>`)}`;

const clusterIcon = (count: number): string => {
  const size = Math.min(48, 30 + Math.log10(count) * 10);
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 50 50">
      <circle cx="25" cy="25" r="24" fill="${ACCENT}"/>
      <text x="25" y="26" font-family="Arial, sans-serif" font-size="15" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle">${count}</text>
    </svg>`)}`;
};

const stars = (rating: number) => '★'.repeat(Math.round(rating)) + '☆'.repeat(5 - Math.round(rating));

function popupContent(p: NetworkPainter, open: (id: string) => void): HTMLElement {
  const div = document.createElement('div');
  div.style.cssText = 'font-family: Lato, Arial, sans-serif; font-size: 13px; color: #2a2318; min-width: 160px';
  const name = document.createElement('a');
  name.href = `/painters/${p.id}`;
  name.textContent = p.company_name;
  name.style.cssText = 'display:block; font-weight:700; color:#2563eb; text-decoration:none; margin-bottom:2px';
  name.onclick = (e) => {
    e.preventDefault();
    open(p.id);
  };
  div.append(name);
  if (p.city || p.state) {
    const where = document.createElement('div');
    where.textContent = [p.city, p.state].filter(Boolean).join(', ');
    div.append(where);
  }
  if (p.review_count > 0) {
    const rating = document.createElement('div');
    rating.style.color = '#d97706';
    rating.textContent = `${stars(p.avg_rating)} ${Number(p.avg_rating).toFixed(1)} (${p.review_count})`;
    div.append(rating);
  }
  return div;
}

interface Props {
  painters: NetworkPainter[];
  /** Where to open: this ZIP at city level. Without one the map opens on the whole US. */
  centerZip?: string | null;
  height?: string;
}

/**
 * The map itself: a pin for each painter on the network, clustered when zoomed out. Pins are added and removed as the list changes,
 * so a painter who joins or is removed shows up or vanishes at once. Opens on `centerZip` when given, otherwise on the whole US.
 */
export default function PaintersMapView({ painters, centerZip, height = '500px' }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  const mapRef = useRef<google.maps.Map | null>(null);
  const infoRef = useRef<google.maps.InfoWindow | null>(null);
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const markersRef = useRef(new Map<string, { marker: google.maps.Marker; sig: string }>());

  // the map and the clusterer, once (effects run in order, so the two below always find them in place)
  useEffect(() => {
    if (!ref.current) return;
    const map = new google.maps.Map(ref.current, {
      center: US_VIEW.center,
      zoom: US_VIEW.zoom,
      minZoom: 3,
      maxZoom: 18,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      zoomControl: true,
      gestureHandling: 'greedy', // one-finger pan on phones
      styles: [{ featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }],
    });
    const info = new google.maps.InfoWindow();
    map.addListener('click', () => info.close());
    const clusterer = new MarkerClusterer({
      map,
      markers: [],
      renderer: {
        render: ({ count, position }) =>
          new google.maps.Marker({
            position,
            icon: { url: clusterIcon(count), scaledSize: new google.maps.Size(44, 44), anchor: new google.maps.Point(22, 22) },
            zIndex: Number(google.maps.Marker.MAX_ZINDEX) + count,
          }),
      },
    });
    mapRef.current = map;
    infoRef.current = info;
    clustererRef.current = clusterer;
    const markers = markersRef.current;

    return () => {
      info.close();
      clusterer.clearMarkers();
      markers.forEach(({ marker }) => marker.setMap(null));
      markers.clear();
      mapRef.current = null;
      infoRef.current = null;
      clustererRef.current = null;
    };
  }, []);

  // open on the customer's area (their profile ZIP, else the ZIP they gave the estimator); the whole US when there isn't one
  useEffect(() => {
    if (!centerZip) return;
    let cancelled = false;
    zipToLatLng(centerZip).then((at) => {
      if (cancelled || !at || !mapRef.current) return;
      mapRef.current.setCenter(at);
      mapRef.current.setZoom(LOCAL_ZOOM);
    });
    return () => {
      cancelled = true;
    };
  }, [centerZip]);

  // pins follow the list: add new painters, move or refresh changed ones, remove painters who are gone
  useEffect(() => {
    const map = mapRef.current;
    const info = infoRef.current;
    const clusterer = clustererRef.current;
    if (!map || !info || !clusterer) return;
    const markers = markersRef.current;
    const open = (id: string) => navigateRef.current(`/painters/${id}`);

    const seen = new Set<string>();
    for (const p of painters) {
      seen.add(p.id);
      const sig = `${p.latitude},${p.longitude},${p.company_name},${p.avg_rating},${p.review_count},${p.city},${p.state}`;
      const existing = markers.get(p.id);
      if (existing && existing.sig === sig) continue;
      if (existing) {
        clusterer.removeMarker(existing.marker);
        existing.marker.setMap(null);
      }
      const marker = new google.maps.Marker({
        position: { lat: p.latitude, lng: p.longitude },
        title: p.company_name,
        icon: { url: pinIcon, scaledSize: new google.maps.Size(34, 48), anchor: new google.maps.Point(17, 48) },
      });
      const show = () => {
        info.setContent(popupContent(p, open));
        info.open({ map, anchor: marker });
      };
      marker.addListener('click', show);
      marker.addListener('mouseover', show);
      clusterer.addMarker(marker);
      markers.set(p.id, { marker, sig });
    }
    for (const [id, { marker }] of markers) {
      if (!seen.has(id)) {
        clusterer.removeMarker(marker);
        marker.setMap(null);
        markers.delete(id);
      }
    }
  }, [painters]);

  return <div ref={ref} style={{ width: '100%', height }} role="application" aria-label="Map of painters" />;
}
