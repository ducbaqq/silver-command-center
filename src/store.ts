import fs from 'fs';
import path from 'path';
import { DashboardData } from './types';
import { config } from './config';

const DATA_FILE = path.join(config.dataDir, 'dashboard.json');

let currentData: DashboardData | null = null;

export function getData(): DashboardData | null {
  if (currentData) return currentData;
  // Try loading from file on first access
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      currentData = JSON.parse(raw) as DashboardData;
      return currentData;
    }
  } catch (e) {
    console.error('Error loading persisted data:', e);
  }
  return null;
}

export function setData(data: DashboardData): void {
  currentData = data;
  // Persist to disk
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Error persisting data:', e);
  }
}

export function updatePartial(partial: Partial<DashboardData>): void {
  const existing = getData();
  const merged = { ...existing, ...partial, lastUpdated: new Date().toISOString() } as DashboardData;
  setData(merged);
}
