# Silver Command Center

A self-hosted, real-time silver market intelligence dashboard. Pulls live price data, CFTC COT positioning, FRED macro data, and precious metals news — all in one dark-themed dashboard with a composite buy/sell/hold signal. **v1.1** adds real-time WebSocket push so every connected browser updates instantly.

## Features

- **Live silver spot price** — multi-source with automatic fallback (GoldAPI → metals.dev → gold-api.com → MetalPriceAPI)
- **Real-time WebSocket push** — server fetches from APIs on a configurable interval, then broadcasts to all connected browsers instantly via socket.io
- **Composite trading signal** — BUY / HOLD / SELL with a confidence score (0–100) derived from technicals, positioning, and macro
- **Technical analysis** — RSI(14), MACD, 50/200-day SMA calculated from live price history
- **CFTC COT positioning** — speculator and commercial positions from the official CFTC Socrata API (no key needed)
- **FRED macro data** — DXY dollar index and 10-Year real rates from the St. Louis Fed (free API key required)
- **News feed** — aggregated RSS from Kitco, Google News, and SilverSeek
- **X/Twitter sentiment** — stub by default; activates with a bearer token in `.env`
- **Grok integration** — one-click prompt generation that packages all current data and opens Grok AI for analysis
- **Persistent storage** — data survives server restarts via JSON file in `/data`
- **REST fallback** — if WebSocket fails on initial page load, the client falls back to REST `/api/data`

---

## Quick Start

### 1. Prerequisites

