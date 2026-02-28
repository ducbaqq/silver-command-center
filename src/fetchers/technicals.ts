import { TechnicalData } from '../types';

// Store price history in memory for calculations
let priceHistory: { date: string; close: number }[] = [];
const MAX_HISTORY = 250; // Need 200+ for 200-day SMA

export function addPricePoint(price: number): void {
  const today = new Date().toISOString().split('T')[0];
  // Avoid duplicates for same day — update existing entry
  if (priceHistory.length > 0 && priceHistory[priceHistory.length - 1].date === today) {
    priceHistory[priceHistory.length - 1].close = price;
  } else {
    priceHistory.push({ date: today, close: price });
  }
  // Trim to max
  if (priceHistory.length > MAX_HISTORY) {
    priceHistory = priceHistory.slice(-MAX_HISTORY);
  }
}

export function loadPriceHistory(history: { date: string; close: number }[]): void {
  priceHistory = history.slice(-MAX_HISTORY);
}

export function getPriceHistory(): { date: string; close: number }[] {
  return [...priceHistory];
}

function calculateSMA(period: number): number | null {
  if (priceHistory.length < period) return null;
  const slice = priceHistory.slice(-period);
  const sum = slice.reduce((acc, p) => acc + p.close, 0);
  return parseFloat((sum / period).toFixed(2));
}

function calculateEMA(period: number): number | null {
  if (priceHistory.length < period) return null;
  const k = 2 / (period + 1);
  let ema = priceHistory[priceHistory.length - period].close;
  for (let i = priceHistory.length - period + 1; i < priceHistory.length; i++) {
    ema = priceHistory[i].close * k + ema * (1 - k);
  }
  return parseFloat(ema.toFixed(2));
}

function calculateRSI(period: number = 14): number | null {
  if (priceHistory.length < period + 1) return null;

  const changes: number[] = [];
  for (let i = priceHistory.length - period; i < priceHistory.length; i++) {
    changes.push(priceHistory[i].close - priceHistory[i - 1].close);
  }

  const gains = changes.filter((c) => c > 0);
  const losses = changes.filter((c) => c < 0).map((c) => Math.abs(c));

  const avgGain = gains.length > 0 ? gains.reduce((a, b) => a + b, 0) / period : 0;
  const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / period : 0;

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return parseFloat((100 - 100 / (1 + rs)).toFixed(2));
}

function getRSIStatus(rsi: number): string {
  if (rsi >= 70) return 'Overbought';
  if (rsi >= 60) return 'Bullish';
  if (rsi >= 40) return 'Neutral';
  if (rsi >= 30) return 'Bearish';
  return 'Oversold';
}

export function calculateTechnicals(currentPrice: number): TechnicalData {
  addPricePoint(currentPrice);

  const sma50 = calculateSMA(50);
  const sma200 = calculateSMA(200);
  const rsi = calculateRSI();

  const pctVs50 =
    sma50 !== null
      ? (((currentPrice - sma50) / sma50) * 100).toFixed(1)
      : 'N/A';
  const pctVs200 =
    sma200 !== null
      ? (((currentPrice - sma200) / sma200) * 100).toFixed(1)
      : 'N/A';

  // MACD signal (simplified — 12/26 EMA crossover)
  let macdSignal = 'N/A';
  let macdDesc = 'Insufficient data (need 26+ price points)';
  if (priceHistory.length >= 26) {
    const shortEMA = calculateEMA(12);
    const longEMA = calculateEMA(26);
    if (shortEMA !== null && longEMA !== null) {
      const macdLine = parseFloat((shortEMA - longEMA).toFixed(4));
      if (shortEMA > longEMA) {
        macdSignal = 'BUY';
        macdDesc = `Bullish — MACD ${macdLine > 0 ? '+' : ''}${macdLine} (12 EMA ${shortEMA} > 26 EMA ${longEMA})`;
      } else {
        macdSignal = 'SELL';
        macdDesc = `Bearish — MACD ${macdLine} (12 EMA ${shortEMA} < 26 EMA ${longEMA})`;
      }
    }
  }

  // Breakout status
  let keyBreakout = 'Accumulating price history for breakout analysis...';
  if (sma50 !== null) {
    if (currentPrice > sma50 * 1.05) {
      keyBreakout = `$${currentPrice} is ${pctVs50}% above 50-day SMA ($${sma50}) — strong bullish momentum`;
    } else if (currentPrice > sma50) {
      keyBreakout = `$${currentPrice} is above 50-day SMA ($${sma50}) — watching for breakout confirmation`;
    } else {
      keyBreakout = `$${currentPrice} is below 50-day SMA ($${sma50}) — watching for support`;
    }
  }

  return {
    rsi14: rsi !== null ? rsi : 0,
    rsiStatus: rsi !== null ? getRSIStatus(rsi) : 'Insufficient data',
    macd: macdDesc,
    macdSignal,
    sma50: sma50 !== null ? sma50 : 0,
    sma200: sma200 !== null ? sma200 : 0,
    priceVs50SMA:
      sma50 !== null
        ? `${currentPrice > sma50 ? 'ABOVE' : 'BELOW'} (${pctVs50}%)`
        : 'N/A',
    priceVs200SMA:
      sma200 !== null
        ? `${currentPrice > sma200 ? 'ABOVE' : 'BELOW'} (${pctVs200}%)`
        : 'N/A',
    keyBreakout,
    supports: [
      { level: sma50 !== null ? `$${sma50}` : 'N/A', note: '50-day SMA' },
      { level: sma200 !== null ? `$${sma200}` : 'N/A', note: '200-day SMA' },
    ],
    resistances: [
      { level: 'Manual entry required', note: 'Add resistance levels in config' },
    ],
  };
}
