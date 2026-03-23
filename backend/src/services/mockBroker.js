/**
 * mockBroker.js
 * Simulates trade execution. This is the ONLY file that changes
 * when we wire in a real broker (Tradovate). The interface stays identical.
 *
 * Tick sizes per symbol (approximate):
 *   MNQ/NQ  = 0.25 per tick  ($0.50 per tick per contract MNQ)
 *   MES/ES  = 0.25 per tick  ($1.25 per tick per contract MES)
 *   Default = 0.25
 */

const TICK_SIZE = {
  'MNQ1!': 0.25,
  'NQ1!': 0.25,
  'MES1!': 0.25,
  'ES1!': 0.25,
  'YM1!': 1,
  'MYM1!': 1,
  'RTY1!': 0.1,
  'M2K1!': 0.1,
};

const TICK_VALUE = {
  'MNQ1!': 0.50,
  'NQ1!': 5.00,
  'MES1!': 1.25,
  'ES1!': 12.50,
  'YM1!': 5.00,
  'MYM1!': 0.50,
  'RTY1!': 5.00,
  'M2K1!': 0.50,
};

function getTickSize(symbol) {
  return TICK_SIZE[symbol] || 0.25;
}

function getTickValue(symbol) {
  return TICK_VALUE[symbol] || 0.50;
}

/**
 * Simulate placing an order and getting filled.
 *
 * @param {Object} orderSet - order set config from DB
 * @param {Object} signal   - { action: 'buy'|'sell', symbol, price? }
 * @returns {Object} { filled, entryPrice, exitPrice, pnl, orderId }
 */
function placeOrder(orderSet, signal) {
  const { action, symbol } = signal;
  const tickSize = getTickSize(symbol);
  const tickValue = getTickValue(symbol);

  // Determine entry price
  let basePrice = signal.price || _mockMarketPrice(symbol);
  let entryPrice;

  if (orderSet.entry_type === 'market') {
    // Small random slippage (0-1 tick)
    const slippage = Math.random() < 0.5 ? 0 : tickSize;
    entryPrice = action === 'buy'
      ? basePrice + slippage
      : basePrice - slippage;
  } else if (orderSet.entry_type === 'limit_signal') {
    // Fill exactly at the signal price (optimistic mock)
    entryPrice = basePrice;
  } else if (orderSet.entry_type === 'limit_offset') {
    // Offset in favor of the trader
    const offset = orderSet.limit_offset_ticks * tickSize;
    entryPrice = action === 'buy'
      ? basePrice - offset
      : basePrice + offset;
  } else {
    entryPrice = basePrice;
  }

  // Round to tick size
  entryPrice = _roundToTick(entryPrice, tickSize);

  // Calculate exit price and P&L
  let exitTicks = orderSet.profit_target_ticks;

  // Trailing stop with profit lock: simulate stopping at the lock level
  // (realistic worst-case for mock — trail gets hit at guaranteed profit)
  if (orderSet.stop_type === 'trailing' && orderSet.trail_lock_ticks) {
    exitTicks = parseInt(orderSet.trail_lock_ticks, 10);
  }

  const exitDistance = exitTicks * tickSize;
  const exitPrice = action === 'buy'
    ? entryPrice + exitDistance
    : entryPrice - exitDistance;

  const pnl = exitTicks * tickValue * orderSet.contracts;

  return {
    filled: true,
    entryPrice: _roundToTick(entryPrice, tickSize),
    exitPrice: _roundToTick(exitPrice, tickSize),
    pnl: parseFloat(pnl.toFixed(2)),
    orderId: `MOCK-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
  };
}

function _roundToTick(price, tickSize) {
  return Math.round(price / tickSize) * tickSize;
}

// Approximate mid prices for common futures
function _mockMarketPrice(symbol) {
  const prices = {
    'MNQ1!': 19500,
    'NQ1!': 19500,
    'MES1!': 5200,
    'ES1!': 5200,
    'YM1!': 39000,
    'MYM1!': 39000,
    'RTY1!': 2050,
    'M2K1!': 2050,
  };
  return prices[symbol] || 1000;
}

module.exports = { placeOrder, getTickSize, getTickValue };
