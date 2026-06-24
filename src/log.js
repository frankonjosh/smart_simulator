import { db } from "./db.js";

// Audit log backed by the events table. Every inbound + outbound call
// gets one row regardless of outcome. Replaces the old JSON-lines
// data/events.log; the previous on-disk log was lost on each cleanup,
// the SQL table survives restarts and supports real queries.

const insertEvent = db.prepare(`
  INSERT INTO events(direction, event, status, event_id, detail)
  VALUES (@direction, @event, @status, @event_id, @detail)
`);

const tailQuery = db.prepare(`
  SELECT id, ts, direction, event, status, event_id, detail
  FROM events
  ORDER BY id DESC
  LIMIT ?
`);

export function logEvent({ direction, event, status, detail }) {
  const eventId = detail && typeof detail === "object" ? detail.event_id ?? null : null;
  insertEvent.run({
    direction,
    event,
    status,
    event_id: eventId,
    detail: detail !== undefined ? JSON.stringify(detail) : null,
  });
  // Mirror to stdout so `npm run dev` is useful without opening the DB.
  // Newest-last order; tail of npm output reads naturally.
  const line = JSON.stringify({ ts: new Date().toISOString(), direction, event, status, event_id: eventId });
  process.stdout.write(line + "\n");
}

export function tailEvents(limit = 50) {
  const n = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 1000) : 50;
  return tailQuery
    .all(n)
    .map((r) => ({
      ...r,
      detail: r.detail ? safeJson(r.detail) : null,
    }))
    .reverse(); // return oldest-first within the page, like the old log tail
}

function safeJson(text) {
  try { return JSON.parse(text); } catch { return null; }
}