- Node.js 18+ ([download](https://nodejs.org/))
- npm 9+

### 2. Install

```bash
cd silver-command-center
npm install
```

### 3. Configure

```bash
cp .env.example .env
```

Edit `.env` — at minimum, no changes are required to run the app. To enable FRED macro data, add your free FRED API key (see [Configuration](#configuration)).

### 4. Run (development)

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

On first startup, the server immediately fetches data from all sources and pushes the result to your browser via WebSocket. Price data appears within ~10 seconds. The green dot in the header pulses when a new update arrives.

### 5. Build & run (production)

```bash
npm run build
npm start
```

---

## Configuration

All configuration is in `.env`. See `.env.example` for defaults.

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP server port |
| `FRED_API_KEY` | _(empty)_ | FRED API key — required for DXY and real rate data |
| `X_BEARER_TOKEN` | _(empty)_ | X/Twitter API bearer token — optional, activates live sentiment |
| `REFRESH_INTERVAL_SECONDS` | `300` | How often to fetch from external APIs (in seconds). Data is then pushed to all clients via WebSocket. |
| `DATA_DIR` | `./data` | Where to persist dashboard data between restarts |

### Getting a FRED API key (free, 2 minutes)

1. Register at [https://fred.stlouisfed.org/docs/api/api_key.html](https://fred.stlouisfed.org/docs/api/api_key.html)
2. Check your email for the key
3. Add `FRED_API_KEY=your_key_here` to `.env`

FRED provides:
- `DTWEXBGS` — Trade Weighted US Dollar Index (DXY proxy)
- `DFII10` — 10-Year Treasury Inflation-Indexed Security (real rate)

### Getting an X API bearer token (optional)

1. Register as a developer at [https://developer.twitter.com/](https://developer.twitter.com/)
2. Create a project/app and generate a bearer token
3. Add `X_BEARER_TOKEN=your_token_here` to `.env`

Without this, the sentiment section shows placeholders for the 10 monitored silver accounts.

---

## Data Sources

| Source | What | Auth needed |
|---|---|---|
| [GoldAPI.io](https://goldapi.io) | Silver/gold spot price | None (demo tier) |
| [metals.dev](https://metals.dev) | Silver/gold spot (fallback) | None (demo tier) |
| [gold-api.com](https://api.gold-api.com) | Silver/gold spot (fallback) | None |
| [MetalPriceAPI](https://metalpriceapi.com) | Silver/gold spot (fallback) | None (demo tier) |
| [CFTC Socrata API](https://publicreporting.cftc.gov) | COT futures positioning | **None** — fully open |
| [FRED API](https://fred.stlouisfed.org) | DXY, real rates | Free API key |
| [Kitco RSS](https://kitco.com) | Precious metals news | None |
| [Google News RSS](https://news.google.com) | Silver news | None |
| [SilverSeek RSS](https://silverseek.com) | Silver news | None |
| [X API v2](https://developer.twitter.com) | Sentiment from 10 accounts | Free bearer token |

> **Note on price APIs:** The demo keys for metals.dev and MetalPriceAPI are rate-limited. If you use this at high frequency, register for a free tier API key at those services and add them to the price fetcher.

---

## Architecture

```
silver-command-center/
├── src/
│   ├── index.ts          # Express + HTTP server + socket.io setup
│   ├── config.ts         # Environment variable loader
│   ├── types.ts          # All TypeScript interfaces (DashboardData, etc.)
│   ├── store.ts          # In-memory store + JSON file persistence
│   ├── routes.ts         # API routes (/api/data, /api/refresh, /api/health)
│   ├── scheduler.ts      # setInterval scheduler + signal generation + WS broadcast
│   └── fetchers/
│       ├── price.ts      # Multi-source price fetcher with fallback chain
│       ├── cot.ts        # CFTC COT data via Socrata public API
│       ├── fred.ts       # FRED macro series (DXY, real rates)
│       ├── news.ts       # RSS aggregator (Kitco, Google News, SilverSeek)
│       ├── technicals.ts # RSI, MACD, SMA calculations from price history
│       └── sentiment.ts  # X API sentiment stub / live implementation
├── public/               # Static frontend (served by Express)
│   ├── index.html        # Dashboard HTML structure + socket.io CDN
│   ├── base.css          # CSS reset + design tokens
│   ├── style.css         # Component styles + flash animation
│   └── app.js            # WebSocket client + DOM population (REST fallback)
└── data/
    └── dashboard.json    # Persisted data (gitignored)
```

### Data flow (v1.1 — WebSocket)

1. Server starts → `startScheduler()` runs immediately
2. All fetchers run in parallel (`Promise.allSettled`)
3. Results merged into `DashboardData` — failed fetchers don't break others
4. Signal generated from available data
5. Data written to memory + `data/dashboard.json`
6. **`io.emit('dashboard:update', data)` pushes to all connected browsers instantly**
7. Frontend receives data on the `dashboard:update` event and updates the DOM
8. The green status dot briefly flashes on each update
9. If WebSocket is down on initial load, the client falls back to `GET /api/data`

### WebSocket events

| Direction | Event | Payload | Description |
|---|---|---|---|
| Server → Client | `dashboard:update` | Full `DashboardData` JSON | Pushed after every API refresh cycle |
| Client → Server | `dashboard:refresh` | _(none)_ | Triggers an immediate refresh from all data sources |

On first connect, the server immediately sends the current data so the client doesn't wait for the next refresh cycle.

---

## How the Signal Works

The composite signal (BUY / HOLD / SELL) uses a simple scoring model:

| Factor | Condition | Score impact |
|---|---|---|
| RSI | 50–70 (bullish zone) | +10 |
| RSI | ≥70 (overbought) | −5 |
| RSI | <30 (oversold) | +5 |
| MACD | Bullish crossover | +10 |
| MACD | Bearish crossover | −10 |
| Price vs 50-day SMA | Above | +8 |
| Price vs 50-day SMA | Below | −8 |
| Price vs 200-day SMA | Above | +8 |
| Price vs 200-day SMA | Below | −8 |
| Daily change | >1% | +5 |
| Daily change | <−1% | −5 |
| Spec net long | >50k contracts | +7 |
| Spec net long | >0 | +3 |
| Spec net long | <−20k | −7 |
| Real rate | <1.5% | +8 |
| Real rate | 1.5–2.5% | +4 |
| Real rate | >3% | −8 |
| DXY | <100 | +5 |
| DXY | >108 | −5 |

Score starts at 50 (neutral). Final score:
- **≥65** → BUY
- **≤35** → SELL
- **35–65** → HOLD

> **Important:** This is a systematic indicator, not financial advice. The signal is only as good as the data available. Technicals improve significantly after 200+ price data points have accumulated (takes ~200 days of running).

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/data` | Full dashboard data as JSON |
| POST | `/api/refresh` | Trigger immediate data refresh |
| GET | `/api/health` | Health check — includes last update time and current signal |

Example health response:
```json
{
  "status": "ok",
  "hasData": true,
  "lastUpdated": "2026-03-01T00:00:00.000Z",
  "silverPrice": 32.45,
  "signal": "HOLD"
}
```

---

## Adding Custom Data Sources

### Adding a new price source

In `src/fetchers/price.ts`, add a new async function following the `fetchFromGoldApi` pattern:

```typescript
async function fetchFromMySource(): Promise<{ silver: number; gold: number } | null> {
  try {
    const res = await axios.get('https://my-api.com/metals', { timeout: 10000 });
    return { silver: res.data.silver, gold: res.data.gold };
  } catch { return null; }
}
```

Then add it to the fallback chain in `fetchPriceData()`.

### Adding calendar events

In `src/scheduler.ts`, find the `macro.calendarEvents` array and add your events:

```typescript
calendarEvents: [
  { date: 'Mar 19', event: 'FOMC Meeting' },
  { date: 'Mar 28', event: 'PCE Inflation Report' },
]
```

Or POST to `/api/refresh` after editing the persisted `data/dashboard.json` directly.

### Adding custom fundamentals

Edit the `fundamentals` object in `src/scheduler.ts` → `refreshAll()`. These values are mostly static and reflect annual supply/demand data from the Silver Institute.

---

## Deployment

### Local (recommended for personal use)

```bash
npm run build && npm start
```

Add to your system startup (e.g., systemd, PM2, launchd).

### PM2 (Linux/macOS persistent process)

```bash
npm install -g pm2
npm run build
pm2 start dist/index.js --name "silver-command-center"
pm2 save
pm2 startup
```

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist/ ./dist/
COPY public/ ./public/
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

Build and run:
```bash
npm run build
docker build -t silver-command-center .
docker run -p 3000:3000 -v $(pwd)/data:/app/data --env-file .env silver-command-center
```

---

## Changelog

### v1.1 — WebSocket Push (2026-03-01)

- **Real-time WebSocket** — replaced REST polling with socket.io. Server pushes data to all connected clients on every refresh cycle.
- **Instant first load** — server sends current data immediately when a client connects.
- **Manual refresh via WebSocket** — the "Refresh" button now sends a WebSocket event instead of a POST request.
- **Flash animation** — green status dot pulses briefly on each incoming data update.
- **Configurable refresh in seconds** — `REFRESH_INTERVAL_SECONDS` (default 300) replaces the old `REFRESH_INTERVAL_MINUTES`.
- **REST fallback** — if WebSocket fails on initial load, the client falls back to `GET /api/data`.

### v1.0 — Initial Release (2026-02-28)

- Multi-source silver price fetching with fallback chain
- CFTC COT positioning data (no API key needed)
- FRED macro data (DXY, real rates)
- RSS news aggregation (Kitco, Google News, SilverSeek)
- Composite BUY/HOLD/SELL signal engine
- One-click Grok AI analysis integration
- Persistent JSON storage
- Dark-themed responsive dashboard

---

## Troubleshooting

**"Data not yet loaded" on first visit**
The server runs all fetchers on startup. Wait ~10 seconds, then the WebSocket should push data to your browser automatically. Check terminal logs for `[Price]`, `[COT]`, `[FRED]` entries.

**Price shows "N/A" or "—"**
All four price sources failed. Check your internet connection. The demo API keys have rate limits — if you've hit them, wait a few minutes or register for a free API key at [goldapi.io](https://goldapi.io).

**FRED data shows "N/A"**
No `FRED_API_KEY` set in `.env`. Get a free key at [fred.stlouisfed.org](https://fred.stlouisfed.org/docs/api/api_key.html).

**COT data not loading**
The CFTC publishes new data every Friday after market close. If it's early in the week, the API may have last week's data. The Socrata endpoint occasionally has rate limits; the app retries automatically.

**Technicals show "N/A" or "Insufficient data"**
Technicals require price history:
- RSI(14): 15 price points (15 refresh cycles)
- MACD: 26 price points (26 refresh cycles)
- 50-day SMA: 50 price points
- 200-day SMA: 200 price points

At the default 5-minute interval (300s), full technical data takes several days to accumulate. Consider lowering `REFRESH_INTERVAL_SECONDS` (e.g., to `60`) during initial setup.

**X/Twitter sentiment shows "API not configured"**
Expected behavior — configure `X_BEARER_TOKEN` in `.env` to enable live sentiment.

**WebSocket not connecting**
Check that no firewall or proxy is blocking WebSocket connections on the server port. The client automatically retries with exponential backoff. If WebSocket is permanently blocked, the dashboard falls back to REST on initial load.

---

## License

MIT — personal use, modification, and self-hosting encouraged.
