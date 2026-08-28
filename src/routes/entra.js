// Mock Entra ID endpoints, for local development only. Curis's Entra client
// points at these when ENTRA_ENDPOINT_OVERRIDE is set. Any (client_id,
// client_secret) is accepted — there is no real authentication here.
//
// The identity comes from, in order: the `login_hint` query param, the
// ENTRA_MOCK_EMAIL env var, or whatever the person types on the stand-in's
// sign-in page.
import crypto from 'node:crypto';
import { info } from '../util/log.js';

// In-memory map of one-shot codes issued by /authorize → consumed by /token.
const codes = new Map();

// ENTRA_MOCK_EMAIL pins the identity so a scripted smoke never has to fill in
// the sign-in page. Left unset, the stand-in asks who is signing in — which is
// what a person at a browser expects.
const MOCK_EMAIL_FIXED = (process.env.ENTRA_MOCK_EMAIL || '').trim().toLowerCase();

// ENTRA_MOCK_MFA makes the pinned identity's tokens claim a second factor.
const MOCK_MFA_FIXED = String(process.env.ENTRA_MOCK_MFA || '').toLowerCase() === 'true';

// Where this stand-in is reachable. The issuer it stamps into tokens has to be
// the issuer the relying party expects, which it derives from the same base.
const SIM_BASE = (process.env.SIM_BASE_URL || 'http://localhost:6021').replace(/\/$/, '');
const issuerFor = (tenant) => `${SIM_BASE}/entra/${tenant}/v2.0`;

// A real signing key, generated once per process. Tokens are signed for real
// so the relying party's signature verification runs in local testing exactly
// as it will against Microsoft — an unsigned shortcut here would mean the
// check is never exercised until production.
const KEY_ID = 'sim-key-1';
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });

const b64url = (input) => Buffer.from(input).toString('base64url');

// signIDToken mints an RS256 JWT with the claims Entra would supply.
function signIDToken({ tenant, clientId, email, oid, mfa }) {
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', typ: 'JWT', kid: KEY_ID };
    const payload = {
        iss: issuerFor(tenant),
        aud: clientId,
        tid: tenant,
        oid,
        preferred_username: email,
        upn: email,
        name: email.split('@')[0],
        amr: mfa ? ['pwd', 'mfa'] : ['pwd'],
        auth_time: now,
        iat: now,
        nbf: now,
        exp: now + 3600,
    };
    const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
    const signature = crypto
        .createSign('RSA-SHA256')
        .update(signingInput)
        .sign(privateKey)
        .toString('base64url');
    return `${signingInput}.${signature}`;
}

// jwksDocument publishes the public half, in the shape Entra uses.
function jwksDocument() {
    const jwk = publicKey.export({ format: 'jwk' });
    return { keys: [{ kid: KEY_ID, kty: 'RSA', alg: 'RS256', use: 'sig', n: jwk.n, e: jwk.e }] };
}

// issueCode mints a one-shot authorization code for an identity and returns
// the redirect back to the relying party.
function issueCode(reply, { redirect_uri, state, client_id, email, mfa }) {
    const code = 'mock-' + Math.random().toString(36).slice(2, 18);
    codes.set(code, {
        client_id,
        email: email.toLowerCase(),
        mfa: !!mfa,
        expires: Date.now() + 5 * 60 * 1000,
    });
    info('entra: authorize', { code, email: email.toLowerCase(), mfa: !!mfa });
    const sep = redirect_uri.includes('?') ? '&' : '?';
    return reply.redirect(`${redirect_uri}${sep}code=${code}&state=${state}`);
}

