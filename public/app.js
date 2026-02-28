/**
 * Silver Command Center — Frontend Application
 * Fetches data from /api/data and dynamically populates all dashboard sections.
 */

'use strict';

// ── State ──────────────────────────────────────────────────────────────────
let dashboardData = null;
let pollInterval = null;
let isRefreshing = false;
let firstLoadDone = false;

// ── DOM References ──────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

// ── Entry Point ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  // Poll every 30 seconds
  pollInterval = setInterval(loadData, 30_000);
});

// ── Data Fetching ────────────────────────────────────────────────────────────
async function loadData() {
  try {
    setStatusDot('loading');

    const res = await fetch('/api/data');

    if (res.status === 503) {
      // Server still initializing — show friendly message
      if (!firstLoadDone) {
        showError('Server is still loading data. Retrying automatically...');
        setStatusDot('loading');
      }
      return;
    }

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    dashboardData = data;

    hideError();
    populateDashboard(data);
    setStatusDot('live');
    firstLoadDone = true;

  } catch (err) {
    console.error('[App] Failed to load dashboard data:', err);
    setStatusDot('error');
    if (!firstLoadDone) {
      showError(`Failed to connect to server: ${err.message}. Is the Node.js server running?`);
    }
  }
}

async function triggerRefresh() {
  if (isRefreshing) return;
  isRefreshing = true;

  const btn = $('refresh-btn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Refreshing...';
  }

  setStatusDot('loading');

  try {
    const res = await fetch('/api/refresh', { method: 'POST' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    // Wait 5 seconds for the refresh to complete, then reload
    setTimeout(async () => {
      await loadData();
      isRefreshing = false;
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.5 6A4.5 4.5 0 1 1 6 1.5c1.2 0 2.3.47 3.1 1.25L10.5 4"/><path d="M10.5 1.5v2.5H8"/></svg> Refresh`;
      }
    }, 5000);
  } catch (err) {
    console.error('[App] Refresh trigger failed:', err);
    isRefreshing = false;
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.5 6A4.5 4.5 0 1 1 6 1.5c1.2 0 2.3.47 3.1 1.25L10.5 4"/><path d="M10.5 1.5v2.5H8"/></svg> Refresh`;
    }
    setStatusDot('error');
  }
}

// ── Main Population ──────────────────────────────────────────────────────────
function populateDashboard(data) {
  // Show dashboard, hide loading/error
  const loadingEl = $('loading-state');
  const dashboardEl = $('dashboard-content');
  if (loadingEl) loadingEl.style.display = 'none';
  if (dashboardEl) dashboardEl.style.display = 'block';

  populateHeader(data);
  populatePrice(data.price, data.signal);
  populateSignal(data.signal);
  populateTechnicals(data.technicals);
  populateMacro(data.macro);
  populateCOT(data.positioning);
  populateFundamentals(data.fundamentals);
  populateNews(data.news);
  populateSentiment(data.sentiment);
}

// ── Header ───────────────────────────────────────────────────────────────────
function populateHeader(data) {
  if (!data.lastUpdated) return;
  const el = $('last-updated-text');
  if (!el) return;

  const updated = new Date(data.lastUpdated);
  const now = new Date();
  const diffMs = now - updated;
  const diffMins = Math.floor(diffMs / 60000);

  let timeStr;
  if (diffMins < 1) {
    timeStr = 'Just updated';
  } else if (diffMins === 1) {
    timeStr = '1 min ago';
  } else if (diffMins < 60) {
    timeStr = `${diffMins} min ago`;
  } else {
    timeStr = updated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }

  el.textContent = `Updated ${timeStr}`;
}

