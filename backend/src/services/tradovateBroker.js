/**
 * tradovateBroker.js
 * Real Tradovate API integration. Drop-in replacement for mockBroker.js.
 * Interface is identical: placeOrder(orderSet, signal) returns
 * { filled, entryPrice, exitPrice, pnl, orderId }
 *
 * Entry/exit prices reflect the order as placed. exitPrice and pnl are
 * calculated from profit_target_ticks (the target, not a confirmed fill —
 * Tradovate manages the bracket legs asynchronously).
 */

const axios = require('axios');
const settingsService = require('./settingsService');

function _baseUrl(mode) {
  return mode === 'live'
    ? 'https://live.tradovateapi.com/v1'
    : 'https://demo.tradovateapi.com/v1';
}

// ── Tick tables (same as mockBroker) ─────────────────────────────────────────

const TICK_SIZE = {
  'MNQ1!': 0.25, 'NQ1!': 0.25,
  'MES1!': 0.25, 'ES1!': 0.25,
  'YM1!': 1,     'MYM1!': 1,
  'RTY1!': 0.1,  'M2K1!': 0.1,
};

const TICK_VALUE = {
  'MNQ1!': 0.50, 'NQ1!': 5.00,
  'MES1!': 1.25, 'ES1!': 12.50,
  'YM1!': 5.00,  'MYM1!': 0.50,
  'RTY1!': 5.00, 'M2K1!': 0.50,
};

function getTickSize(symbol) { return TICK_SIZE[symbol] || 0.25; }
function getTickValue(symbol) { return TICK_VALUE[symbol] || 0.50; }

function _roundToTick(price, tickSize) {
  return Math.round(price / tickSize) * tickSize;
}

// ── Token cache ───────────────────────────────────────────────────────────────

let tokenCache = { token: null, expires: 0, accountId: null };

async function getAccessToken() {
  // Return cached token if it has >60 s left
  if (tokenCache.token && tokenCache.expires > Date.now() + 60_000) {
    return tokenCache;
  }

  const s = await settingsService.getSettings();
  const baseUrl = _baseUrl(s.tradovate_mode);
  console.log('[tradovate] Authenticating…');
  const res = await axios.post(`${baseUrl}/auth/accesstokenrequest`, {
    name:       s.tradovate_username,
    password:   s.tradovate_password,
    appId:      s.tradovate_app_id || 'TradeFlow',
    appVersion: '1.0',
    cid:        parseInt(s.tradovate_cid, 10) || 0,
    sec:        s.tradovate_secret || '',
  });

  const { accessToken, expirationTime, accountId } = res.data;
  tokenCache = {
    token:     accessToken,
    expires:   new Date(expirationTime).getTime(),
    accountId: accountId,
    baseUrl,
  };

  console.log(`[tradovate] Authenticated. accountId=${accountId}`);
  return tokenCache;
}

function _clearTokenCache() {
  tokenCache = { token: null, expires: 0, accountId: null };
}

// ── Symbol resolution cache ───────────────────────────────────────────────────

const symbolCache = new Map(); // 'MNQ' → 'MNQM5'

async function resolveSymbol(tvSymbol, token, baseUrl) {
  // Strip TradingView suffix: 'MNQ1!' → 'MNQ'
  const base = tvSymbol.replace(/\d+!$/, '');

  if (symbolCache.has(base)) return symbolCache.get(base);

  const res = await axios.get(`${baseUrl}/contract/find`, {
    params:  { name: base },
    headers: { Authorization: `Bearer ${token}` },
  });

  const name = res.data.name;
  symbolCache.set(base, name);
  console.log(`[tradovate] Resolved ${tvSymbol} → ${name}`);
  return name;
}

// ── Order helpers ─────────────────────────────────────────────────────────────

function _calcLimitPrice(orderSet, signal, tickSize) {
  const { action } = signal;
  const basePrice = signal.price || 0;

  if (orderSet.entry_type === 'limit_signal') {
    return basePrice;
  }
  if (orderSet.entry_type === 'limit_offset') {
    const offset = (orderSet.limit_offset_ticks || 0) * tickSize;
    return action === 'buy' ? basePrice - offset : basePrice + offset;
  }
  return basePrice;
}