// signInPage asks which identity to sign in as. Real Entra shows the user a
// sign-in screen here; without one the stand-in silently returns a canned
// account, which makes every test look like the same person. Deliberately
// plain and self-labelled: it must never be mistaken for Microsoft's page.
function signInPage({ redirect_uri, state, client_id, prefill, error }) {
    const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[ch]));
    return `<!doctype html>
<html><head><meta charset="utf-8"><title>Local sign-in stand-in</title>
<style>
  body { font-family: system-ui, sans-serif; background: #f4f5f7; margin: 0;
         display: flex; align-items: center; justify-content: center; min-height: 100vh; }
  form { background: #fff; padding: 32px; border-radius: 10px; width: 360px;
         box-shadow: 0 8px 28px rgba(0,0,0,0.10); }
  h1 { font-size: 17px; margin: 0 0 4px; }
  p.note { font-size: 12px; color: #666; margin: 0 0 20px; line-height: 1.5; }
  label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; }
  input { width: 100%; padding: 10px; font-size: 14px; border: 1px solid #c8cacc;
          border-radius: 6px; box-sizing: border-box; }
  button { margin-top: 16px; width: 100%; padding: 11px; font-size: 14px; font-weight: 600;
           color: #fff; background: #444; border: 0; border-radius: 6px; cursor: pointer; }
  .err { color: #b71c1c; font-size: 12px; margin-top: 8px; }
  label.check { display: flex; align-items: center; gap: 8px; font-weight: 400;
                font-size: 12px; color: #444; margin: 12px 0 0; }
  label.check input { width: auto; }
</style></head><body>
<form method="POST" action="sign-in">
  <h1>Local sign-in stand-in</h1>
  <p class="note">This is the simulator standing in for the identity provider on a
     developer machine. It is not Microsoft and performs no real authentication.
     Enter the email address of the Curis account to sign in as.</p>
  <label for="email">Email address</label>
  <input id="email" name="email" type="email" required autofocus value="${esc(prefill)}">
  <label class="check"><input type="checkbox" name="mfa" checked>
     Report this sign-in as multi-factor (amr includes "mfa")</label>
  ${error ? `<div class="err">${esc(error)}</div>` : ''}
  <input type="hidden" name="redirect_uri" value="${esc(redirect_uri)}">
  <input type="hidden" name="state" value="${esc(state)}">
  <input type="hidden" name="client_id" value="${esc(client_id)}">
  <button type="submit">Continue</button>
</form>
</body></html>`;
}

export function registerEntra(app) {
    // GET /entra/{tenant}/oauth2/v2.0/authorize
    // With ?login_hint= (or ENTRA_MOCK_EMAIL set) the identity is already
    // decided, so issue the code straight away — that keeps scripted smokes
    // non-interactive. Otherwise show the sign-in page and let the person
    // choose, the way the real provider would.
    app.get('/entra/:tenant/oauth2/v2.0/authorize', async (req, reply) => {
        const { redirect_uri, state, client_id, login_hint } = req.query;
        if (!redirect_uri || !state || !client_id) {
            return reply.status(400).send({ error: 'invalid_request' });
        }
        const decided = login_hint || MOCK_EMAIL_FIXED;
        if (decided) {
            return issueCode(reply, {
                redirect_uri, state, client_id, email: decided, mfa: MOCK_MFA_FIXED,
            });
        }
        return reply.type('text/html').send(
            signInPage({ redirect_uri, state, client_id, prefill: '' }),
        );
    });

    // POST /entra/{tenant}/oauth2/v2.0/sign-in — the stand-in's own form target.
    app.post('/entra/:tenant/oauth2/v2.0/sign-in', async (req, reply) => {
        const body = typeof req.body === 'string'
            ? Object.fromEntries(new URLSearchParams(req.body))
            : (req.body || {});
        const { redirect_uri, state, client_id } = body;
        const email = String(body.email || '').trim();
        if (!redirect_uri || !state || !client_id) {
            return reply.status(400).send({ error: 'invalid_request' });
        }
        if (!email.includes('@')) {
            return reply.type('text/html').send(signInPage({
                redirect_uri, state, client_id, prefill: email,
                error: 'Enter a valid email address.',
            }));
        }
        return issueCode(reply, {
            redirect_uri, state, client_id, email,
            mfa: String(body.mfa || '') === 'on',
        });
    });

    // GET /entra/{tenant}/discovery/v2.0/keys — the public half of the signing
    // key, so the relying party can verify what this stand-in signed.
    app.get('/entra/:tenant/discovery/v2.0/keys', async (_req, reply) => reply.send(jwksDocument()));

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
        const tenant = req.params.tenant;
        const oid = 'mock-oid-' + entry.email;
        const idToken = signIDToken({
            tenant, clientId: clientID, email: entry.email, oid, mfa: entry.mfa,
        });
        info('entra: token issued', { email: entry.email, mfa: !!entry.mfa });
        return reply.send({
            // The access token is not consumed by the relying party any more —
            // identity comes from the signed id_token — so it stays opaque.
            access_token: 'mock-access-' + code,
            token_type: 'Bearer',
            expires_in: 3600,
            scope: 'openid profile email User.Read',
            id_token: idToken,
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
            const email = oid.replace(/^mock-oid-/, '') || MOCK_EMAIL_FIXED;
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
