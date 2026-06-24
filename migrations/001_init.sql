-- Initial schema. SQLite uses TEXT for ISO-8601 timestamps and JSON-encoded
-- blobs; that's fine for a simulator and keeps inspection trivial (any
-- column is readable with `sqlite3 data/sim.db 'SELECT * FROM events'`).

-- ─── Mirror of Curis schemes (told to us via scheme.activated etc.) ─────────
CREATE TABLE schemes (
    code          TEXT PRIMARY KEY,
    name          TEXT,
    status        TEXT NOT NULL,
    currency      TEXT,
    policy_start  TEXT,
    policy_end    TEXT,
    company_id    INTEGER,
    activated_at  TEXT,
    cancelled_at  TEXT,
    -- Tiers + their benefits live as JSON since we hand the snapshot back
    -- to callers wholesale and never query into it.
    tiers         TEXT NOT NULL DEFAULT '[]',
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── Mirror of Curis members ────────────────────────────────────────────────
CREATE TABLE members (
    scheme_code   TEXT NOT NULL,
    member_number TEXT NOT NULL,
    tier_code     TEXT,
    first_name    TEXT,
    last_name     TEXT,
    status        TEXT NOT NULL,
    balances      TEXT NOT NULL DEFAULT '{}',
    updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (scheme_code, member_number)
);

-- ─── Mirror of Curis claims ─────────────────────────────────────────────────
CREATE TABLE claims (
    claim_number  TEXT PRIMARY KEY,
    scheme_code   TEXT,
    member_number TEXT,
    status        TEXT NOT NULL,
    lines         TEXT NOT NULL DEFAULT '[]',
    paid_amount   REAL,
    payment_ref   TEXT,
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── Idempotency: every Curis-supplied event_id we've ever processed. ──────
-- Bounded growth is fine for a sim; production would add a TTL/LRU.
CREATE TABLE seen_event_ids (
    event_id TEXT PRIMARY KEY,
    seen_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── Audit trail: every event in either direction, success or failure. ─────
-- Replaces the old data/events.log. `direction` is 'inbound' (Curis→SMART)
-- or 'outbound' (SMART→Curis). `status` is 'ok' | 'duplicate' | 'rejected'
-- | 'error'. `detail` is free-form JSON for the original payload, response,
-- error message, etc.
CREATE TABLE events (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    ts            TEXT NOT NULL DEFAULT (datetime('now')),
    direction     TEXT NOT NULL,
    event         TEXT NOT NULL,
    status        TEXT NOT NULL,
    event_id      TEXT,
    detail        TEXT
);

CREATE INDEX idx_events_ts        ON events(ts DESC);
CREATE INDEX idx_events_event     ON events(event);
CREATE INDEX idx_events_direction ON events(direction);
CREATE INDEX idx_events_event_id  ON events(event_id);
