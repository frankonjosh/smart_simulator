import Fastify from "fastify";
import { config } from "./config.js";
import { registerInbound } from "./routes/inbound.js";
import { registerOutbound } from "./routes/outbound.js";
import { registerDebug } from "./routes/debug.js";

// Capture the raw body alongside the parsed JSON so HMAC verification
// hashes the exact bytes Curis signed (whitespace + key order preserved).
async function buildServer() {
  const app = Fastify({ logger: { level: "info" } });

  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (req, body, done) => {
      req.rawBody = body;
      try {
        done(null, body.length ? JSON.parse(body) : {});
      } catch (err) {
        err.statusCode = 400;
        done(err, undefined);
      }
    },
  );

  await registerDebug(app);
  await registerInbound(app);
  await registerOutbound(app);

  return app;
}

const app = await buildServer();

try {
  await app.listen({ port: config.port, host: "0.0.0.0" });
  app.log.info(
    {
      port: config.port,
      log_file: config.logFile,
      curis: config.curisBaseUrl,
      inbound_secret_set: Boolean(config.smartOutboundSecret),
      outbound_secret_set: Boolean(config.curisInboundSecret),
    },
    "curis-smart-simulator ready",
  );
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
