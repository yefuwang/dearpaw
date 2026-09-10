ALTER TABLE orders ADD COLUMN stripe_checkout_session_id TEXT;

CREATE UNIQUE INDEX idx_orders_stripe_checkout_session
ON orders(stripe_checkout_session_id);

CREATE TABLE stripe_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