// ── Price Hero ───────────────────────────────────────────────────────────────
function populatePrice(price, signal) {
  if (!price) return;

  // Spot price
  setText('price-spot', formatPrice(price.spot));

  // Day change
  const isUp = price.dayChange >= 0;
  const isFlat = price.dayChange === 0;
  const changeEl = $('price-change-val');
  const arrowEl = $('price-change-arrow');
  const pctEl = $('price-change-pct');

  if (changeEl) {
    changeEl.textContent = `${isUp ? '+' : ''}${price.dayChange.toFixed(2)}`;
    changeEl.className = isFlat ? 'text-muted' : (isUp ? 'text-green' : 'text-red');
  }
  if (arrowEl) {
    arrowEl.textContent = isFlat ? '→' : (isUp ? '▲' : '▼');
    arrowEl.className = isFlat ? 'text-muted' : (isUp ? 'text-green' : 'text-red');
  }
  if (pctEl) {
    pctEl.textContent = `(${isUp ? '+' : ''}${price.dayChangePct.toFixed(2)}%)`;
    pctEl.className = isFlat ? 'text-muted' : (isUp ? 'text-green' : 'text-red');
  }

  // Stats
  setText('gsr', price.goldSilverRatio > 0 ? price.goldSilverRatio.toFixed(1) + ':1' : '—');
  setText('gold-price', price.goldPrice > 0 ? formatPrice(price.goldPrice) : '—');
  setText('ath', price.allTimeHigh > 0 ? formatPrice(price.allTimeHigh) + (price.allTimeHighDate ? ` · ${price.allTimeHighDate}` : '') : '—');

  // Hero signal badge
  if (signal) {
    updateSignalBadge('signal-badge-hero', signal.action);
  }
}

// ── Signal ───────────────────────────────────────────────────────────────────
function populateSignal(signal) {
  if (!signal) return;

  updateSignalBadge('signal-badge-main', signal.action);
  setText('signal-confidence', `${signal.confidence}%`);
  setText('signal-reason', signal.reason || 'No signal reason available.');

  // Confidence bar
  const fill = $('confidence-fill');
  if (fill) {
    fill.style.width = `${signal.confidence}%`;
    fill.className = `confidence-bar__fill confidence-bar__fill--${signal.action.toLowerCase()}`;
  }
}

function updateSignalBadge(id, action) {
  const el = $(id);
  if (!el) return;
  const lower = (action || 'hold').toLowerCase();
  el.textContent = action || 'HOLD';
  el.className = `signal-badge signal-badge--${lower}`;
}

// ── Technicals ───────────────────────────────────────────────────────────────
function populateTechnicals(tech) {
  if (!tech) return;

  // RSI
  const rsi = tech.rsi14;
  const rsiEl = $('tech-rsi');
  if (rsiEl) rsiEl.textContent = rsi > 0 ? rsi.toFixed(1) : 'N/A';

  const rsiStatusEl = $('tech-rsi-status');
  if (rsiStatusEl && tech.rsiStatus) {
    rsiStatusEl.textContent = tech.rsiStatus;
    const rsiClass = rsi >= 70 ? 'tag--red' : rsi >= 60 ? 'tag--green' : rsi < 30 ? 'tag--red' : rsi < 40 ? 'tag--yellow' : 'tag--muted';
    rsiStatusEl.className = `tag ${rsiClass}`;
  }

  // MACD
  const macdEl = $('tech-macd');
  if (macdEl) {
    macdEl.textContent = tech.macd || '—';
    if (tech.macdSignal === 'BUY') macdEl.className = 'data-row__value text-green';
    else if (tech.macdSignal === 'SELL') macdEl.className = 'data-row__value text-red';
    else macdEl.className = 'data-row__value text-muted';
  }

  // SMA values
  setText('tech-sma50', tech.sma50 > 0 ? tech.sma50.toFixed(2) : '—');
  setText('tech-sma200', tech.sma200 > 0 ? tech.sma200.toFixed(2) : '—');

  // vs SMA
  const vs50El = $('tech-vs-50');
  if (vs50El) {
    vs50El.textContent = tech.priceVs50SMA || '—';
    vs50El.className = 'data-row__value ' + (
      tech.priceVs50SMA.startsWith('ABOVE') ? 'text-green' :
      tech.priceVs50SMA.startsWith('BELOW') ? 'text-red' : 'text-muted'
    );
  }

  const vs200El = $('tech-vs-200');
  if (vs200El) {
    vs200El.textContent = tech.priceVs200SMA || '—';
    vs200El.className = 'data-row__value ' + (
      tech.priceVs200SMA.startsWith('ABOVE') ? 'text-green' :
      tech.priceVs200SMA.startsWith('BELOW') ? 'text-red' : 'text-muted'
    );
  }

  // Breakout
  setText('tech-breakout', tech.keyBreakout || '—');

  // Support levels
  const supportsEl = $('tech-supports');
  if (supportsEl && tech.supports) {
    supportsEl.innerHTML = tech.supports.map(s =>
      `<span class="tag tag--silver" title="${escHtml(s.note)}">${escHtml(s.level)}</span>`
    ).join('');
  }
}

