import "dotenv/config";
import path from "node:path";

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function optional(name, fallback) {
  const v = process.env[name];
  return v === undefined || v === "" ? fallback : v;
}

export const config = {
  port: Number(optional("PORT", "6021")),
  // SQLite file. Survives restarts; the events table inside replaces
  // the old data/events.log JSON-lines log.
  dbFile: path.resolve(optional("DB_FILE", "./data/sim.db")),
  curisBaseUrl: optional("CURIS_BASE_URL", "http://localhost:6011"),
  curisOperatorCode: optional("CURIS_OPERATOR_CODE", ""),
  // Outbound HMAC: SMART → Curis (we sign with this when firing claims).
  curisInboundSecret: optional("CURIS_INBOUND_SECRET", ""),
  // Inbound HMAC: Curis → SMART (we verify with this on every webhook).
  smartOutboundSecret: optional("SMART_OUTBOUND_SECRET", ""),
};

// Surfacing missing secrets at boot keeps the failure mode obvious.
// Empty is allowed during early dev — handlers will reject unsigned
// payloads explicitly when a secret IS configured.
export function assertSecretsConfigured() {
  if (!config.smartOutboundSecret) {
    throw new Error("SMART_OUTBOUND_SECRET is required to verify Curis webhooks");
  }
  if (!config.curisInboundSecret) {
    throw new Error("CURIS_INBOUND_SECRET is required to fire claims at Curis");
  }
}

export { required };
