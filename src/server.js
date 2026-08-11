// Fastify server. Mirrors real SMART's URL shape exactly:
//   Auth:  POST /api/v2/{customerid}/v1/auth/integ-clients/oauth/token
//   Data:  POST /api/v2/{customerid}/schemes ... /members ... etc.
//   Poll:  POST /api/v2/{customerid}/claims/edi ... GET /preauth/fetch
// Real SMART wraps every request under /api/v2/{customerid}. The sim
// does the same so a Postman collection or Curis smart-client that
// works against prod also works here — you only change the host.
import Fastify from 'fastify';
import { db } from './store/db.js';
import { issueToken, requireToken } from './auth/token.js';
import { registerUnderwriting } from './routes/underwriting.js';
import { registerCopay } from './routes/copay.js';
import { registerRemittance } from './routes/remittance.js';
import { registerClaims } from './routes/claims.js';
import { registerPreauth } from './routes/preauth.js';
import { registerSimHelpers } from './routes/sim.js';
import { registerUi } from './routes/ui.js';
import { registerEntra } from './routes/entra.js';
import { info } from './util/log.js';

const PORT = Number(process.env.PORT || 6021);

const app = Fastify({ logger: false });

// Entra's /token endpoint uses application/x-www-form-urlencoded (from
// golang.org/x/oauth2). Fastify won't parse it without a plugin — take
// it as raw text; the mock parses it manually.
app.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string' }, (_req, body, done) => done(null, body));

// Audit every request.
app.addHook('onResponse', async (req, reply) => {
    try {
        db.prepare(`INSERT INTO events (method, path, status, body) VALUES (?, ?, ?, ?)`)
          .run(req.method, req.url, reply.statusCode, JSON.stringify(req.body || null));
    } catch (_) {}
});

// ── Non-SMART surfaces (open, unprefixed) ────────────────────────────────
// Health, dev-only /sim/* helpers, and the mock Entra flow are outside
// the SMART URL shape by design — they aren't part of what we're
// simulating.
app.get('/health', async (_req, reply) => reply.send({ status: 'ok', service: 'curis-smart-simulator' }));
registerSimHelpers(app);
registerUi(app);
registerEntra(app);

// ── SMART API V2 shape: /api/v2/:customerid/... ──────────────────────────
// Everything the SMART Postman collection + real-SMART clients send
// lives under this prefix. Two mounts: one for the auth token endpoint
// (no bearer required — it issues the bearer), one for the token-gated
// resource endpoints.
app.register(async (scoped) => {
    // POST /api/v2/:customerid/v1/auth/integ-clients/oauth/token
    scoped.post('/v1/auth/integ-clients/oauth/token', issueToken);
}, { prefix: '/api/v2/:customerid' });

app.register(async (scoped) => {
    scoped.addHook('preHandler', requireToken);
    registerUnderwriting(scoped);
    registerCopay(scoped);
    registerRemittance(scoped);
    registerClaims(scoped);
    registerPreauth(scoped);
}, { prefix: '/api/v2/:customerid' });

app.listen({ host: '0.0.0.0', port: PORT }).then(() => {
    info('sim listening', { port: PORT });
}).catch((err) => {
    console.error(err);
    process.exit(1);
});