// ── Macro ─────────────────────────────────────────────────────────────────────
function populateMacro(macro) {
  if (!macro) return;

  // DXY
  const dxyEl = $('macro-dxy');
  if (dxyEl) {
    dxyEl.textContent = macro.dxy > 0 ? macro.dxy.toFixed(2) : 'N/A';
    dxyEl.className = 'card__value ' + (macro.dxy > 104 ? 'text-red' : macro.dxy < 100 ? 'text-green' : 'text-secondary');
  }
  setText('macro-dxy-change', macro.dxyChange && macro.dxyChange !== 'N/A' ? `Change: ${macro.dxyChange}` : 'From FRED: DTWEXBGS');

  // Real rate
  const rrEl = $('macro-real-rate');
  if (rrEl) {
    rrEl.textContent = macro.realRate10Y !== 0 ? `${macro.realRate10Y.toFixed(2)}%` : 'N/A';
    rrEl.className = 'card__value ' + (macro.realRate10Y > 2.5 ? 'text-red' : macro.realRate10Y < 1.5 ? 'text-green' : 'text-secondary');
  }
  setText('macro-real-rate-change', macro.realRateChange && macro.realRateChange !== 'N/A' ? `Change: ${macro.realRateChange}` : 'From FRED: DFII10');

  // Fed rate cut
  setText('macro-fed', macro.fedRateCut || 'N/A');
  setText('macro-pce', macro.pceInflation || 'N/A');
  setText('macro-geo', macro.geopolitical || '—');

  // Detail fields
  setText('macro-geo-detail', macro.geopolitical || 'No data');
  setText('macro-fed-detail', macro.fedRateCut || 'No data');

  // Calendar events
  const calEl = $('calendar-events');
  if (calEl) {
    if (macro.calendarEvents && macro.calendarEvents.length > 0) {
      calEl.innerHTML = macro.calendarEvents.map(ev =>
        `<li class="calendar-item">
          <span class="calendar-item__date">${escHtml(ev.date)}</span>
          <span class="calendar-item__event">${escHtml(ev.event)}</span>
        </li>`
      ).join('');
    } else {
      calEl.innerHTML = `<li class="calendar-item">
        <span class="calendar-item__date text-muted">—</span>
        <span class="calendar-item__event text-muted">No upcoming events. Add to macro.calendarEvents in data.</span>
      </li>`;
    }
  }
}

// ── COT ───────────────────────────────────────────────────────────────────────
function populateCOT(cot) {
  if (!cot) return;

  setText('cot-date', cot.reportDate || 'Unknown');
  setText('cot-oi', cot.openInterest > 0 ? cot.openInterest.toLocaleString() : '—');

  // Bars — normalize to max of all 4 values
  const maxVal = Math.max(cot.specLong, cot.specShort, cot.commercialLong, cot.commercialShort, 1);

  updateCOTBar('cot-spec-long-bar', 'cot-spec-long', cot.specLong, maxVal, 'green');
  updateCOTBar('cot-spec-short-bar', 'cot-spec-short', cot.specShort, maxVal, 'red');
  updateCOTBar('cot-comm-long-bar', 'cot-comm-long', cot.commercialLong, maxVal, 'green');
  updateCOTBar('cot-comm-short-bar', 'cot-comm-short', cot.commercialShort, maxVal, 'red');

  // Net positions
  const specNetEl = $('cot-spec-net');
  if (specNetEl) {
    const net = cot.specNetLong;
    specNetEl.textContent = net !== undefined ? formatWithSign(net) : '—';
    specNetEl.className = 'data-row__value ' + (net > 0 ? 'text-green' : net < 0 ? 'text-red' : 'text-muted');
  }

  const commNetEl = $('cot-comm-net');
  if (commNetEl) {
    const net = cot.commercialNetShort;
    commNetEl.textContent = net !== undefined ? formatWithSign(net) : '—';
    commNetEl.className = 'data-row__value text-muted';
  }

  setText('cot-comex-reg', cot.comexRegistered || 'N/A');
}

function updateCOTBar(barId, countId, value, maxVal, color) {
  const barEl = $(barId);
  const countEl = $(countId);
  if (barEl) {
    const pct = maxVal > 0 ? Math.round((value / maxVal) * 100) : 0;
    barEl.style.width = `${pct}%`;
    barEl.className = `cot-bar__fill cot-bar__fill--${color}`;
  }
  if (countEl) {
    countEl.textContent = value > 0 ? value.toLocaleString() : '—';
  }
}

