// Changes to a database that already exists. schema.sql only creates what is missing (CREATE TABLE IF NOT EXISTS), so a new
// column on an existing table needs an ALTER. Each migration says how to tell whether it is already applied, so running
// `npm run db:migrate:local` / `db:migrate:remote` again is safe.

export const MIGRATIONS = [
  {
    name: 'launches.facts (Free facts)',
    applied: "SELECT COUNT(*) AS n FROM pragma_table_info('launches') WHERE name = 'facts'",
    sql: "ALTER TABLE launches ADD COLUMN facts TEXT NOT NULL DEFAULT '{}'",
  },
  {
    name: 'clicks (per-tool click counts)',
    applied: "SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name = 'clicks'",
    sql: 'CREATE TABLE clicks (slug TEXT NOT NULL, day TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (slug, day))',
  },
  {
    name: 'submissions (tools submitted at /submit/)',
    applied: "SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name = 'submissions'",
    sql: "CREATE TABLE submissions (id INTEGER PRIMARY KEY AUTOINCREMENT, tool_name TEXT NOT NULL, url TEXT NOT NULL, maker_name TEXT NOT NULL, email TEXT NOT NULL, category TEXT NOT NULL, license TEXT NOT NULL, free_tier TEXT NOT NULL, card_required TEXT NOT NULL, setup TEXT NOT NULL, paid_level TEXT NOT NULL, paid_deps TEXT NOT NULL DEFAULT '', assets_link TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'new', created_at TEXT NOT NULL DEFAULT (datetime('now')))",
  },
  {
    name: 'requests (Find me a free tool, at /request/)',
    applied: "SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name = 'requests'",
    sql: "CREATE TABLE requests (id INTEGER PRIMARY KEY AUTOINCREMENT, task TEXT NOT NULL, audience TEXT NOT NULL, no_install INTEGER NOT NULL DEFAULT 0, no_card INTEGER NOT NULL DEFAULT 0, runs_locally INTEGER NOT NULL DEFAULT 0, email TEXT NOT NULL DEFAULT '', publish_ok INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'new', created_at TEXT NOT NULL DEFAULT (datetime('now')))",
  },
];
