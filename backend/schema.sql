CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE algos (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  webhook_id UUID NOT NULL DEFAULT gen_random_uuid(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  -- Kill switch
  kill_switch_amount NUMERIC(10,2) NOT NULL DEFAULT 500,
  kill_switch_pause TEXT NOT NULL DEFAULT 'rest_of_day', -- '1h','2h','4h','rest_of_day','manual'
  daily_pnl NUMERIC(10,2) NOT NULL DEFAULT 0,
  kill_switch_triggered_at TIMESTAMPTZ,
  -- Schedule
  schedule_enabled BOOLEAN NOT NULL DEFAULT false,
  schedule_start TIME,
  schedule_end TIME,
  schedule_days TEXT[] DEFAULT ARRAY['Mon','Tue','Wed','Thu','Fri'],
  schedule_timezone TEXT NOT NULL DEFAULT 'America/New_York',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE order_sets (
  id SERIAL PRIMARY KEY,
  algo_id INTEGER NOT NULL REFERENCES algos(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Order Set',
  is_active BOOLEAN NOT NULL DEFAULT true,
  contracts INTEGER NOT NULL DEFAULT 1,
  -- Entry
  entry_type TEXT NOT NULL DEFAULT 'market', -- 'market','limit_signal','limit_offset'
  limit_offset_ticks INTEGER NOT NULL DEFAULT 2,
  -- Profit target
  profit_target_ticks INTEGER NOT NULL DEFAULT 20,
  -- Stop loss
  stop_type TEXT NOT NULL DEFAULT 'fixed', -- 'fixed','trailing'
  stop_ticks INTEGER NOT NULL DEFAULT 20,
  -- Breakeven
  breakeven_enabled BOOLEAN NOT NULL DEFAULT false,
  breakeven_ticks INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE signal_log (
  id SERIAL PRIMARY KEY,
  algo_id INTEGER NOT NULL REFERENCES algos(id) ON DELETE CASCADE,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  action TEXT NOT NULL, -- 'buy','sell'
  symbol TEXT NOT NULL,
  status TEXT NOT NULL, -- 'executed','blocked_kill_switch','blocked_schedule','error'
  error_message TEXT,
  entry_price NUMERIC(12,4),
  exit_price NUMERIC(12,4),
  pnl NUMERIC(10,2),
  order_sets_fired INTEGER DEFAULT 0
);

-- Index for fast signal log queries per algo
CREATE INDEX idx_signal_log_algo_id ON signal_log(algo_id);
CREATE INDEX idx_signal_log_received_at ON signal_log(received_at DESC);
