import express from 'express';
import http from 'http';
import path from 'path';
import { Server as SocketIOServer } from 'socket.io';
import { config } from './config';
import routes from './routes';
import { startScheduler } from './scheduler';
import { getData } from './store';

const app = express();
const server = http.createServer(app);

// ── Socket.IO ───────────────────────────────────────────────────────────────
export const io = new SocketIOServer(server, {
  cors: { origin: '*' },
  pingInterval: 10000,
  pingTimeout: 5000,
});

io.on('connection', (socket) => {
  console.log(`[WS] Client connected (${socket.id})`);

  // Send current data immediately on connect so the client doesn't wait
  const current = getData();
  if (current) {
    socket.emit('dashboard:update', current);
  }

  // Client can request a manual refresh via WebSocket too
  socket.on('dashboard:refresh', () => {
    console.log(`[WS] Manual refresh requested by ${socket.id}`);
    // Import dynamically to avoid circular dependency
    import('./scheduler').then(({ refreshAll }) => {
      refreshAll().catch((e) => console.error('[WS] Refresh error:', e));
    });
  });

  socket.on('disconnect', () => {
    console.log(`[WS] Client disconnected (${socket.id})`);
  });
});

// ── Express ─────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(routes);
app.use(express.static(path.join(__dirname, '../public')));
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ── Start ───────────────────────────────────────────────────────────────────
server.listen(config.port, () => {
  const secs = config.refreshIntervalSeconds;
  const freqLabel = secs >= 60 ? `${Math.round(secs / 60)} min` : `${secs}s`;
  const fredStatus = config.fredApiKey ? 'Configured ✓' : 'Not set (add to .env)';
  const xStatus = config.xBearerToken ? 'Configured ✓' : 'Not set (optional)  ';

  console.log('');
  console.log('  ╔══════════════════════════════════════════════════════╗');
  console.log('  ║           SILVER COMMAND CENTER  v1.1                ║');
  console.log('  ╠══════════════════════════════════════════════════════╣');
  console.log(`  ║  Dashboard:  http://localhost:${config.port}                ║`);
  console.log(`  ║  API:        http://localhost:${config.port}/api/data       ║`);
  console.log(`  ║  WebSocket:  ws://localhost:${config.port}                  ║`);
  console.log('  ╠══════════════════════════════════════════════════════╣');
  console.log(`  ║  Refresh:    Every ${freqLabel.padEnd(6)} (API → WS broadcast)   ║`);
  console.log(`  ║  FRED API:   ${fredStatus.padEnd(30)}      ║`);
  console.log(`  ║  X API:      ${xStatus.padEnd(30)}      ║`);
  console.log('  ╚══════════════════════════════════════════════════════╝');
  console.log('');

  startScheduler();
});
