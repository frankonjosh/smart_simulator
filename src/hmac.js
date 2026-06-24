import crypto from "node:crypto";

// HMAC-SHA256(secret, body) → lowercase hex. Mirrors the scheme Curis uses
// on its inbound /smart/webhook endpoint, so the same helper signs in both
// directions — only the secret + header name differ.
//
// Header names by direction:
//   SMART → Curis:  X-Smart-Signature  (we sign with curisInboundSecret)
//   Curis → SMART:  X-Curis-Signature  (we verify with smartOutboundSecret)

export function sign(secret, body) {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

export function verify(secret, body, signature) {
  if (!signature) return false;
  const expected = sign(secret, body);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature.trim().toLowerCase(), "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
