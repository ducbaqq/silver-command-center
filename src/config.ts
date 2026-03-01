import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  fredApiKey: process.env.FRED_API_KEY || '',
  xBearerToken: process.env.X_BEARER_TOKEN || '',
  /** How often to fetch from external APIs (in seconds). Default: 300 (5 min) */
  refreshIntervalSeconds: parseInt(process.env.REFRESH_INTERVAL_SECONDS || '300', 10),
  dataDir: process.env.DATA_DIR || './data',
};
