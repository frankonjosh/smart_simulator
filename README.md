# curis-smart-simulator

Headless simulator for the SMART integration. Pretends to be SMART so we can
develop Curis's bi-directional contract end-to-end without a live SMART tenant.

## Two directions

| Direction | Endpoint | Auth header | Secret |
|---|---|---|---|
| SMART → Curis (claims submission) | `POST /api/v1/smart/{operator_code}/claims` on Curis | `X-Smart-Signature` | `CURIS_INBOUND_SECRET` |
| Curis → SMART (state mirroring) | `POST /smart/webhooks/...` on the simulator | `X-Curis-Signature` | `SMART_OUTBOUND_SECRET` |

The simulator listens for the seven Curis → SMART events agreed in the
[SMART simulator plan][plan]:

- `scheme.activated`, `scheme.cancelled`, `scheme.tier.updated`
- `member.enrolled`, `member.terminated`
- `claim.adjudicated`, `claim.paid`

Every push is signature-verified, deduped by `event_id`, applied to a
SQLite-backed shadow, and recorded in the `events` audit table.

## Storage

A single SQLite file at `DB_FILE` (default `./data/sim.db`) holds
everything:

| Table | What it holds |
|---|---|
| `schemes`, `members`, `claims` | Shadow of "what SMART knows" (mirror of Curis state) |
| `events` | Full audit log — every inbound + outbound call, success or failure |
| `seen_event_ids` | Idempotency guard; survives restarts so retries always dedupe |
| `schema_migrations` | Tracks which `migrations/*.sql` have been applied |

Schema lives in `migrations/` and is applied at boot. To start clean,
stop the simulator and `rm -rf data/`.

[plan]: ../../memory/project_smart_simulator.md

## Run

```bash
cp .env .env       # then fill in the two HMAC secrets
npm install
npm run dev                # node --watch on src/server.js
```

Default port is `6021` (Curis BE is 6011, FE is 6010).

## Inbound endpoints (Curis pushes here)

```
POST /smart/webhooks/scheme/activated
POST /smart/webhooks/scheme/cancelled
POST /smart/webhooks/scheme/tier/updated
POST /smart/webhooks/member/enrolled
POST /smart/webhooks/member/terminated
POST /smart/webhooks/claim/adjudicated
POST /smart/webhooks/claim/paid
```

Each expects:

- `Content-Type: application/json`
- `X-Curis-Signature: <hex(HMAC-SHA256(SMART_OUTBOUND_SECRET, body))>`
- Body MUST carry `event_id` (string) and `event_version` (number, currently `1`).

Returns `202` on apply, `200` with `{ deduped: true }` on duplicate, `401`
on bad signature.

## Outbound (fire claims at Curis)

```bash
# Bundled scenario
curl -X POST http://localhost:6021/sim/fire/claim \
  -H 'Content-Type: application/json' \
  -d '{"scenario":"happy-outpatient"}'

# Arbitrary payload
curl -X POST http://localhost:6021/sim/fire/claim \
  -H 'Content-Type: application/json' \
  -d '{"payload":{"scheme_code":"jalinsure-2026", ... }}'
```

The response is Curis's response verbatim (status code passed through).

## Debug

```
GET /health            → liveness
GET /sim/state         → current shadow (schemes, members, claims, counts)
GET /sim/events?limit  → last N log lines
GET /sim/scenarios     → list bundled scenario fixtures
```

## Postman collection

Import `postman/curis-smart-simulator.postman_collection.json` and the
matching environment file from the same folder. The collection covers
health checks, firing claims at Curis, and simulating every Curis → SMART
event with HMAC signing handled by a pre-request script. See
`postman/README.md` for setup.

## Adding scenarios

Drop `src/scenarios/<name>.json` matching the Curis `smartWebhookPayload`
shape from `Curis-Back/internal/handlers/smart_webhook.go`. The file name
(without `.json`) becomes the `scenario` parameter.
