import axios from 'axios';
import { MacroData } from '../types';
import { config } from '../config';

const FRED_BASE = 'https://api.stlouisfed.org/fred/series/observations';

async function getFredSeries(seriesId: string): Promise<number | null> {
  if (!config.fredApiKey) {
    console.log(`[FRED] No API key configured — skipping ${seriesId}`);
    return null;
  }
  try {
    const res = await axios.get(FRED_BASE, {
      params: {
        series_id: seriesId,
        api_key: config.fredApiKey,
        file_type: 'json',
        sort_order: 'desc',
        limit: 10,
      },
      timeout: 10000,
    });
    const observations = res.data?.observations as Array<{ value: string }> | undefined;
    if (observations && observations.length > 0) {
      // Find first non-missing value
      for (const obs of observations) {
        if (obs.value && obs.value !== '.') {
          return parseFloat(obs.value);
        }
      }
    }
    return null;
  } catch (e) {
    console.error(`[FRED] Error fetching ${seriesId}:`, e);
    return null;
  }
}

export async function fetchMacroData(previousMacro?: MacroData): Promise<MacroData | null> {
  try {
    const [dxy, realRate] = await Promise.all([
      getFredSeries('DTWEXBGS'),   // Trade Weighted US Dollar Index: Broad, Goods
      getFredSeries('DFII10'),      // 10-Year TIPS Real Rate
    ]);

    const prev = previousMacro;

    return {
      dxy: dxy !== null ? parseFloat(dxy.toFixed(2)) : (prev?.dxy || 0),
      dxyChange: prev?.dxyChange || 'N/A',
      realRate10Y: realRate !== null ? parseFloat(realRate.toFixed(2)) : (prev?.realRate10Y || 0),
      realRateChange: prev?.realRateChange || 'N/A',
      fedRateCut: prev?.fedRateCut || 'Check CME FedWatch',
      pceInflation: prev?.pceInflation || 'N/A',
      geopolitical: prev?.geopolitical || 'Monitor news feeds',
      calendarEvents: prev?.calendarEvents || [],
    };
  } catch (e) {
    console.error('[FRED] Error fetching macro data:', e);
    return null;
  }
}
