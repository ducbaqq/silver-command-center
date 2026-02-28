import express from 'express';
import path from 'path';
import { config } from './config';
import routes from './routes';
import { startScheduler } from './scheduler';

const app = express();

// Middleware
app.use(express.json());

// API routes
app.use(routes);

// Serve static frontend from public/
app.use(express.static(path.join(__dirname, '../public')));

// Fallback to index.html for SPA-like behavior
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start server
app.listen(config.port, () => {
  const portPadded = String(config.port).padEnd(4, ' ');
  const freqPadded = String(config.refreshIntervalMinutes).padEnd(2, ' ');
  const fredStatus = config.fredApiKey ? 'Configured ✓' : 'Not set (add to .env)';
  const xStatus = config.xBearerToken ? 'Configured ✓' : 'Not set (optional)  ';

  console.log('');
  console.log('  ╔══════════════════════════════════════════════════════╗');
  console.log('  ║           SILVER COMMAND CENTER  v1.0                ║');
  console.log('  ╠══════════════════════════════════════════════════════╣');
  console.log(`  ║  Dashboard:  http://localhost:${portPadded}                ║`);
  console.log(`  ║  API Data:   http://localhost:${portPadded}/api/data       ║`);
  console.log(`  ║  Health:     http://localhost:${portPadded}/api/health     ║`);
  console.log('  ╠══════════════════════════════════════════════════════╣');
  console.log(`  ║  Refresh:    Every ${freqPadded} minutes                    ║`);
  console.log(`  ║  FRED API:   ${fredStatus}                    ║`);
  console.log(`  ║  X API:      ${xStatus}                    ║`);
  console.log('  ╚══════════════════════════════════════════════════════╝');
  console.log('');

  // Start the data refresh scheduler (runs immediately + on schedule)
  startScheduler();
});
