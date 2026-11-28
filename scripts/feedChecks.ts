// Checks for the painting feed: reading the article feeds (fixed samples, no network), the snippet and filter rules, review names, and how the feed is mixed.
//
//   npm run check:feed
import { clip, isAboutPainting, makeSnippet, parseFeed, reviewerLabel, stripHtml, toArticle, type FeedSource } from '../supabase/functions/_shared/newsFeed.ts';
import { mixFeed, type FeedData } from '../src/lib/feed.ts';

let failures = 0;
const check = (name: string, ok: boolean, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '\n        ' + detail}`);
};

const PAINT: FeedSource = { id: 't', name: 'Test Site', url: 'x', filter: false };
const GENERAL: FeedSource = { id: 'g', name: 'General Site', url: 'x', filter: true };

// a WordPress-style feed: CDATA, content:encoded with the full article, the "The post ... appeared first on" footer
const WP = `<?xml version="1.0"?><rss><channel>
<item><title>How to Deal With the Grooves When Painting Wood Paneling</title><link>https://example.com/article/paneling/</link>
<description><![CDATA[Ready to paint that old wood paneling? Fill the grooves with joint compound. The post How to Deal With the Grooves When Painting Wood Paneling appeared first on Test Site.]]></description>
<content:encoded><![CDATA[<p>Ready to paint that old wood paneling, but not sure what to do with the grooves? Get rid of them with joint compound.</p><p>Start by cleaning the paneling well. Then press compound into each groove and sand it smooth. Prime before you paint so the stain does not bleed through. ${'It takes a weekend and the result looks like drywall. '.repeat(20)}</p><img src="https://example.com/wp-content/a.jpg" />]]></content:encoded></item>
<item><title>Best Black Friday Kitchen Deals</title><link>https://example.com/deals/</link><description>Deals on pans. If you like this post you might also like Painted Dark Grey Kitchen Cabinets and Easy DIY Kitchen Project.</description></item>
<item><title>Give Your Room Some Life!</title><link>https://example.com/room?utm_source=x&amp;y=1</link><description>&lt;p&gt;We moved into a new house and I wanted a fun, colorful bedroom. I painted an accent wall in a bold teal and added stripes with painter&amp;#039;s tape and a little patience.&lt;/p&gt;&lt;p&gt;&lt;img src=&quot;https://example.com/room.jpg&quot; /&gt;&lt;/p&gt;</description>
<media:content url="https://example.com/room-media.jpg?size=720x845&amp;nocrop=1" /></item>
<item><title>No link here</title><description>A real description that is long enough to be a snippet but it has no link at all in the item.</description></item>
</channel></rss>`;

{
  const items = parseFeed(WP);
  check('feed: items with a title and a link are read, one without a link is dropped', items.length === 3, String(items.length));
  check('feed: the article image comes from content when the feed has no image field', items[0].image === 'https://example.com/wp-content/a.jpg', String(items[0].image));
  check('feed: a media:content image wins and its &amp; is decoded', items[2].image === 'https://example.com/room-media.jpg?size=720x845&nocrop=1', String(items[2].image));
  check('feed: a double-encoded description is read as text, not as tags', !/[<>]|&lt;|&#039;/.test(stripHtml(items[2].description)) && /painter's tape/.test(stripHtml(items[2].description)), stripHtml(items[2].description));

  const a0 = toArticle(items[0], PAINT)!;
  check('snippet: about eight lines of the article (not the whole thing) and no "appeared first on" footer', a0.snippet.length <= 720 && a0.snippet.length > 300 && !/appeared first on/i.test(a0.snippet), `${a0.snippet.length}: ${a0.snippet.slice(-80)}`);
  check('snippet: it ends on a sentence or a clean break, not mid-word', /[.!?]$|\.\.\.$/.test(a0.snippet), a0.snippet.slice(-40));
  check('snippet: it does not open by repeating the title', !a0.snippet.toLowerCase().startsWith(a0.title.toLowerCase()));
  check('article: the link, the source and an id are kept', a0.url === 'https://example.com/article/paneling/' && a0.source === 'Test Site' && a0.id.startsWith('t:'), JSON.stringify([a0.url, a0.source, a0.id]));
  check('article: a general home-improvement feed keeps only items about painting (a footer naming painted cabinets does not count)', toArticle(items[1], GENERAL) === null);
  check('article: ...and keeps the one that is about painting', toArticle(items[2], GENERAL) !== null);
  check('article: the link keeps its own query string (it is the publisher\'s tracking, not ours)', toArticle(items[2], GENERAL)?.url === 'https://example.com/room?utm_source=x&y=1', String(toArticle(items[2], GENERAL)?.url));
}

check('filter: painting words are recognised', isAboutPainting('How to Prime Walls Before You Paint', '') && isAboutPainting('Caulking tips', 'before you caulk the trim') && !isAboutPainting('A Better Waffle Iron', 'crisp waffles every time'));
check('snippet: short text is left whole', makeSnippet('T', 'A short but real description of a painting article about priming.', '').startsWith('A short but real'));

check('reviews: only a first name and last initial are shown', reviewerLabel('Sarah Mitchell') === 'Sarah M.' && reviewerLabel('Cher') === 'Cher' && reviewerLabel('') === 'A customer' && reviewerLabel(null) === 'A customer');
check('reviews: long text is clipped at a word with an ellipsis', clip('word '.repeat(100), 50).endsWith('...') && clip('word '.repeat(100), 50).length <= 54 && clip('short', 50) === 'short');

{
  const mk = (n: number, p: string) => Array.from({ length: n }, (_, i) => ({ id: `${p}${i}` }));
  const data = {
    articles: mk(8, 'a').map((x) => ({ ...x, title: 't', snippet: 's', url: 'u', source: 's', image: null })),
    painters: mk(2, 'p').map((x) => ({ ...x, companyName: 'c', city: null, state: null, photo: { url: 'u', caption: null }, rating: { average: 5, count: 1 }, quote: null })),
    reviews: mk(3, 'r').map((x) => ({ ...x, rating: 5, title: null, text: 't', reviewer: 'A.', painter: { id: 'p0', companyName: 'c', city: null, state: null } })),
  } as FeedData;
  const out = mixFeed(data);
  check('mix: everything is used exactly once', out.length === 13 && new Set(out.map((i) => i.key)).size === 13, String(out.length));
  check('mix: it starts with articles and works a painter and a review in among them', out[0].kind === 'article' && out[1].kind === 'article' && out[2].kind === 'painter' && out.slice(0, 6).some((i) => i.kind === 'review'), out.map((i) => i.kind[0]).join(''));
  check('mix: no more than three articles in a row until the others have run out', !/aaaa/.test(out.slice(0, 9).map((i) => i.kind[0]).join('')), out.map((i) => i.kind[0]).join(''));
  check('mix: with nothing but articles it still returns them all', mixFeed({ articles: data.articles, painters: [], reviews: [] }).length === 8);
  check('mix: an empty feed is an empty list', mixFeed({ articles: [], painters: [], reviews: [] }).length === 0);
}

console.log(failures ? `\n${failures} FAILED` : '\nall feed checks passed');
process.exit(failures ? 1 : 0);
