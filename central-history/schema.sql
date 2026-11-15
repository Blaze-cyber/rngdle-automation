CREATE TABLE IF NOT EXISTS pulls (
  bot_id TEXT NOT NULL,
  game_date TEXT NOT NULL,
  roll_number INTEGER NOT NULL,
  earned_ep REAL NOT NULL,
  total_ep REAL,
  rarity TEXT NOT NULL,
  badges_json TEXT NOT NULL DEFAULT '[]',
  rolled_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (bot_id, game_date)
);

CREATE INDEX IF NOT EXISTS pulls_game_date_idx ON pulls(game_date DESC);
CREATE INDEX IF NOT EXISTS pulls_rarity_idx ON pulls(rarity);
CREATE INDEX IF NOT EXISTS pulls_bot_date_idx ON pulls(bot_id, game_date DESC);
