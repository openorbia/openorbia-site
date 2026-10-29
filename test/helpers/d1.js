// A stand-in for a Cloudflare D1 binding, backed by real SQLite (node:sqlite, Node 22.5+), so the tests exercise the real
// SQL: unique constraints, INSERT OR IGNORE, RETURNING and transactions behave as they do in D1.

import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

const schema = readFileSync(new URL('../../schema.sql', import.meta.url), 'utf8');
const returnsRows = sql => /^\s*(select|with|pragma)\b/i.test(sql) || /\breturning\b/i.test(sql);

export function createDb() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(schema);

  const statement = (sql, params = []) => ({
    bind: (...p) => statement(sql, p),
    async first(column) {
      const row = sqlite.prepare(sql).get(...params) ?? null;
      return column && row ? row[column] : row;
    },
    async all() {
      return { success: true, results: sqlite.prepare(sql).all(...params), meta: { changes: 0 } };
    },
    async run() {
      const r = sqlite.prepare(sql).run(...params);
      return { success: true, results: [], meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
    },
    execute() { return returnsRows(sql) ? this.all() : this.run(); },
  });

  return {
    prepare: sql => statement(sql),
    async batch(list) { // like D1: all statements in one transaction
      const out = [];
      sqlite.exec('BEGIN');
      try {
        for (const s of list) out.push(await s.execute());
        sqlite.exec('COMMIT');
      } catch (e) {
        sqlite.exec('ROLLBACK');
        throw e;
      }
      return out;
    },
    // test helpers
    sql: sqlText => sqlite.exec(sqlText),
    rows: (sqlText, ...p) => sqlite.prepare(sqlText).all(...p),
  };
}

export function addLaunch(db, over = {}) {
  const l = {
    slug: 'sample-tool', name: 'Sample Tool', tagline: 'A sample tool', description: 'Sample description.', category: 'sec',
    repo_url: 'https://example.com/repo', website_url: null, logo_url: null, screenshots: '[]', video_url: null,
    maker_name: 'Sample Maker', maker_links: '[]', maker_story: 'Sample story.', license: 'MIT', launch_week: 1, launch_date: '2020-01-06',
    ...over,
  };
  const cols = Object.keys(l);
  db.prepare(`INSERT INTO launches (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`).bind(...cols.map(c => l[c])).run();
  return l;
}
