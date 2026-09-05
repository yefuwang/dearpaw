CREATE TABLE production_updates (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  stage TEXT NOT NULL,
  note TEXT NOT NULL,
  media_storage_key TEXT,
  media_type TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_production_updates_order_id ON production_updates(order_id);
CREATE INDEX idx_production_updates_stage ON production_updates(stage);
CREATE INDEX idx_production_updates_created_at ON production_updates(created_at);
