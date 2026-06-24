import { db } from "./db.js";

// SQL-backed shadow of "what SMART knows". Survives restarts; matches
// the in-memory shape that earlier versions exposed via /sim/state.
//
// Idempotency: every Curis-supplied event_id is recorded in
// seen_event_ids the first time we see it. Re-deliveries short-circuit
// before reaching applyEvent().

// ── Statements (prepared once, reused) ──────────────────────────────────────

const stmt = {
  seenInsert: db.prepare(
    "INSERT OR IGNORE INTO seen_event_ids(event_id) VALUES (?)",
  ),
  seenLookup: db.prepare(
    "SELECT 1 AS hit FROM seen_event_ids WHERE event_id = ?",
  ),

  schemeUpsert: db.prepare(`
    INSERT INTO schemes(code, name, status, currency, policy_start, policy_end,
                        company_id, activated_at, cancelled_at, tiers, updated_at)
    VALUES (@code, @name, @status, @currency, @policy_start, @policy_end,
            @company_id, @activated_at, @cancelled_at, @tiers, datetime('now'))
    ON CONFLICT(code) DO UPDATE SET
      name         = excluded.name,
      status       = excluded.status,
      currency     = COALESCE(excluded.currency, schemes.currency),
      policy_start = COALESCE(excluded.policy_start, schemes.policy_start),
      policy_end   = COALESCE(excluded.policy_end, schemes.policy_end),
      company_id   = COALESCE(excluded.company_id, schemes.company_id),
      activated_at = COALESCE(excluded.activated_at, schemes.activated_at),
      cancelled_at = COALESCE(excluded.cancelled_at, schemes.cancelled_at),
      tiers        = excluded.tiers,
      updated_at   = datetime('now')
  `),
  schemeUpdateStatus: db.prepare(`
    UPDATE schemes SET status=@status, cancelled_at=@cancelled_at, updated_at=datetime('now')
    WHERE code=@code
  `),
  schemeSelect: db.prepare("SELECT * FROM schemes WHERE code = ?"),
  schemeAll: db.prepare("SELECT * FROM schemes ORDER BY code"),

  memberUpsert: db.prepare(`
    INSERT INTO members(scheme_code, member_number, tier_code, first_name, last_name, status, balances, updated_at)
    VALUES (@scheme_code, @member_number, @tier_code, @first_name, @last_name, @status, @balances, datetime('now'))
    ON CONFLICT(scheme_code, member_number) DO UPDATE SET
      tier_code  = excluded.tier_code,
      first_name = excluded.first_name,
      last_name  = excluded.last_name,
      status     = excluded.status,
      balances   = excluded.balances,
      updated_at = datetime('now')
  `),
  memberUpdateStatus: db.prepare(`
    UPDATE members SET status=@status, updated_at=datetime('now')
    WHERE scheme_code=@scheme_code AND member_number=@member_number
  `),
  memberUpdateBalances: db.prepare(`
    UPDATE members SET balances=@balances, updated_at=datetime('now')
    WHERE scheme_code=@scheme_code AND member_number=@member_number
  `),
  memberSelect: db.prepare(
    "SELECT * FROM members WHERE scheme_code = ? AND member_number = ?",
  ),
  memberAll: db.prepare("SELECT * FROM members ORDER BY scheme_code, member_number"),

  claimUpsert: db.prepare(`
    INSERT INTO claims(claim_number, scheme_code, member_number, status, lines, paid_amount, payment_ref, updated_at)
    VALUES (@claim_number, @scheme_code, @member_number, @status, @lines, @paid_amount, @payment_ref, datetime('now'))
    ON CONFLICT(claim_number) DO UPDATE SET
      scheme_code   = COALESCE(excluded.scheme_code, claims.scheme_code),
      member_number = COALESCE(excluded.member_number, claims.member_number),
      status        = excluded.status,
      lines         = CASE WHEN excluded.lines = '[]' THEN claims.lines ELSE excluded.lines END,
      paid_amount   = COALESCE(excluded.paid_amount, claims.paid_amount),
      payment_ref   = COALESCE(excluded.payment_ref, claims.payment_ref),
      updated_at    = datetime('now')
  `),
  claimAll: db.prepare("SELECT * FROM claims ORDER BY claim_number"),

  countSchemes: db.prepare("SELECT COUNT(*) AS n FROM schemes"),
  countMembers: db.prepare("SELECT COUNT(*) AS n FROM members"),
  countClaims:  db.prepare("SELECT COUNT(*) AS n FROM claims"),
  countSeen:    db.prepare("SELECT COUNT(*) AS n FROM seen_event_ids"),
};

// ── Idempotency ─────────────────────────────────────────────────────────────

export function isDuplicate(eventId) {
  if (!eventId) return false;
  return Boolean(stmt.seenLookup.get(eventId));
}

function rememberEvent(eventId) {
  if (!eventId) return false;
  const res = stmt.seenInsert.run(eventId);
  return res.changes > 0; // false means we'd already seen it
}

// ── Event router ────────────────────────────────────────────────────────────

