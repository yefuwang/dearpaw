ALTER TABLE orders ADD COLUMN tracking_token TEXT;

UPDATE orders
SET tracking_token = lower(
  hex(randomblob(4)) || '-' ||
  hex(randomblob(2)) || '-' ||
  hex(randomblob(2)) || '-' ||
  hex(randomblob(2)) || '-' ||
  hex(randomblob(6))
)
WHERE tracking_token IS NULL;

CREATE UNIQUE INDEX idx_orders_tracking_token ON orders(tracking_token);
