import axios from 'axios';
import { COTData } from '../types';

const CFTC_API = 'https://publicreporting.cftc.gov/resource/6dca-aqww.json';

export async function fetchCOTData(): Promise<COTData | null> {
  try {
    // Query for silver futures — COMEX silver contract code 084691
    const res = await axios.get(CFTC_API, {
      params: {
        $where: "contract_market_name like '%SILVER%' AND cftc_contract_market_code='084691'",
        $order: 'report_date_as_yyyy_mm_dd DESC',
        $limit: 5,
      },
      timeout: 15000,
    });

    if (!res.data || res.data.length === 0) {
      console.log('[COT] No data returned with exact code, trying broader query...');
      // Broader query fallback
      const fallback = await axios.get(CFTC_API, {
        params: {
          $where: "contract_market_name like '%SILVER%'",
          $order: 'report_date_as_yyyy_mm_dd DESC',
          $limit: 5,
        },
        timeout: 15000,
      });
      if (!fallback.data || fallback.data.length === 0) {
        console.error('[COT] No silver COT data found in any query');
        return null;
      }
      console.log(`[COT] Found ${fallback.data.length} records via broad query`);
      return parseCOTRecord(fallback.data[0]);
    }

    console.log(`[COT] Found ${res.data.length} records for silver`);
    return parseCOTRecord(res.data[0]);
  } catch (e) {
    console.error('[COT] Error fetching CFTC data:', e);
    return null;
  }
}

function parseCOTRecord(record: Record<string, string>): COTData {
  const specLong = parseInt(record.noncomm_positions_long_all || '0', 10);
  const specShort = parseInt(record.noncomm_positions_short_all || '0', 10);
  const commLong = parseInt(record.comm_positions_long_all || '0', 10);
  const commShort = parseInt(record.comm_positions_short_all || '0', 10);
  const oi = parseInt(record.open_interest_all || '0', 10);

  return {
    reportDate: record.report_date_as_yyyy_mm_dd || 'Unknown',
    specLong,
    specShort,
    specNetLong: specLong - specShort,
    commercialLong: commLong,
    commercialShort: commShort,
    commercialNetShort: commShort - commLong,
    openInterest: oi,
    // COMEX inventory is a separate paid data source
    comexRegistered: 'N/A — requires CME data subscription',
    comexCoverageRatio: 'N/A',
    comexPaperLeverage: 'N/A',
  };
}
