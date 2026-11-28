import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchFeed, mixFeed, type FeedArticle, type FeedItem, type FeedPainter, type FeedReview } from '../lib/feed';

// A feed of painting: articles from around the web, featured painters worth a look, and what customers say about painters. Each card leads somewhere: an
// article opens on its own site, a painter or a review opens that painter's page.

const CARD: React.CSSProperties = { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', marginBottom: 20 };
const LABEL: React.CSSProperties = { fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent)' };
/** Eight lines of text, then cut. */
const EIGHT_LINES: React.CSSProperties = { display: '-webkit-box', WebkitLineClamp: 8, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.55 };

function Stars({ rating }: { rating: number }) {
  const full = Math.round(rating);
  return <span style={{ color: 'var(--accent)', letterSpacing: 1 }} aria-label={`${rating} out of 5 stars`}>{'★'.repeat(full)}{'☆'.repeat(5 - full)}</span>;
}

const place = (city: string | null, state: string | null) => [city, state].filter(Boolean).join(', ');

function ArticleCard({ article }: { article: FeedArticle }) {
  const [imageOk, setImageOk] = useState(true);
  return (
    <a href={article.url} target="_blank" rel="noopener noreferrer" style={{ ...CARD, display: 'block', textDecoration: 'none', color: 'inherit' }}>
      {article.image && imageOk && (
        <img src={article.image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setImageOk(false)} style={{ width: '100%', height: 220, objectFit: 'cover', display: 'block' }} />
      )}
      <div style={{ padding: '16px 20px 18px' }}>
        <div style={LABEL}>Painting article · {article.source}</div>
        <h2 style={{ fontFamily: "'Cabin', sans-serif", fontSize: '1.25rem', fontWeight: 700, margin: '6px 0 10px', color: 'var(--text-primary)' }}>{article.title}</h2>
        <p style={{ ...EIGHT_LINES, margin: 0, color: 'var(--text-secondary)', fontSize: '0.95rem' }}>{article.snippet}</p>
        <div style={{ marginTop: 12, fontWeight: 600, fontSize: '0.9rem', color: 'var(--accent)' }}>Read the full article on {article.source} →</div>
      </div>
    </a>
  );
}

function PainterCard({ painter }: { painter: FeedPainter }) {
  return (
    <div style={CARD}>
      <Link to={`/painters/${painter.id}`} style={{ display: 'block' }} aria-label={`See ${painter.companyName}`}>
        <img src={painter.photo.url} alt={painter.photo.caption ?? `Work by ${painter.companyName}`} loading="lazy" style={{ width: '100%', height: 280, objectFit: 'cover', display: 'block' }} />
      </Link>
      <div style={{ padding: '16px 20px 18px' }}>
        <div style={LABEL}>Featured painter</div>
        <h2 style={{ fontFamily: "'Cabin', sans-serif", fontSize: '1.3rem', fontWeight: 700, margin: '6px 0 2px' }}>
          <Link to={`/painters/${painter.id}`} style={{ color: 'var(--text-primary)', textDecoration: 'none' }}>{painter.companyName}</Link>
        </h2>
        <div style={{ color: 'var(--text-faint)', fontSize: '0.9rem', marginBottom: 8 }}>
          {place(painter.city, painter.state)}{painter.photo.caption ? ` · ${painter.photo.caption}` : ''}
        </div>
        <div style={{ marginBottom: 10 }}>
          <Stars rating={painter.rating.average} /> <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{painter.rating.average.toFixed(1)} · {painter.rating.count} review{painter.rating.count === 1 ? '' : 's'}</span>
        </div>
        {painter.quote && (
          <p style={{ margin: '0 0 12px', fontStyle: 'italic', color: 'var(--text-secondary)', lineHeight: 1.5 }}>“{painter.quote.text}” <span style={{ fontStyle: 'normal', color: 'var(--text-faint)' }}>— {painter.quote.reviewer}</span></p>
        )}
        <Link to={`/painters/${painter.id}`} style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--accent)', textDecoration: 'none' }}>See their work, credentials and reviews →</Link>
      </div>
    </div>
  );
}

