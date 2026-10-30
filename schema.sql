CREATE TABLE IF NOT EXISTS waitlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('maker','reader')),
  tool_url TEXT,
  country TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_waitlist_created ON waitlist(created_at);

-- Launch Week: one row per launched tool. Edit data/launches.json and run `npm run seed:local` / `npm run seed:remote`.
CREATE TABLE IF NOT EXISTS launches (
  slug         TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  tagline      TEXT NOT NULL,
  description  TEXT NOT NULL,
  category     TEXT NOT NULL CHECK (category IN ('biz','job','sec')),
  repo_url     TEXT,
  website_url  TEXT,
  logo_url     TEXT,
  screenshots  TEXT NOT NULL DEFAULT '[]',   -- JSON: [{ "src": "/launches/<slug>/shot-1.png", "alt": "..." }]
  video_url    TEXT,
  maker_name   TEXT NOT NULL,
  maker_links  TEXT NOT NULL DEFAULT '[]',   -- JSON: [{ "label": "GitHub", "url": "https://..." }]
  maker_story  TEXT NOT NULL DEFAULT '',
  license      TEXT NOT NULL,
  launch_week  INTEGER NOT NULL,
  launch_date  TEXT NOT NULL,                -- YYYY-MM-DD; voting opens 12:01 AM Pacific that day
  facts        TEXT NOT NULL DEFAULT '{}'    -- JSON "Free facts": freeTier, cardRequired, dataLocation, setup, catch, lastChecked, testedBy
);
CREATE INDEX IF NOT EXISTS idx_launches_week ON launches(launch_week);

-- One upvote per launch and visitor for the whole launch week. voter_hash is an HMAC of IP + user agent, salted with the
-- launch week and a server secret: the IP and user agent themselves are never stored, and there are no cookies.
CREATE TABLE IF NOT EXISTS votes (
  launch_slug TEXT NOT NULL REFERENCES launches(slug) ON DELETE CASCADE,
  voter_hash  TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (launch_slug, voter_hash)
);

-- Fixed-window rate limiter for POST /api/vote. The key is another HMAC (no raw IP); rows expire after their window.
CREATE TABLE IF NOT EXISTS rate_limits (
  key        TEXT PRIMARY KEY,
  count      INTEGER NOT NULL,
  expires_at INTEGER NOT NULL                -- unix seconds
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_expires ON rate_limits(expires_at);

-- How many times each tool's link was followed through /go/<slug>, per day (Pacific). Only a count: no IP address, user agent,
-- referrer or cookie is stored, and nothing in the table can be tied to a visitor.
CREATE TABLE IF NOT EXISTS clicks (
  slug  TEXT NOT NULL,                       -- a tool on the Launch List (public/assets/tools.js)
  day   TEXT NOT NULL,                       -- YYYY-MM-DD, Pacific
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (slug, day)
);
