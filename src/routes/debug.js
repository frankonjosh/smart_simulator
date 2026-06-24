import { snapshot } from "../store.js";
import { tailEvents } from "../log.js";

// Read-only debugging endpoints. Useful for asserting the simulator's
// shadow state after a run, and for tailing the event log without
// shelling into the data dir.

export async function registerDebug(app) {
  app.get("/health", async () => ({ ok: true, ts: new Date().toISOString() }));
  app.get("/sim/state", async () => snapshot());
  app.get("/sim/events", async (req) => {
    const limit = Number(req.query?.limit ?? 50);
    return { items: tailEvents(Number.isFinite(limit) && limit > 0 ? limit : 50) };
  });
}