// ── Fundamentals ──────────────────────────────────────────────────────────────
function populateFundamentals(fund) {
  if (!fund) return;

  setText('fund-status', fund.marketStatus || '—');
  setText('fund-deficit', fund.deficit || '—');
  setText('fund-cumulative', fund.cumulativeDeficit || '—');
  setText('fund-supply', fund.totalSupply || '—');
  setText('fund-mine', fund.mineProduction || '—');
  setText('fund-industrial', fund.industrialDemand || '—');
  setText('fund-physical', fund.physicalInvestment || '—');

  const factorsEl = $('fund-factors');
  if (factorsEl && fund.criticalFactors && fund.criticalFactors.length > 0) {
    factorsEl.innerHTML = fund.criticalFactors
      .map(f => `<li>${escHtml(f)}</li>`)
      .join('');
  }
}

// ── News ──────────────────────────────────────────────────────────────────────
function populateNews(news) {
  const listEl = $('news-list');
  const countEl = $('news-count');

  if (!news || news.length === 0) {
    if (listEl) listEl.innerHTML = '<li style="padding:var(--sp-4); text-align:center; color:var(--text-muted); font-size:var(--text-xs);">No news items available. Check news fetcher logs.</li>';
    if (countEl) countEl.textContent = '0 items';
    return;
  }

  if (countEl) countEl.textContent = `${news.length} items`;

  if (listEl) {
    listEl.innerHTML = news.map(item => {
      const headline = item.url
        ? `<a href="${escHtml(item.url)}" target="_blank" rel="noopener noreferrer" class="news-item__headline">${escHtml(item.headline)}</a>`
        : `<span class="news-item__headline">${escHtml(item.headline)}</span>`;

      return `<li class="news-item">
        <span class="news-item__time">${escHtml(item.time || '—')}</span>
        <div class="news-item__content">
          ${headline}
          <div class="news-item__source">${escHtml(item.source || '—')}</div>
        </div>
      </li>`;
    }).join('');
  }
}

// ── Sentiment ─────────────────────────────────────────────────────────────────
function populateSentiment(sentiment) {
  if (!sentiment) return;

  const pctEl = $('sentiment-pct');
  if (pctEl) {
    if (sentiment.overallBullish > 0) {
      pctEl.textContent = `${sentiment.overallBullish}%`;
      pctEl.className = sentiment.overallBullish >= 60 ? 'text-green' :
                        sentiment.overallBullish <= 40 ? 'text-red' : 'text-yellow';
      pctEl.style.fontSize = 'var(--text-xl)';
      pctEl.style.fontWeight = '700';
    } else {
      pctEl.textContent = 'N/A';
      pctEl.className = 'text-muted';
    }
  }

  const overallEl = $('sentiment-overall');
  if (overallEl) {
    overallEl.textContent = sentiment.overallBullish > 0
      ? `${sentiment.overallBullish}% Bullish`
      : 'API Not Configured';
    overallEl.className = 'tag ' + (
      sentiment.overallBullish >= 60 ? 'tag--green' :
      sentiment.overallBullish <= 40 ? 'tag--red' : 'tag--yellow'
    );
    if (sentiment.overallBullish === 0) overallEl.className = 'tag tag--muted';
  }

  setText('sentiment-summary', sentiment.summary || '—');

  const accountsEl = $('sentiment-accounts');
  if (accountsEl && sentiment.accounts) {
    accountsEl.innerHTML = sentiment.accounts.map(acc => {
      const stanceClass = getStanceClass(acc.stance);
      return `<div class="account-row">
        <span class="account-row__handle">${escHtml(acc.handle)}</span>
        <div class="account-row__content">
          <div class="account-row__stance ${stanceClass}">${escHtml(acc.stance)}</div>
          <div class="account-row__note">${escHtml(acc.note)}</div>
        </div>
      </div>`;
    }).join('');
  }
}

function getStanceClass(stance) {
  if (!stance) return 'text-muted';
  const s = stance.toLowerCase();
  if (s.includes('very bull')) return 'text-green';
  if (s.includes('bull')) return 'text-green';
  if (s.includes('very bear')) return 'text-red';
  if (s.includes('bear')) return 'text-red';
  if (s.includes('unknown') || s.includes('error') || s.includes('require')) return 'text-muted';
  return 'text-yellow'; // neutral
}