async function _placeWithRetry(fn) {
  try {
    return await fn();
  } catch (err) {
    // On 401 clear cache and retry once
    if (err.response?.status === 401) {
      console.warn('[tradovate] 401 — clearing token cache and retrying');
      _clearTokenCache();
      return await fn();
    }
    throw err;
  }
}

// ── Main interface ────────────────────────────────────────────────────────────

/**
 * Place a real order on Tradovate.
 *
 * @param {Object} orderSet - order set row from DB
 * @param {Object} signal   - { action: 'buy'|'sell', symbol: 'MNQ1!', price? }
 * @returns {Object} { filled, entryPrice, exitPrice, pnl, orderId }
 */
async function placeOrder(orderSet, signal) {
  const { action, symbol } = signal;
  const tickSize  = getTickSize(symbol);
  const tickValue = getTickValue(symbol);

  const { token, accountId, baseUrl } = await getAccessToken();
  const tradovateSymbol = await resolveSymbol(symbol, token, baseUrl);
  const tradovateAction = action === 'buy' ? 'Buy' : 'Sell';
  const oppositeAction  = action === 'buy' ? 'Sell' : 'Buy';

  // Determine order type and price
  const isLimit = orderSet.entry_type === 'limit_signal' || orderSet.entry_type === 'limit_offset';
  const orderType   = isLimit ? 'Limit' : 'Market';
  const limitPrice  = isLimit
    ? _roundToTick(_calcLimitPrice(orderSet, signal, tickSize), tickSize)
    : undefined;

  const hasBracket =
    orderSet.profit_target_ticks > 0 && orderSet.stop_loss_ticks > 0;

  let response;

  if (hasBracket) {
    // Calculate bracket prices from signal price (best estimate before fill)
    const basePrice = signal.price || limitPrice || 0;
    const tpDistance = orderSet.profit_target_ticks * tickSize;
    const slDistance = orderSet.stop_loss_ticks    * tickSize;

    const tpPrice = _roundToTick(
      action === 'buy' ? basePrice + tpDistance : basePrice - tpDistance,
      tickSize
    );
    const slPrice = _roundToTick(
      action === 'buy' ? basePrice - slDistance : basePrice + slDistance,
      tickSize
    );

    const body = {
      accountId,
      symbol:   tradovateSymbol,
      action:   tradovateAction,
      orderQty: orderSet.contracts,
      orderType,
      ...(isLimit ? { price: limitPrice } : {}),
      bracket1: { action: oppositeAction, orderType: 'Limit', price: tpPrice },
      bracket2: { action: oppositeAction, orderType: 'Stop',  stopPrice: slPrice },
    };

    console.log('[tradovate] placeoso', JSON.stringify(body));
    response = await _placeWithRetry(() =>
      axios.post(`${baseUrl}/order/placeoso`, body, {
        headers: { Authorization: `Bearer ${token}` },
      })
    );
  } else {
    const body = {
      accountId,
      symbol:   tradovateSymbol,
      action:   tradovateAction,
      orderQty: orderSet.contracts,
      orderType,
      ...(isLimit ? { price: limitPrice } : {}),
    };

    console.log('[tradovate] placeorder', JSON.stringify(body));
    response = await _placeWithRetry(() =>
      axios.post(`${baseUrl}/order/placeorder`, body, {
        headers: { Authorization: `Bearer ${token}` },
      })
    );
  }

  // Tradovate returns the order object; market fills come asynchronously.
  // Use signal price as entry estimate (same approach as mockBroker for V2).
  const orderId    = String(response.data.orderId ?? response.data.id ?? response.data.d?.orderId ?? 'unknown');
  const entryPrice = _roundToTick(signal.price || limitPrice || 0, tickSize);
  const tpDistance = (orderSet.profit_target_ticks || 0) * tickSize;
  const exitPrice  = _roundToTick(
    action === 'buy' ? entryPrice + tpDistance : entryPrice - tpDistance,
    tickSize
  );
  const pnl = parseFloat(
    ((orderSet.profit_target_ticks || 0) * tickValue * orderSet.contracts).toFixed(2)
  );

  console.log(`[tradovate] Order placed orderId=${orderId} entry~${entryPrice}`);

  return { filled: true, entryPrice, exitPrice, pnl, orderId };
}

module.exports = { placeOrder, getTickSize, getTickValue };
