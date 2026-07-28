CREATE TABLE IF NOT EXISTS schemes (
    cln_pol_code       TEXT PRIMARY KEY,
    company_name       TEXT NOT NULL,
    start_date         TEXT,
    end_date           TEXT,
    pol_type_id        INTEGER,
    policy_currency_id TEXT,
    country            TEXT,
    -- Guide-mandated fields that real SMART persists per row.
    user_id            TEXT,     -- userId — who approved sending this to SMART
    anniv              INTEGER,  -- renewal history indicator (0, 1, 2)
    customerid         TEXT,     -- API-consumer identifier
    -- §2.9 / §2.10 activation / deactivation audit fields
    status_reason      TEXT,
    status             TEXT DEFAULT 'active',
    created_at         TEXT DEFAULT (datetime('now')),
    updated_at         TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
    cln_pol_code TEXT NOT NULL,
    cln_cat_code TEXT NOT NULL,
    cat_desc     TEXT NOT NULL,
    -- §2.2 guide-mandated
    user_id      TEXT,
    customerid   TEXT,
    country      TEXT,
    created_at   TEXT DEFAULT (datetime('now')),
    updated_at   TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (cln_pol_code, cln_cat_code)
);

CREATE TABLE IF NOT EXISTS benefits (
    cln_pol_code         TEXT NOT NULL,
    cat_code             TEXT NOT NULL,
    cln_ben_code         TEXT NOT NULL,
    benefit_desc         TEXT NOT NULL,
    -- §2.3 / §2.3.1 guide-mandated
    policy_number        TEXT,   -- policyNumber (may differ from cln_pol_code on renewal)
    ben_type_id          TEXT,   -- benTypeId: 0=per person, 1=per family
    sub_limit_amt        INTEGER,
    service_type         INTEGER,
    mem_assigned_benefit INTEGER, -- memAssignedBenefit: -1=all, 1/3=female only
    user_id              TEXT,   -- userId
    ben_linked2tqcode    TEXT,   -- benLinked2Tqcode: parent benefit code or '-'
    ben_typ_desc         TEXT,   -- benTypDesc
    customerid           TEXT,
    country              TEXT,
    -- §2.11 / §2.12 activation audit fields
    status_reason        TEXT,
    active               INTEGER DEFAULT 1,
    created_at           TEXT DEFAULT (datetime('now')),
    updated_at           TEXT DEFAULT (datetime('now')),
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
    -- §2.5 guide-mandated extras
    third_name        TEXT,   -- thirdName
    other_names       TEXT,   -- otherNames
    id_number         TEXT,   -- idNumber
    nhif_number       TEXT,   -- nhifNumber
    staff_number      TEXT,   -- staffNumber
    scheme_start_date TEXT,   -- schemeStartDate
    scheme_end_date   TEXT,   -- schemeEndDate
    roaming_countries TEXT,   -- roamingCountries
    user_id           TEXT,   -- userID
    customerid        TEXT,
    dob               TEXT,
    gender            TEXT,
    phone_number      TEXT,
    email_address     TEXT,
    -- §2.15 / §2.16 activation/deactivation audit
    status_reason     TEXT,
    status            TEXT DEFAULT 'active',
    country           TEXT,
    created_at        TEXT DEFAULT (datetime('now')),
    updated_at        TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS card_reprints (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    member_number  TEXT NOT NULL,
    staff_number   TEXT,
    user_id        TEXT,
    customerid     TEXT,
    reorder_reason TEXT,
    country        TEXT,
    created_at     TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS fingerprint_removals (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    member_number TEXT NOT NULL,
    user_id       TEXT,
    customerid    TEXT,
    change_reason TEXT,
    country       TEXT,
    created_at    TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS benefit_rules (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    integ_scheme_code    TEXT NOT NULL,
    integ_cat_code       TEXT NOT NULL,
    integ_ben_code       TEXT NOT NULL,
    is_autogrowth        INTEGER,
    autogrowth_max       INTEGER,
    autogrowth_min       INTEGER,
    autogrowth_rate      INTEGER,
    autogrowth_rate_type INTEGER,
    autorep_limit        INTEGER,
    autorep_limit_type   INTEGER,
    has_reserve_parent   TEXT,
    is_autogrowth2       INTEGER,
    autogrowth_json      TEXT,   -- autogrowth2_json / autogrowth_json
    is_autorep           INTEGER,
    is_threshold         INTEGER,
    reserve_action       INTEGER,
    reserve_parent_pool  INTEGER,
    threshold_action     INTEGER,
    threshold_rate       INTEGER,
    threshold_rate_type  INTEGER,
    is_waitingperiod     INTEGER,
    waiting_days         INTEGER,
    waiting_months       INTEGER,
    is_buffer            INTEGER,
    buffer_type          INTEGER,
    buffer_limit         INTEGER,
    buffer_action        INTEGER,
    is_prorated          INTEGER,
    proration_type       INTEGER,
    is_frequency         INTEGER,
    frequency_limit      INTEGER,
    customerid           TEXT,
    country              TEXT,
    created_at           TEXT DEFAULT (datetime('now'))
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
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    member_number   TEXT NOT NULL,
    benefit_code    TEXT,
    smart_bill_id   TEXT,   -- smartBillId
    returned_amount REAL,   -- returnedAmount (renamed from 'amount' to match guide param name)
    return_code     TEXT,
    return_reason   TEXT,
    date_entered    TEXT,   -- dateEntered
    provider_code   TEXT,   -- providerCode
    invoice_number  TEXT,   -- invoiceNumber
    user_id         TEXT,   -- userId
    cln_pol_code    TEXT,   -- clnPolCode
    invoice_date    TEXT,   -- invoiceDate
    invoice_id      TEXT,
    customerid      TEXT,
    anniv           INTEGER,
    country         TEXT,
    created_at      TEXT DEFAULT (datetime('now'))
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
