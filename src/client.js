import { config } from "./config.js";
import { sign } from "./hmac.js";

// Fire a SMART → Curis claim. Curis routes inbound webhooks per operator
// via the URL: POST /api/v1/smart/{operator_code}/claims. The payload
// mirrors smartWebhookPayload in Curis-Back/internal/handlers/smart_webhook.go.
// We don't validate shape here — that's Curis's job; the simulator's
// job is to deliver whatever scenario the caller asked for and let
// Curis respond.

export async function postClaimToCuris(payload) {
  if (!config.curisOperatorCode) {
    throw new Error("CURIS_OPERATOR_CODE is not set — cannot route the claim");
  }
  const body = JSON.stringify(payload);
  const signature = sign(config.curisInboundSecret, body);
  const url = `${config.curisBaseUrl}/api/v1/smart/${encodeURIComponent(
    config.curisOperatorCode,
  )}/claims`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Smart-Signature": signature,
    },
    body,
  });
  let parsed;
  const text = await res.text();
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { raw: text };
  }
  return { status: res.status, body: parsed };
}
