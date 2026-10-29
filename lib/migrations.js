// Changes to a database that already exists. schema.sql only creates what is missing (CREATE TABLE IF NOT EXISTS), so a new
// column on an existing table needs an ALTER. Each migration says how to tell whether it is already applied, so running
// `npm run db:migrate:local` / `db:migrate:remote` again is safe.

export const MIGRATIONS = [
  {
    name: 'launches.facts (Free facts)',
    applied: "SELECT COUNT(*) AS n FROM pragma_table_info('launches') WHERE name = 'facts'",
    sql: "ALTER TABLE launches ADD COLUMN facts TEXT NOT NULL DEFAULT '{}'",
  },
];
