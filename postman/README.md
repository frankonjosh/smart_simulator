# Postman collection — Curis SMART Simulator

Two files:

| File | What it is |
|---|---|
| `curis-smart-simulator.postman_collection.json` | All endpoints, grouped by direction. |
| `curis-smart-simulator.postman_environment.json` | URLs + the HMAC secret used by the pre-request signer. |

## One-time setup

1. **Import both files** into Postman (File → Import).
2. **Select the environment** in the top-right ("Curis SMART Simulator (local)").
3. **Fill in `smart_outbound_secret`** — same hex string that's in `operators.smart_outbound_secret` for the operator you're targeting, and in the simulator's `.env` under `SMART_OUTBOUND_SECRET`. Generate one with `openssl rand -hex 32` and use it in all three places.
4. Boot the simulator (`npm start` in the parent dir).

## Folders

### Health & State
Sanity-check the simulator is up. Hit `GET /sim/state` to see the in-memory shadow.

### Outbound (SMART → Curis)
Tells the simulator to fire a claim at Curis. The simulator does the HMAC signing using its own `CURIS_INBOUND_SECRET` env — Postman never touches that secret.

- **Scenario request**: posts `{"scenario":"happy-outpatient"}` to pick a bundled fixture.
- **Custom request**: posts `{"payload":{ ... }}` with any payload you author.

### Inbound (Curis → SMART)
Pretends to be Curis pushing events to the simulator. Each request has a pre-request script that:
1. Substitutes Postman variables (e.g. `{{$guid}}` for `event_id`).
2. HMAC-SHA256 signs the substituted body with `smart_outbound_secret`.
3. Attaches `X-Curis-Signature`.

Use these when you want to verify the simulator's apply logic without bouncing through Curis.

### Negative tests
- Bad signature → expect `401`.
- Repeat a successful inbound request a second time → expect `200 { deduped: true }`.

## Notes

- `event_id` must be unique across runs. Postman's `{{$guid}}` generates a fresh UUID per request — leave it as-is.
- The collection's `Outbound` calls hit the **simulator**, not Curis directly. The simulator handles signing and forwards to Curis. If you want to bypass the simulator and hit Curis directly, you'll need to compute the HMAC outside Postman (or add another pre-request script).
