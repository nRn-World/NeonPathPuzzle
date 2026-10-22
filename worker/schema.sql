CREATE TABLE IF NOT EXISTS scores (
  board TEXT NOT NULL,
  player_id TEXT NOT NULL,
  name TEXT NOT NULL,
  value INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (board, player_id)
);
CREATE INDEX IF NOT EXISTS scores_board_value ON scores (board, value);

CREATE TABLE IF NOT EXISTS ratings (
  player_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  rating INTEGER NOT NULL,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ratings_rating ON ratings (rating);
