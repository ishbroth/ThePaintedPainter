import { useEffect, useState } from 'react';
import { describeVoices, prepareVoice } from '../lib/textToSpeech';

/** Open the site with ?voices at the end of the address to see which voices this device has and which one gets used. */
const VoiceCheck = () => {
  const show = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('voices');
  const [info, setInfo] = useState<{ all: string[]; chosen: string } | null>(null);
  useEffect(() => {
    if (!show) return;
    prepareVoice();
    const read = () => setInfo(describeVoices());
    read();
    const timer = window.setInterval(read, 1000);
    return () => window.clearInterval(timer);
  }, [show]);
  if (!show || !info) return null;
  return (
    <div style={{ position: 'fixed', inset: '8px 8px auto 8px', maxHeight: '70vh', overflow: 'auto', zIndex: 5000, background: '#fff', color: '#111', border: '2px solid #ff7a3d', borderRadius: 8, padding: 10, fontSize: 12, lineHeight: 1.4 }}>
      <strong>Voice used:</strong> {info.chosen}
      <br />
      <strong>Voices on this device ({info.all.length}):</strong>
      <ul style={{ margin: '4px 0 0', paddingLeft: 16 }}>
        {info.all.map((v) => (
          <li key={v}>{v}</li>
        ))}
      </ul>
    </div>
  );
};

export default VoiceCheck;