// ── Grok Integration ──────────────────────────────────────────────────────────
function openGrok() {
  if (!dashboardData) {
    alert('No data loaded yet. Please wait for the first data refresh.');
    return;
  }

  const d = dashboardData;
  const price = d.price;
  const signal = d.signal;
  const tech = d.technicals;
  const macro = d.macro;
  const cot = d.positioning;
  const fund = d.fundamentals;

  const prompt = `Analyze the current silver market data and give me a concise investment thesis.

== SILVER MARKET DATA (${new Date(d.lastUpdated || Date.now()).toLocaleDateString()}) ==

PRICE:
- Spot: ${price ? '$' + price.spot : 'N/A'} (${price ? (price.dayChange >= 0 ? '+' : '') + price.dayChange + ' today, ' + (price.dayChangePct >= 0 ? '+' : '') + price.dayChangePct + '%' : 'N/A'})
- Gold/Silver Ratio: ${price ? price.goldSilverRatio : 'N/A'}
- Gold Price: ${price ? '$' + price.goldPrice : 'N/A'}

SIGNAL:
- Action: ${signal ? signal.action : 'N/A'} (Confidence: ${signal ? signal.confidence + '%' : 'N/A'})
- Reason: ${signal ? signal.reason : 'N/A'}

TECHNICALS:
- RSI(14): ${tech ? tech.rsi14 + ' (' + tech.rsiStatus + ')' : 'N/A'}
- MACD: ${tech ? tech.macd : 'N/A'}
- vs 50-day SMA: ${tech ? tech.priceVs50SMA : 'N/A'} (${tech ? '$' + tech.sma50 : 'N/A'})
- vs 200-day SMA: ${tech ? tech.priceVs200SMA : 'N/A'} (${tech ? '$' + tech.sma200 : 'N/A'})

MACRO:
- DXY: ${macro ? macro.dxy : 'N/A'}
- Real Rate (10Y TIPS): ${macro ? macro.realRate10Y + '%' : 'N/A'}
- Fed Policy: ${macro ? macro.fedRateCut : 'N/A'}

COT POSITIONING:
- Spec Net Long: ${cot ? cot.specNetLong.toLocaleString() : 'N/A'}
- Commercial Net Short: ${cot ? cot.commercialNetShort.toLocaleString() : 'N/A'}
- Open Interest: ${cot ? cot.openInterest.toLocaleString() : 'N/A'}
- Report Date: ${cot ? cot.reportDate : 'N/A'}

FUNDAMENTALS:
- Market Status: ${fund ? fund.marketStatus : 'N/A'}
- 2026 Deficit: ${fund ? fund.deficit : 'N/A'}
- Cumulative Deficit Since 2021: ${fund ? fund.cumulativeDeficit : 'N/A'}
- Total Supply: ${fund ? fund.totalSupply : 'N/A'}
- Industrial Demand: ${fund ? fund.industrialDemand : 'N/A'}

Please provide:
1. A one-sentence overall assessment
2. Top 3 bullish factors right now
3. Top 3 risks / bearish factors
4. Your target price range for the next 6-12 months with reasoning
5. Recommended positioning (aggressive/moderate/conservative) and why`;

  // Open Grok with the prompt
  const grokUrl = `https://x.com/i/grok?text=${encodeURIComponent(prompt)}`;
  window.open(grokUrl, '_blank', 'noopener,noreferrer');
}

// ── UI Helpers ────────────────────────────────────────────────────────────────
function setStatusDot(state) {
  const dot = $('status-dot');
  if (dot) dot.className = `header__status-dot ${state}`;
}

function showError(msg) {
  const el = $('error-state');
  const msgEl = $('error-message');
  const loadingEl = $('loading-state');

  if (el) el.style.display = 'flex';
  if (msgEl) msgEl.textContent = msg;
  if (loadingEl && !firstLoadDone) loadingEl.style.display = 'none';
}

function hideError() {
  const el = $('error-state');
  if (el) el.style.display = 'none';
}

function setText(id, val) {
  const el = $(id);
  if (el) el.textContent = val != null ? String(val) : '—';
}

function escHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatPrice(num) {
  if (num == null || isNaN(num)) return '—';
  return '$' + Number(num).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatWithSign(num) {
  if (num == null || isNaN(num)) return '—';
  const n = parseInt(num, 10);
  return (n >= 0 ? '+' : '') + n.toLocaleString('en-US');
}
