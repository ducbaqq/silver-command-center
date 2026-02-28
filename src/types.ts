export interface PriceData {
  spot: number;
  dayChange: number;
  dayChangePct: number;
  weekChange: number;
  weekChangePct: number;
  goldPrice: number;
  goldSilverRatio: number;
  allTimeHigh: number;
  allTimeHighDate: string;
  timestamp: string;
}

export interface TechnicalData {
  rsi14: number;
  rsiStatus: string;
  macd: string;
  macdSignal: string;
  sma50: number;
  sma200: number;
  priceVs50SMA: string;
  priceVs200SMA: string;
  keyBreakout: string;
  supports: { level: string; note: string }[];
  resistances: { level: string; note: string }[];
}

export interface COTData {
  reportDate: string;
  specLong: number;
  specShort: number;
  specNetLong: number;
  commercialLong: number;
  commercialShort: number;
  commercialNetShort: number;
  openInterest: number;
  // COMEX inventory (from separate source)
  comexRegistered: string;
  comexCoverageRatio: string;
  comexPaperLeverage: string;
}

export interface MacroData {
  dxy: number;
  dxyChange: string;
  realRate10Y: number;
  realRateChange: string;
  fedRateCut: string;
  pceInflation: string;
  geopolitical: string;
  calendarEvents: { date: string; event: string }[];
}

export interface NewsItem {
  time: string;
  headline: string;
  source: string;
  url?: string;
}

export interface SentimentAccount {
  handle: string;
  stance: string;
  note: string;
}

export interface SentimentData {
  overallBullish: number;
  summary: string;
  topReasons: string[];
  accounts: SentimentAccount[];
}

export interface FundamentalsData {
  marketStatus: string;
  deficit: string;
  cumulativeDeficit: string;
  totalSupply: string;
  mineProduction: string;
  industrialDemand: string;
  physicalInvestment: string;
  criticalFactors: string[];
}

export interface SignalData {
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  reason: string;
}

export interface DashboardData {
  lastUpdated: string;
  price: PriceData;
  signal: SignalData;
  technicals: TechnicalData;
  positioning: COTData;
  fundamentals: FundamentalsData;
  macro: MacroData;
  news: NewsItem[];
  sentiment: SentimentData;
}
