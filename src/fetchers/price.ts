import axios from 'axios';
import { PriceData } from '../types';

// Primary: gold-api.com free endpoint (no key needed for basic metals)
async function fetchFromGoldApi(): Promise<{ silver: number; gold: number } | null> {
  try {
    const [silverRes, goldRes] = await Promise.all([
      axios.get('https://www.goldapi.io/api/XAG/USD', {
        headers: { 'x-access-token': 'goldapi-demo' },
        timeout: 10000,
      }),
      axios.get('https://www.goldapi.io/api/XAU/USD', {
        headers: { 'x-access-token': 'goldapi-demo' },
        timeout: 10000,
      }),
    ]);
    const silverPrice = silverRes.data?.price;
    const goldPrice = goldRes.data?.price;
    if (!silverPrice || silverPrice <= 0) return null;
    return {
      silver: silverPrice,
      gold: goldPrice || 0,
    };
  } catch {
    return null;
  }
}

// Fallback: Use metals.dev free API
async function fetchFromMetalsDev(): Promise<{ silver: number; gold: number } | null> {
  try {
    const res = await axios.get('https://api.metals.dev/v1/latest?api_key=demo&currency=USD&unit=toz', {
      timeout: 10000,
    });
    const silver = res.data?.metals?.silver;
    const gold = res.data?.metals?.gold;
    if (!silver || silver <= 0) return null;
    return { silver, gold: gold || 0 };
  } catch {
    return null;
  }
}

// Fallback 2: MetalPriceAPI free demo
async function fetchFromMetalPriceApi(): Promise<{ silver: number; gold: number } | null> {
  try {
    const res = await axios.get(
      'https://api.metalpriceapi.com/v1/latest?api_key=demo&base=USD&currencies=XAG,XAU',
      { timeout: 10000 }
    );
    // These APIs return 1/price for metals, need to invert
    if (res.data?.rates) {
      const silverRate = res.data.rates.XAG;
      const goldRate = res.data.rates.XAU;
      if (!silverRate || silverRate <= 0) return null;
      return {
        silver: 1 / silverRate,
        gold: goldRate ? 1 / goldRate : 0,
      };
    }
    return null;
  } catch {
    return null;
  }
}

// Fallback 3: Try the free gold-api.com public endpoint (different from goldapi.io)
async function fetchFromPublicApi(): Promise<{ silver: number; gold: number } | null> {
  try {
    const res = await axios.get('https://api.gold-api.com/price/XAG', {
      timeout: 10000,
      headers: { Accept: 'application/json' },
    });
    const silver = res.data?.price || res.data?.Price;
    if (!silver || silver <= 0) return null;

    // Try to also get gold
    let gold = 0;
    try {
      const goldRes = await axios.get('https://api.gold-api.com/price/XAU', {
        timeout: 10000,
        headers: { Accept: 'application/json' },
      });
      gold = goldRes.data?.price || goldRes.data?.Price || 0;
    } catch {
      // gold is optional
    }

    return { silver, gold };
  } catch {
    return null;
  }
}

export async function fetchPriceData(previousPrice?: PriceData): Promise<PriceData | null> {
  // Try sources in order
  let prices = await fetchFromGoldApi();

  if (!prices || !prices.silver) {
    console.log('[Price] GoldAPI failed, trying metals.dev...');
    prices = await fetchFromMetalsDev();
  }
  if (!prices || !prices.silver) {
    console.log('[Price] metals.dev failed, trying gold-api.com...');
    prices = await fetchFromPublicApi();
  }
  if (!prices || !prices.silver) {
    console.log('[Price] gold-api.com failed, trying MetalPriceAPI...');
    prices = await fetchFromMetalPriceApi();
  }

  if (!prices || !prices.silver) {
    console.error('[Price] All price sources failed');
    return null;
  }

  const silver = prices.silver;
  const gold = prices.gold;
  const ratio = gold && silver ? parseFloat((gold / silver).toFixed(1)) : 0;

  // Calculate changes from previous data if available
  const prev = previousPrice;
  const dayChange = prev ? parseFloat((silver - prev.spot).toFixed(2)) : 0;
  const dayChangePct =
    prev && prev.spot ? parseFloat(((dayChange / prev.spot) * 100).toFixed(2)) : 0;

  // Track ATH
  const prevATH = prev?.allTimeHigh || 0;
  const newATH = Math.max(silver, prevATH);
  const athDate =
    silver >= prevATH
      ? new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      : prev?.allTimeHighDate || 'Unknown';

  return {
    spot: parseFloat(silver.toFixed(2)),
    dayChange,
    dayChangePct,
    weekChange: prev?.weekChange || 0,
    weekChangePct: prev?.weekChangePct || 0,
    goldPrice: parseFloat((gold || 0).toFixed(0)),
    goldSilverRatio: ratio,
    allTimeHigh: parseFloat(newATH.toFixed(2)),
    allTimeHighDate: athDate,
    timestamp: new Date().toISOString(),
  };
}
