CREATE TABLE IF NOT EXISTS schemes (
    cln_pol_code       TEXT PRIMARY KEY,
    company_name       TEXT NOT NULL,
    start_date         TEXT,
    end_date           TEXT,
    pol_type_id        INTEGER,
    policy_currency_id TEXT,
    country            TEXT,
    status             TEXT DEFAULT 'active',
    created_at         TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
    cln_pol_code TEXT NOT NULL,
    cln_cat_code TEXT NOT NULL,
    cat_desc     TEXT NOT NULL,
    country      TEXT,
    created_at   TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (cln_pol_code, cln_cat_code)
);

CREATE TABLE IF NOT EXISTS benefits (
    cln_pol_code  TEXT NOT NULL,
    cat_code      TEXT NOT NULL,
    cln_ben_code  TEXT NOT NULL,
    benefit_desc  TEXT NOT NULL,
    sub_limit_amt INTEGER,
    service_type  INTEGER,
    country       TEXT,
    active        INTEGER DEFAULT 1,
    created_at    TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (cln_pol_code, cat_code, cln_ben_code)
);

CREATE TABLE IF NOT EXISTS members (
    membership_number TEXT PRIMARY KEY,
    cln_pol_code      TEXT NOT NULL,
    cln_cat_code      TEXT,
    family_code       TEXT,
    mem_type          TEXT,
    surname           TEXT,
    second_name       TEXT,
    dob               TEXT,
    gender            TEXT,
    phone_number      TEXT,
    email_address     TEXT,
    status            TEXT DEFAULT 'active',
    country           TEXT,
    created_at        TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS copays (
    integ_scheme_code  TEXT NOT NULL,
    integ_cat_code     TEXT,
    integ_ben_code     TEXT,
    integ_prov_code    TEXT,
    integ_service_code TEXT,
    copay_type         INTEGER,
    amount             REAL,
    country            TEXT,
    created_at         TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS batches (
    integ_batch_code TEXT PRIMARY KEY,
    integ_prov_code  TEXT,
    integ_app_code   TEXT,
    status           TEXT DEFAULT 'open',
    country          TEXT,
    created_at       TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS batch_invoices (
    integ_batch_code TEXT NOT NULL,
    inv_no           TEXT NOT NULL,
    rejected_amt     REAL,
    comment          TEXT,
    created_at       TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (integ_batch_code, inv_no)
);

CREATE TABLE IF NOT EXISTS money_movements (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    member_number  TEXT NOT NULL,
    benefit_code   TEXT,
    amount         REAL,
    return_code    TEXT,
    return_reason  TEXT,
    invoice_id     TEXT,
    country        TEXT,
    created_at     TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS seeded_claims (
    claim_id     INTEGER PRIMARY KEY AUTOINCREMENT,
    payload      TEXT NOT NULL,
    status       TEXT DEFAULT 'ready',
    country      TEXT DEFAULT 'KE',
    picked_at    TEXT
);

CREATE TABLE IF NOT EXISTS seeded_preauths (
    preauth_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    payload      TEXT NOT NULL,
    status       TEXT DEFAULT 'ready',
    country      TEXT DEFAULT 'KE',
    picked_at    TEXT
);

CREATE TABLE IF NOT EXISTS events (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    at         TEXT NOT NULL DEFAULT (datetime('now')),
    method     TEXT,
    path       TEXT,
    status     INTEGER,
    body       TEXT
);

CREATE TABLE IF NOT EXISTS tokens (
    token       TEXT PRIMARY KEY,
    client_id   TEXT,
    issued_at   TEXT DEFAULT (datetime('now')),
    expires_at  TEXT NOT NULL
);
