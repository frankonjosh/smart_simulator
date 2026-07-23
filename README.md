# curis-smart-simulator

Headless simulator that mimics SMART's REST API v2 so Curis can develop
against a real OAuth + REST flow without a live SMART tenant.

## Running

    npm install
    npm run dev      # node --watch on src/server.js

Default port is `6021`. Set `DB_FILE` to override the SQLite path
(defaults to `./data/sim.db`).

## OAuth handshake

    POST /oauth/token?grant_type=client_credentials&client_id=X&client_secret=Y

Any non-empty `(client_id, client_secret)` pair is accepted in dev.
Response: `{ access_token, token_type: "bearer", expires_in: 7200 }`.

Every non-/oauth call must carry `Authorization: Bearer <token>`.

## SMART endpoints implemented

**Underwriting:** `/schemes`, `/schemes/renewals`, `/schemes/activation`,
`/scheme/deactivations`, `/benefitCategories`, `/benefits`, `/bulk/benefits`,
`/benefit/rules`, `/benefit/activation`, `/benefit/deactivation`,
`/members`, `/members/cardreprints`, `/scheme/member/migration`,
`/member/renewals`, `/members/categorychange`, `/members/activations`,
`/bulk/members/activations`, `/members/deactivations`,
`/members/fingerprintremoval`, `/members/changes`, `/members/moneyaddition`,
`/members/moneyreduction`.

**Copay + Remittance:** `/copay/setup`, `/edi/open/batch`,
`/edi/close/batch`, `/edi/batch/invoice/add`, `/edi/batch/invoice/tracking`,
`/edi/batch/pay`.

**Claims + Preauth:** `/claims/edi`, `/claims/edi/status`, `/preauth/fetch`,
`/preauth/item/markback`, `/preauth/markback`.

## Test helpers (not SMART's contract)

    GET  /health
    GET  /sim/state
    POST /sim/seed/claim     { country?, payload }
    POST /sim/seed/preauth   { country?, payload }
    POST /sim/reset

`/sim/seed/claim` inserts a fully-formed SMART claim payload into
`seeded_claims`. The next `/claims/edi` poll picks it up.

## Reset

    rm -rf data && npm start
