import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  fredApiKey: process.env.FRED_API_KEY || '',
  xBearerToken: process.env.X_BEARER_TOKEN || '',
  refreshIntervalMinutes: parseInt(process.env.REFRESH_INTERVAL_MINUTES || '30', 10),
  dataDir: process.env.DATA_DIR || './data',
};
