CREATE TABLE IF NOT EXISTS places (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  maps_url TEXT NOT NULL,
  place_id TEXT NOT NULL,
  address TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  note TEXT NOT NULL,
  tags TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