export function applyEvent(event, payload) {
  if (!rememberEvent(payload?.event_id)) return "duplicate";
  switch (event) {
    case "scheme.activated":    applySchemeActivated(payload); break;
    case "scheme.cancelled":    applySchemeCancelled(payload); break;
    case "scheme.tier.updated": applySchemeTierUpdated(payload); break;
    case "member.enrolled":     applyMemberEnrolled(payload); break;
    case "member.terminated":   applyMemberTerminated(payload); break;
    case "claim.adjudicated":   applyClaimAdjudicated(payload); break;
    case "claim.paid":          applyClaimPaid(payload); break;
    default: return "unknown_event";
  }
  return "ok";
}

// ── Appliers ────────────────────────────────────────────────────────────────

function applySchemeActivated(p) {
  stmt.schemeUpsert.run({
    code:         p.scheme_code,
    name:         p.scheme_name ?? null,
    status:       "active",
    currency:     p.currency ?? null,
    policy_start: p.policy_start ?? null,
    policy_end:   p.policy_end ?? null,
    company_id:   p.company_id ?? null,
    activated_at: p.effective_at ?? null,
    cancelled_at: null,
    tiers:        JSON.stringify(p.tiers ?? []),
  });
}

function applySchemeCancelled(p) {
  stmt.schemeUpdateStatus.run({
    code:         p.scheme_code,
    status:       p.status ?? "cancelled",
    cancelled_at: p.effective_at ?? null,
  });
}

function applySchemeTierUpdated(p) {
  const row = stmt.schemeSelect.get(p.scheme_code);
  if (!row) return;
  const tiers = JSON.parse(row.tiers || "[]");
  const idx = tiers.findIndex((t) => t.tier_code === p.tier_code);
  const tier = { tier_code: p.tier_code, benefits: p.benefits ?? [] };
  if (idx >= 0) tiers[idx] = { ...tiers[idx], ...tier };
  else tiers.push(tier);
  stmt.schemeUpsert.run({
    code:         row.code,
    name:         row.name,
    status:       row.status,
    currency:     row.currency,
    policy_start: row.policy_start,
    policy_end:   row.policy_end,
    company_id:   row.company_id,
    activated_at: row.activated_at,
    cancelled_at: row.cancelled_at,
    tiers:        JSON.stringify(tiers),
  });
}

function applyMemberEnrolled(p) {
  stmt.memberUpsert.run({
    scheme_code:   p.scheme_code,
    member_number: p.member_number,
    tier_code:     p.tier_code ?? null,
    first_name:    p.first_name ?? null,
    last_name:     p.last_name ?? null,
    status:        "active",
    balances:      JSON.stringify(p.balances ?? {}),
  });
}

function applyMemberTerminated(p) {
  stmt.memberUpdateStatus.run({
    scheme_code:   p.scheme_code,
    member_number: p.member_number,
    status:        p.status ?? "terminated",
  });
}

function applyClaimAdjudicated(p) {
  stmt.claimUpsert.run({
    claim_number:  p.claim_number,
    scheme_code:   p.scheme_code ?? null,
    member_number: p.member_number ?? null,
    status:        "adjudicated",
    lines:         JSON.stringify(p.lines ?? []),
    paid_amount:   null,
    payment_ref:   null,
  });
}

function applyClaimPaid(p) {
  stmt.claimUpsert.run({
    claim_number:  p.claim_number,
    scheme_code:   p.scheme_code ?? null,
    member_number: p.member_number ?? null,
    status:        "paid",
    lines:         JSON.stringify(p.lines ?? []),
    paid_amount:   p.paid_amount ?? null,
    payment_ref:   p.payment_ref ?? null,
  });
  // Drain new balances into the member shadow if the event carries them.
  if (p.scheme_code && p.member_number && p.new_balances) {
    const existing = stmt.memberSelect.get(p.scheme_code, p.member_number);
    const merged = {
      ...(existing ? JSON.parse(existing.balances || "{}") : {}),
      ...p.new_balances,
    };
    if (existing) {
      stmt.memberUpdateBalances.run({
        scheme_code:   p.scheme_code,
        member_number: p.member_number,
        balances:      JSON.stringify(merged),
      });
    }
  }
}

// ── Snapshot for /sim/state ─────────────────────────────────────────────────

export function snapshot() {
  const decode = (row) => ({
    ...row,
    tiers:    row.tiers    !== undefined ? safeJson(row.tiers,    []) : undefined,
    balances: row.balances !== undefined ? safeJson(row.balances, {}) : undefined,
    lines:    row.lines    !== undefined ? safeJson(row.lines,    []) : undefined,
  });
  return {
    schemes: stmt.schemeAll.all().map(decode),
    members: stmt.memberAll.all().map(decode),
    claims:  stmt.claimAll.all().map(decode),
    counts: {
      schemes:     stmt.countSchemes.get().n,
      members:     stmt.countMembers.get().n,
      claims:      stmt.countClaims.get().n,
      seen_events: stmt.countSeen.get().n,
    },
  };
}

function safeJson(text, fallback) {
  if (text == null) return fallback;
  try { return JSON.parse(text); } catch { return fallback; }
}
