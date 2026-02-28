import Parser from 'rss-parser';
import { NewsItem } from '../types';

const parser = new Parser({
  timeout: 15000,
  headers: {
    'User-Agent': 'SilverCommandCenter/1.0 (self-hosted dashboard)',
  },
});

const RSS_FEEDS = [
  {
    name: 'Kitco',
    url: 'https://www.kitco.com/feed/rss/news/precious-metals/',
  },
  {
    name: 'Google News',
    url: 'https://news.google.com/rss/search?q=silver+price+precious+metals&hl=en-US&gl=US&ceid=US:en',
  },
  {
    name: 'SilverSeek',
    url: 'https://silverseek.com/rss.xml',
  },
];

export async function fetchNewsData(): Promise<NewsItem[]> {
  const allItems: NewsItem[] = [];

  for (const feed of RSS_FEEDS) {
    try {
      const parsed = await parser.parseURL(feed.url);
      const items = (parsed.items || []).slice(0, 12).map((item) => {
        let timeStr = 'Unknown';
        if (item.pubDate) {
          try {
            const d = new Date(item.pubDate);
            timeStr = d.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });
          } catch {
            timeStr = item.pubDate;
          }
        }
        return {
          time: timeStr,
          headline: (item.title || 'No title').trim(),
          source: item.creator || item.author || feed.name,
          url: item.link || undefined,
          _rawDate: item.pubDate ? new Date(item.pubDate).getTime() : 0,
        };
      });
      allItems.push(...items);
      console.log(`[News] Fetched ${items.length} items from ${feed.name}`);
    } catch (e) {
      console.error(`[News] Error fetching RSS from ${feed.name}:`, e);
    }
  }

  // Sort by most recent, limit to 20
  return allItems
    .sort((a, b) => (b as any)._rawDate - (a as any)._rawDate)
    .slice(0, 20)
    .map(({ time, headline, source, url }) => ({ time, headline, source, url }));
}
