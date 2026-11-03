import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import type { NetworkPainter } from '../lib/networkPainters';
import { LOCAL_ZOOM, US_VIEW, zipToLatLng } from '../lib/mapCenter';

// The Painted Painter's version of the map: orange paint-drop pins for painters, orange numbered circles where they cluster.
const ACCENT = '#ff7a3d';

/** A house painter's brush, not an artist's: a wide flat brush with a short wooden handle, a metal ferrule and thick bristles dipped in the brand orange. Its tip is the spot on the map. */
const BRUSH_W = 38;
const BRUSH_H = 54;
const pinIcon = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="${BRUSH_W}" height="${BRUSH_H}" viewBox="0 0 38 54">
    <!-- a white edge so it reads on any map -->
    <g fill="#fff" stroke="#fff" stroke-width="4" stroke-linejoin="round">
      <path d="M15 3Q19 0 23 3L24 15H14Z"/>
      <rect x="9" y="15" width="20" height="11"/>
      <path d="M9 26H29L30 43Q19 48 8 43Z"/>
      <path d="M19 47Q17 51 19 53Q21 51 19 47Z"/>
    </g>
    <!-- the handle -->
    <path d="M15 3Q19 0 23 3L24 15H14Z" fill="#b07a3c" stroke="#5c3a14" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M17 5.5L17.6 14M20.5 5L20.6 14" stroke="#d9a35e" stroke-width="1" fill="none"/>
    <!-- the ferrule -->
    <rect x="9" y="15" width="20" height="11" rx="1.5" fill="#c9ced6" stroke="#5b616b" stroke-width="1.2"/>
    <path d="M9.6 18.5H28.4M9.6 22.5H28.4" stroke="#8f96a1" stroke-width="1"/>
    <circle cx="12.3" cy="20.5" r="1" fill="#5b616b"/><circle cx="25.7" cy="20.5" r="1" fill="#5b616b"/>
    <!-- the bristles, with the paint at their tips -->
    <path d="M9 26H29L30 43Q19 48 8 43Z" fill="#f4e7c6" stroke="#85734a" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M13 27.5L12.6 43M17 27.5L16.8 45M21 27.5L21.2 45M25 27.5L25.4 43" stroke="#cdb98a" stroke-width="0.9" fill="none"/>
    <path d="M8.3 36.5Q19 41.5 29.7 36.5L30 43Q19 48 8 43Z" fill="${ACCENT}" stroke="#b9461a" stroke-width="1.1" stroke-linejoin="round"/>
    <path d="M19 47Q17 51 19 53Q21 51 19 47Z" fill="${ACCENT}" stroke="#b9461a" stroke-width="0.8"/>
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
        icon: { url: pinIcon, scaledSize: new google.maps.Size(BRUSH_W, BRUSH_H), anchor: new google.maps.Point(BRUSH_W / 2, BRUSH_H - 1) },
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
