CREATE TABLE IF NOT EXISTS scores (
  board TEXT NOT NULL,
  player_id TEXT NOT NULL,
  name TEXT NOT NULL,
  value INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (board, player_id)
);
CREATE INDEX IF NOT EXISTS scores_board_value ON scores (board, value);
