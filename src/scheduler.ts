import { config } from './config';
import { getData, updatePartial } from './store';
import { fetchPriceData } from './fetchers/price';
import { fetchCOTData } from './fetchers/cot';
import { fetchMacroData } from './fetchers/fred';
import { fetchNewsData } from './fetchers/news';
import { fetchSentimentData } from './fetchers/sentiment';
import { calculateTechnicals } from './fetchers/technicals';
import { SignalData, DashboardData } from './types';

// ── Signal Scoring ──────────────────────────────────────────────────────────
function generateSignal(data: Partial<DashboardData>): SignalData {
  let score = 50;
  const reasons: string[] = [];

  if (data.price && data.technicals) {
    const rsi = data.technicals.rsi14;
    if (rsi > 0) {
      if (rsi > 50 && rsi < 70) {
        score += 10;
        reasons.push('RSI in bullish zone without being overbought');
      } else if (rsi >= 70) {
        score -= 5;
        reasons.push('RSI overbought — caution warranted');
      } else if (rsi < 30) {
        score += 5;
        reasons.push('RSI oversold — potential bounce setup');
      } else if (rsi <= 50 && rsi >= 30) {
        score -= 5;
        reasons.push('RSI in bearish zone');
      }
    }

    if (data.technicals.macdSignal === 'BUY') {
      score += 10;
      reasons.push('MACD bullish crossover');
    } else if (data.technicals.macdSignal === 'SELL') {
      score -= 10;
      reasons.push('MACD bearish crossover');
    }

    if (data.technicals.priceVs50SMA.startsWith('ABOVE')) {
      score += 8;
      reasons.push('Price above 50-day SMA');
    } else if (data.technicals.priceVs50SMA.startsWith('BELOW') && data.technicals.sma50 > 0) {
      score -= 8;
      reasons.push('Price below 50-day SMA');
    }

    if (data.technicals.priceVs200SMA.startsWith('ABOVE')) {
      score += 8;
      reasons.push('Price above 200-day SMA');
    } else if (data.technicals.priceVs200SMA.startsWith('BELOW') && data.technicals.sma200 > 0) {
      score -= 8;
      reasons.push('Price below 200-day SMA');
    }
  }

  if (data.price?.dayChangePct !== undefined) {
    if (data.price.dayChangePct > 1) {
      score += 5;
      reasons.push(`Up ${data.price.dayChangePct}% today`);
    } else if (data.price.dayChangePct < -1) {
      score -= 5;
      reasons.push(`Down ${Math.abs(data.price.dayChangePct)}% today`);
    }
  }

  if (data.positioning) {
    const specNet = data.positioning.specNetLong;
    if (specNet > 50000) {
      score += 7;
      reasons.push(`Specs net long ${specNet.toLocaleString()} contracts`);
    } else if (specNet > 0) {
      score += 3;
      reasons.push('Specs net long');
    } else if (specNet < -20000) {
      score -= 7;
      reasons.push(`Specs net short ${Math.abs(specNet).toLocaleString()} contracts`);
    }
  }

  if (data.macro) {
    const realRate = data.macro.realRate10Y;
    if (realRate !== 0) {
      if (realRate < 1.5) {
        score += 8;
        reasons.push(`Real rates at ${realRate}% — very supportive for metals`);
      } else if (realRate < 2.5) {
        score += 4;
        reasons.push(`Real rates at ${realRate}% — supportive for metals`);
      } else if (realRate > 3) {
        score -= 8;
        reasons.push(`Real rates at ${realRate}% — headwind for metals`);
      }
    }

    const dxy = data.macro.dxy;
    if (dxy !== 0) {
      if (dxy < 100) {
        score += 5;
        reasons.push(`DXY at ${dxy} — weak dollar supports silver`);
      } else if (dxy > 108) {
        score -= 5;
        reasons.push(`DXY at ${dxy} — strong dollar headwind`);
      }
    }
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  const action: 'BUY' | 'SELL' | 'HOLD' =
    score >= 65 ? 'BUY' : score <= 35 ? 'SELL' : 'HOLD';

  return {
    action,
    confidence: score,
    reason: reasons.length > 0
      ? reasons.join('. ')
      : 'Insufficient data for signal generation — more price history needed.',
  };
}

// ── Broadcast ───────────────────────────────────────────────────────────────
function broadcast(data: DashboardData): void {
  // Lazy import to avoid circular dependency with index.ts
  try {
    const { io } = require('./index');
    if (io) {
      io.emit('dashboard:update', data);
      const clientCount = io.engine?.clientsCount ?? 0;
      console.log(`[WS] Broadcast to ${clientCount} client(s)`);
    }
  } catch {
    // io not ready yet (during first startup tick)
  }
}

// ── Refresh ─────────────────────────────────────────────────────────────────
export async function refreshAll(): Promise<void> {
  console.log(`[Scheduler] Refreshing at ${new Date().toISOString()}...`);

  const existing = getData();

  try {
    const [priceResult, cotResult, macroResult, newsResult, sentimentResult] =
      await Promise.allSettled([
        fetchPriceData(existing?.price),
        fetchCOTData(),
        fetchMacroData(existing?.macro),
        fetchNewsData(),
        fetchSentimentData(existing?.sentiment),
      ]);

    const priceData = priceResult.status === 'fulfilled' ? priceResult.value : null;
    const cotData = cotResult.status === 'fulfilled' ? cotResult.value : null;
    const macroData = macroResult.status === 'fulfilled' ? macroResult.value : null;
    const newsData = newsResult.status === 'fulfilled' ? newsResult.value : [];
    const sentimentData = sentimentResult.status === 'fulfilled' ? sentimentResult.value : null;

    if (priceResult.status === 'rejected') console.error('[Price] Failed:', priceResult.reason?.message || priceResult.reason);
    if (cotResult.status === 'rejected') console.error('[COT] Failed:', cotResult.reason?.message || cotResult.reason);
    if (macroResult.status === 'rejected') console.error('[Macro] Failed:', macroResult.reason?.message || macroResult.reason);
    if (newsResult.status === 'rejected') console.error('[News] Failed:', newsResult.reason?.message || newsResult.reason);

    const techData = priceData ? calculateTechnicals(priceData.spot) : null;

    const update: Partial<DashboardData> = {
      lastUpdated: new Date().toISOString(),
    };

    if (priceData) update.price = priceData;
    if (techData) update.technicals = techData;
    if (cotData) update.positioning = cotData;
    if (macroData) update.macro = macroData;
    if (newsData.length > 0) update.news = newsData;
    if (sentimentData) update.sentiment = sentimentData;

    if (existing?.fundamentals) {
      update.fundamentals = existing.fundamentals;
    } else {
      update.fundamentals = {
        marketStatus: '6th consecutive annual structural deficit',
        deficit: '67M oz projected (2026)',
        cumulativeDeficit: '800M+ oz since 2021',
        totalSupply: '1.05B oz',
        mineProduction: '820M oz',
        industrialDemand: '650M oz',
        physicalInvestment: '227M oz',
        criticalFactors: [
          'China controls ~70% of refined silver supply chain',
          'US added silver to Critical Minerals list (2024)',
          'Fresnillo cut 2026 guidance to 42–46.5M oz',
          'Solar PV demand consuming 20%+ of annual supply',
          'EV + defense electronics driving structural industrial growth',
        ],
      };
    }

    update.signal = generateSignal({ ...existing, ...update });
    updatePartial(update);

    // Push to all connected WebSocket clients
    const fullData = getData();
    if (fullData) broadcast(fullData);

    console.log(
      `[Scheduler] Done — $${update.price?.spot ?? 'unchanged'} | ${update.signal?.action} (${update.signal?.confidence}%)`
    );
  } catch (e) {
    console.error('[Scheduler] Unexpected error:', e);
  }
}

// ── Start ───────────────────────────────────────────────────────────────────
export function startScheduler(): void {
  const seconds = config.refreshIntervalSeconds;
  const label = seconds >= 60 ? `${Math.round(seconds / 60)} min` : `${seconds}s`;

  console.log(`[Scheduler] Refresh interval: every ${label} (${seconds}s)`);

  // Run immediately on startup
  refreshAll().catch((e) => console.error('[Scheduler] Initial refresh error:', e));

  // Use setInterval for sub-minute precision
  setInterval(() => {
    refreshAll().catch((e) => console.error('[Scheduler] Refresh error:', e));
  }, seconds * 1000);
}
