import { useEffect } from 'react';
import FeedStream from '../components/FeedStream';

// The whole painting feed on its own page (the front page shows the first few, above the footer).
const Feed = () => {
  useEffect(() => {
    document.title = 'Painting Feed | The Painted Painter';
  }, []);

  return (
    <div className="text-[var(--text-primary)]" style={{ minHeight: '100vh' }}>
      <section className="bg-[var(--bg-chrome)] text-[var(--text-primary)] py-14 border-b border-[var(--border)]">
        <div className="container-custom text-center">
          <h1 className="text-3xl md:text-4xl font-bold mb-3" style={{ fontFamily: "'Cabin', sans-serif" }}>Painting Feed</h1>
          <p className="text-[var(--text-secondary)] max-w-2xl mx-auto">Ideas and how-tos from around the web, painters worth a look, and what customers are saying about them.</p>
        </div>
      </section>
      <section style={{ padding: '28px 16px 60px' }}>
        <FeedStream />
      </section>
    </div>
  );
};

export default Feed;
