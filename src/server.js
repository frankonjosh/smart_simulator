// Fastify server. Registers all routes, mounts OAuth (open) and every
// resource endpoint behind requireToken, plus /sim helpers open.
import Fastify from 'fastify';
import { db } from './store/db.js';
import { issueToken, requireToken } from './auth/token.js';
import { registerUnderwriting } from './routes/underwriting.js';
import { registerCopay } from './routes/copay.js';
import { registerRemittance } from './routes/remittance.js';
import { registerClaims } from './routes/claims.js';
import { registerPreauth } from './routes/preauth.js';
import { registerSimHelpers } from './routes/sim.js';
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

// Health — open.
app.get('/health', async (_req, reply) => reply.send({ status: 'ok', service: 'curis-smart-simulator' }));

// OAuth — open.
app.post('/oauth/token', issueToken);
app.post('/auth/oauth/token', issueToken);

// Sim helpers — open (dev only).
registerSimHelpers(app);

// Mock Entra ID (open — it IS the token issuer, so requireToken doesn't apply).
registerEntra(app);

// All resource endpoints require a valid bearer token.
app.register(async (scoped) => {
    scoped.addHook('preHandler', requireToken);
    registerUnderwriting(scoped);
    registerCopay(scoped);
    registerRemittance(scoped);
    registerClaims(scoped);
    registerPreauth(scoped);
});

app.listen({ host: '0.0.0.0', port: PORT }).then(() => {
    info('sim listening', { port: PORT });
}).catch((err) => {
    console.error(err);
    process.exit(1);
});
