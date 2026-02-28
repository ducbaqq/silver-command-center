import axios from 'axios';
import { SentimentData, SentimentAccount } from '../types';
import { config } from '../config';

const MONITORED_ACCOUNTS = [
  '@KitcoNewsNOW',
  '@SilverInstitute',
  '@silverguru22',
  '@TedJButler',
  '@GoldSilver_com',
  '@CliveMaund',
  '@badcharts1',
  '@keith_neumeyer',
  '@PeterLBrandt',
  '@SilverSeekcom',
];

export async function fetchSentimentData(previousSentiment?: SentimentData): Promise<SentimentData> {
  // If X API bearer token is configured, attempt to fetch recent tweets
  if (config.xBearerToken) {
    try {
      return await fetchLiveSentiment();
    } catch (e) {
      console.error('[Sentiment] X API error, falling back to cached data:', e);
    }
  }

  // Return previous data or placeholder
  if (previousSentiment && previousSentiment.overallBullish > 0) {
    return previousSentiment;
  }

  return {
    overallBullish: 0,
    summary: 'X API not configured — add X_BEARER_TOKEN to .env to enable live sentiment',
    topReasons: [
      'Configure X API access to enable real-time sentiment monitoring',
      'Register at https://developer.twitter.com/ for a free bearer token',
    ],
    accounts: MONITORED_ACCOUNTS.map((handle) => ({
      handle,
      stance: 'Unknown',
      note: 'Requires X API bearer token — see README',
    })),
  };
}

async function fetchLiveSentiment(): Promise<SentimentData> {
  const accounts: SentimentAccount[] = [];
  let bullishCount = 0;

  for (const handle of MONITORED_ACCOUNTS.slice(0, 5)) {
    // Limit to avoid rate limits
    try {
      const username = handle.replace('@', '');
      const res = await axios.get(
        `https://api.twitter.com/2/tweets/search/recent?query=from:${username} (silver OR gold OR precious)&max_results=10&tweet.fields=created_at,text`,
        {
          headers: { Authorization: `Bearer ${config.xBearerToken}` },
          timeout: 10000,
        }
      );

      const tweets = res.data?.data || [];
      const sentiment = analyzeTweetSentiment(tweets as Array<{ text: string }>);
      if (sentiment.bullish) bullishCount++;

      accounts.push({
        handle,
        stance: sentiment.stance,
        note: sentiment.latestNote,
      });
    } catch (e) {
      accounts.push({
        handle,
        stance: 'Error',
        note: 'Could not fetch tweets',
      });
    }
  }

  const pct = accounts.length > 0 ? Math.round((bullishCount / accounts.length) * 100) : 0;

  return {
    overallBullish: pct,
    summary: `${pct}% bullish across ${accounts.length} monitored accounts`,
    topReasons: ['Live sentiment from X/Twitter API'],
    accounts,
  };
}

function analyzeTweetSentiment(tweets: Array<{ text: string }>): {
  bullish: boolean;
  stance: string;
  latestNote: string;
} {
  if (!tweets || tweets.length === 0) {
    return { bullish: false, stance: 'Inactive', latestNote: 'No recent silver-related tweets' };
  }

  const bullishKeywords = [
    'buy', 'bull', 'surge', 'rally', 'higher', 'breakout', 'squeeze',
    'deficit', 'moon', 'bullish', 'long', 'accumulate', 'strong',
  ];
  const bearishKeywords = [
    'sell', 'bear', 'crash', 'drop', 'lower', 'correction',
    'top', 'overbought', 'bearish', 'short', 'weak',
  ];

  let bullScore = 0;
  let bearScore = 0;

  for (const tweet of tweets) {
    const text = (tweet.text || '').toLowerCase();
    for (const kw of bullishKeywords) {
      if (text.includes(kw)) bullScore++;
    }
    for (const kw of bearishKeywords) {
      if (text.includes(kw)) bearScore++;
    }
  }

  const isBullish = bullScore > bearScore;
  let stance: string;
  if (bullScore > bearScore * 2) {
    stance = 'Very Bullish';
  } else if (bullScore > bearScore) {
    stance = 'Bullish';
  } else if (bearScore > bullScore * 2) {
    stance = 'Very Bearish';
  } else if (bearScore > bullScore) {
    stance = 'Bearish';
  } else {
    stance = 'Neutral';
  }

  const latestText = tweets[0]?.text || '';
  const latestNote =
    latestText.length > 120 ? latestText.substring(0, 117) + '...' : latestText || 'No content';

  return { bullish: isBullish, stance, latestNote };
}
