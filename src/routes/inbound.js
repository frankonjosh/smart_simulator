import { config } from "../config.js";
import { verify } from "../hmac.js";
import { logEvent } from "../log.js";
import { applyEvent, isDuplicate } from "../store.js";

// Inbound endpoints: Curis pushes here when its own state changes.
// Path convention mirrors the event name with slashes:
//   scheme.activated  →  POST /smart/webhooks/scheme/activated
//
// Every endpoint:
//   1. verifies X-Curis-Signature against the raw body
//   2. short-circuits duplicates by event_id (idempotency)
//   3. applies to the in-memory shadow
//   4. logs the result

const EVENTS = [
  { event: "scheme.activated",    path: "/scheme/activated" },
  { event: "scheme.cancelled",    path: "/scheme/cancelled" },
  { event: "scheme.tier.updated", path: "/scheme/tier/updated" },
  { event: "member.enrolled",     path: "/member/enrolled" },
  { event: "member.terminated",   path: "/member/terminated" },
  { event: "claim.adjudicated",   path: "/claim/adjudicated" },
  { event: "claim.paid",          path: "/claim/paid" },
];

export async function registerInbound(app) {
  for (const { event, path } of EVENTS) {
    app.post(`/smart/webhooks${path}`, async (req, reply) => {
      const raw = req.rawBody ?? JSON.stringify(req.body ?? {});
      const sig = req.headers["x-curis-signature"];
      if (!verify(config.smartOutboundSecret, raw, sig)) {
        logEvent({
          direction: "inbound",
          event,
          status: "rejected",
          detail: { reason: "bad_signature" },
        });
        return reply.code(401).send({ error: "invalid signature" });
      }

      const payload = req.body ?? {};
      if (isDuplicate(payload.event_id)) {
        logEvent({
          direction: "inbound",
          event,
          status: "duplicate",
          detail: { event_id: payload.event_id },
        });
        return reply.code(200).send({ ok: true, deduped: true });
      }

      const result = applyEvent(event, payload);
      logEvent({
        direction: "inbound",
        event,
        status: result,
        detail: payload,
      });
      return reply.code(202).send({ ok: true, applied: result === "ok" });
    });
  }
}
