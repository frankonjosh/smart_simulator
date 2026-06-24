import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { postClaimToCuris } from "../client.js";
import { logEvent } from "../log.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const scenariosDir = path.resolve(here, "..", "scenarios");

function loadScenario(name) {
  const file = path.join(scenariosDir, `${name}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function listScenarios() {
  if (!fs.existsSync(scenariosDir)) return [];
  return fs
    .readdirSync(scenariosDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""));
}

export async function registerOutbound(app) {
  // List bundled scenarios for the CLI / Bruno collection.
  app.get("/sim/scenarios", async () => ({ items: listScenarios() }));

  // Fire a claim at Curis. Either pass a `scenario` name to use a
  // bundled fixture, or pass a raw `payload` to send arbitrary JSON.
  app.post("/sim/fire/claim", async (req, reply) => {
    const { scenario, payload, overrides } = req.body ?? {};
    let body = payload;
    if (!body && scenario) {
      body = loadScenario(scenario);
      if (!body) {
        return reply.code(404).send({ error: `scenario not found: ${scenario}` });
      }
    }
    if (!body) {
      return reply.code(400).send({ error: "provide either `scenario` or `payload`" });
    }
    if (overrides && typeof overrides === "object") {
      body = { ...body, ...overrides };
    }

    try {
      const resp = await postClaimToCuris(body);
      logEvent({
        direction: "outbound",
        event: "claim.submit",
        status: resp.status >= 200 && resp.status < 300 ? "ok" : "error",
        detail: { sent: body, response: resp },
      });
      return reply.code(resp.status).send(resp.body);
    } catch (err) {
      logEvent({
        direction: "outbound",
        event: "claim.submit",
        status: "error",
        detail: { sent: body, error: String(err) },
      });
      return reply.code(502).send({ error: "claim submission failed", message: String(err) });
    }
  });
}