function ReviewCard({ review }: { review: FeedReview }) {
  return (
    <div style={{ ...CARD, padding: '16px 20px 18px' }}>
      <div style={LABEL}>From a customer</div>
      <div style={{ margin: '8px 0 6px' }}><Stars rating={review.rating} /></div>
      {review.title && <h2 style={{ fontFamily: "'Cabin', sans-serif", fontSize: '1.1rem', fontWeight: 700, margin: '0 0 6px' }}>{review.title}</h2>}
      <p style={{ ...EIGHT_LINES, margin: '0 0 12px', color: 'var(--text-secondary)', fontSize: '0.95rem' }}>{review.text}</p>
      <div style={{ fontSize: '0.9rem', color: 'var(--text-faint)' }}>
        {review.reviewer} reviewed{' '}
        <Link to={`/painters/${review.painter.id}`} style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>{review.painter.companyName}</Link>
        {place(review.painter.city, review.painter.state) ? ` · ${place(review.painter.city, review.painter.state)}` : ''}
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ ...CARD, height: 260, opacity: 0.5 }} aria-hidden="true" />
      ))}
    </>
  );
}

const Feed = () => {
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [failed, setFailed] = useState(false);

  const fetchAndShow = useCallback(() => {
    fetchFeed()
      .then((data) => setItems(mixFeed(data)))
      .catch(() => setFailed(true));
  }, []);

  /** Shuffle / Try again: back to the placeholders, then a fresh mix. */
  const load = () => {
    setItems(null);
    setFailed(false);
    fetchAndShow();
  };

  useEffect(() => {
    document.title = 'Painting Feed | The Painted Painter';
    fetchAndShow();
  }, [fetchAndShow]);

  return (
    <div className="text-[var(--text-primary)]" style={{ minHeight: '100vh' }}>
      <section className="bg-[var(--bg-chrome)] text-[var(--text-primary)] py-14 border-b border-[var(--border)]">
        <div className="container-custom text-center">
          <h1 className="text-3xl md:text-4xl font-bold mb-3" style={{ fontFamily: "'Cabin', sans-serif" }}>Painting Feed</h1>
          <p className="text-[var(--text-secondary)] max-w-2xl mx-auto">Ideas and how-tos from around the web, painters worth a look, and what customers are saying about them.</p>
        </div>
      </section>

      <section style={{ padding: '28px 16px 60px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
            <button onClick={load} style={{ padding: '7px 16px', borderRadius: 20, border: '1px solid var(--border-strong)', background: 'var(--bg-surface)', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}>Shuffle</button>
          </div>

          {items === null && !failed && <Skeleton />}
          {failed && (
            <div style={{ ...CARD, padding: 24, textAlign: 'center' }}>
              <p style={{ margin: '0 0 12px', color: 'var(--text-secondary)' }}>The feed could not load right now.</p>
              <button onClick={load} style={{ padding: '8px 20px', borderRadius: 20, border: 'none', background: 'var(--accent)', color: 'var(--bg-chrome)', fontWeight: 700, cursor: 'pointer' }}>Try again</button>
            </div>
          )}
          {items?.map((item) =>
            item.kind === 'article' ? <ArticleCard key={item.key} article={item.article} /> : item.kind === 'painter' ? <PainterCard key={item.key} painter={item.painter} /> : <ReviewCard key={item.key} review={item.review} />,
          )}
          {items && items.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-faint)' }}>Nothing to show yet. Check back soon.</p>}

          {items && items.length > 0 && (
            <p style={{ textAlign: 'center', color: 'var(--text-faint)', fontSize: '0.8rem', marginTop: 28 }}>
              Article excerpts belong to their publishers; tap one to read the full story on its own site.
            </p>
          )}
        </div>
      </section>
    </div>
  );
};

export default Feed;
