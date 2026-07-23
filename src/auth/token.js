import { db } from '../store/db.js';
import { v4 as uuid } from 'uuid';

const TTL_SECONDS = 60 * 60 * 2;

// POST /oauth/token?grant_type=client_credentials&client_id=X&client_secret=Y
export async function issueToken(req, reply) {
    const { grant_type, client_id, client_secret } = req.query;
    if (grant_type !== 'client_credentials' || !client_id || !client_secret) {
        return reply.status(400).send({ error: 'invalid_request' });
    }
    const token = uuid();
    const expiresAt = new Date(Date.now() + TTL_SECONDS * 1000).toISOString();
    db.prepare(`INSERT INTO tokens (token, client_id, expires_at) VALUES (?, ?, ?)`)
      .run(token, client_id, expiresAt);
    return reply.send({
        access_token: token,
        token_type: 'bearer',
        expires_in: TTL_SECONDS,
    });
}

// requireToken middleware — validates the Authorization: Bearer header.
export function requireToken(req, reply, done) {
    const auth = req.headers['authorization'] || '';
    const m = auth.match(/^Bearer\s+(.+)$/);
    if (!m) {
        return reply.status(401).send({ error: 'Invalid Access Token', http_status_code: 4, message: 'Unauthorized' });
    }
    const row = db.prepare(`SELECT expires_at FROM tokens WHERE token = ?`).get(m[1]);
    if (!row) {
        return reply.status(401).send({ error: 'Invalid Access Token', http_status_code: 4, message: 'Unauthorized' });
    }
    if (new Date(row.expires_at) < new Date()) {
        return reply.status(401).send({ error: 'Invalid Access Token', http_status_code: 4, message: 'Unauthorized' });
    }
    done();
}
