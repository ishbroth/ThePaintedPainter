import { useState } from 'react';
import { useGoogleMaps } from '../lib/googleMaps';
import PaintersMapView from './PaintersMapView';
import { hapticMedium } from '../lib/haptics';

/** "Find Painters Near You": a button that opens a real map right on the home page (the page grows downward). */
export default function PaintersMapSection() {
  const [expanded, setExpanded] = useState(false);
  return (
    <section className="map-section fade-in">
      <h2>Find Painters Near You</h2>
      <p className="map-subtitle">Browse verified painters across the country</p>
      <button
        type="button"
        className="map-link-btn"
        aria-expanded={expanded}
        onClick={() => {
          hapticMedium();
          setExpanded((e) => !e);
        }}
      >
        {expanded ? '▲ Hide Map' : '▼ Show Map'}
      </button>
      {expanded && (
        <div className="home-map-container">
          <MapBody />
        </div>
      )}
    </section>
  );
}

/** Only mounted once the map is opened, so Google Maps isn't loaded for people who never open it. */
function MapBody() {
  const status = useGoogleMaps();
  if (status === 'no-key' || status === 'error') {
    return (
      <div className="home-map-placeholder" style={{ height: 300 }}>
        <p>{status === 'error' ? 'The map could not be loaded.' : 'The painters map is coming soon.'}</p>
        <p className="map-note">{status === 'error' ? 'Please try refreshing the page.' : 'Painters will appear here as pins across the country.'}</p>
      </div>
    );
  }
  if (status !== 'ready') {
    return (
      <div className="home-map-placeholder" style={{ height: 300 }}>
        <p>Loading the map…</p>
      </div>
    );
  }
  return <PaintersMapView height="min(500px, 70vh)" />;
}
