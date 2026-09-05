ALTER TABLE production_updates ADD COLUMN visibility TEXT NOT NULL DEFAULT 'customer';

CREATE INDEX idx_production_updates_visibility ON production_updates(visibility);
