// Mock Entra ID endpoints. Curis's Entra client points at these when
// SSO_MOCK is set. The mock accepts any (client_id, client_secret)
// and returns a canned user identified by the `login_hint` query
// param passed on /authorize, or "admin@kbil.co.ke" by default.
import { info } from '../util/log.js';

// In-memory map of one-shot codes issued by /authorize → consumed by /token.
const codes = new Map();

export function registerEntra(app) {
    // GET /entra/{tenant}/oauth2/v2.0/authorize
    // Skips user consent — immediately generates a code and redirects.
    app.get('/entra/:tenant/oauth2/v2.0/authorize', async (req, reply) => {
        const { redirect_uri, state, client_id, login_hint } = req.query;
        if (!redirect_uri || !state || !client_id) {
            return reply.status(400).send({ error: 'invalid_request' });
        }
        const code = 'mock-' + Math.random().toString(36).slice(2, 18);
        codes.set(code, {
            client_id,
            email: (login_hint || 'admin@kbil.co.ke').toLowerCase(),
            expires: Date.now() + 5 * 60 * 1000,
        });
        info('entra: authorize', { code, email: codes.get(code).email });
        const sep = redirect_uri.includes('?') ? '&' : '?';
        return reply.redirect(`${redirect_uri}${sep}code=${code}&state=${state}`);
    });

    // POST /entra/{tenant}/oauth2/v2.0/token
    // application/x-www-form-urlencoded body from golang.org/x/oauth2.
    app.post('/entra/:tenant/oauth2/v2.0/token', async (req, reply) => {
        const rawBody = typeof req.body === 'string' ? req.body : '';
        const params = new URLSearchParams(rawBody);
        const code = params.get('code');
        const clientID = params.get('client_id');
        if (!code || !clientID) return reply.status(400).send({ error: 'invalid_request' });
        const entry = codes.get(code);
        if (!entry || entry.expires < Date.now() || entry.client_id !== clientID) {
            return reply.status(400).send({ error: 'invalid_grant' });
        }
        codes.delete(code);
        const payload = Buffer.from(JSON.stringify({
            appid: clientID,
            aud: clientID,
            oid: 'mock-oid-' + entry.email,
        })).toString('base64url');
        const access = `mock.${payload}.sig`;
        info('entra: token issued', { email: entry.email });
        return reply.send({
            access_token: access,
            token_type: 'Bearer',
            expires_in: 3600,
            scope: 'openid profile email User.Read',
            id_token: access,
        });
    });

    // GET /graph/v1.0/me — decodes the token payload and returns a canned profile.
    app.get('/graph/v1.0/me', async (req, reply) => {
        const auth = req.headers['authorization'] || '';
        const m = auth.match(/^Bearer\s+(.+)$/);
        if (!m) return reply.status(401).send({ error: 'unauthorized' });
        try {
            const parts = m[1].split('.');
            const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
            const oid = payload.oid || 'mock-oid';
            const email = oid.replace(/^mock-oid-/, '') || 'admin@kbil.co.ke';
            return reply.send({
                id: oid,
                mail: email,
                userPrincipalName: email,
                displayName: email.split('@')[0],
                givenName: 'Mock',
                surname: 'User',
            });
        } catch (e) {
            return reply.status(401).send({ error: 'invalid_token' });
        }
    });
}
