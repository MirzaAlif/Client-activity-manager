-- schema.sql
-- The blueprint of our database. It only creates tables if they don't exist yet,
-- so it is safe to run every time the server starts.

-- TABLE 1: clients (the people/companies names)
CREATE TABLE IF NOT EXISTS clients (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,      -- unique number, SQLite fills it in.
    name       TEXT NOT NULL,                          -- required
    email      TEXT NOT NULL UNIQUE COLLATE NOCASE,    -- required, no duplicates (case-insensitive)
    phone      TEXT DEFAULT '',                        -- optional
    company    TEXT DEFAULT '',                        -- optional
    created_at TEXT DEFAULT CURRENT_TIMESTAMP          -- filled automatically
);

-- TABLE 2: activities (tasks that belong to ONE client)
CREATE TABLE IF NOT EXISTS activities (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id   INTEGER NOT NULL,                      -- which client owns this task
    title       TEXT NOT NULL,
    description TEXT DEFAULT '',
    status      TEXT NOT NULL DEFAULT 'Pending'
                CHECK (status IN ('Pending', 'In Progress', 'Completed')),  -- database refuses any other value
    due_date    TEXT DEFAULT '',                       -- stored as 'YYYY-MM-DD'
    created_at  TEXT DEFAULT CURRENT_TIMESTAMP,

    -- Link to the clients table. If a client is deleted, all of their
    -- activities are deleted too (CASCADE), so we never have "orphan" rows.
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

-- INDEXES: like the index at the back of a book.
-- We look up activities by client_id and filter by status all the time,
-- so these make those queries fast even with millions of rows.
CREATE INDEX IF NOT EXISTS idx_activities_client ON activities(client_id);
CREATE INDEX IF NOT EXISTS idx_activities_status ON activities(client_id, status);
