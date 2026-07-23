import { db } from '../store/db.js';
import { smartOK } from '../util/response.js';
import { info } from '../util/log.js';

export function registerPreauth(app) {
    // GET /preauth/fetch — return ready preauths.
    app.get('/preauth/fetch', async (req, reply) => {
        const limit = parseInt(req.query.limit || '100', 10);
        const country = req.query.country || 'KE';

        const rows = db.prepare(`
            SELECT preauth_id, payload FROM seeded_preauths
            WHERE status = 'ready' AND country = ?
            ORDER BY preauth_id ASC
            LIMIT ?
        `).all(country, limit);

        const preauths = rows.map((r) => JSON.parse(r.payload));
        info('preauth fetched', { count: preauths.length });
        return reply.send({ preauths });
    });

    // POST /preauth/item/markback — Phase 3 will make real per-item decisions.
    app.post('/preauth/item/markback', async (_req, reply) => reply.send(smartOK()));

    // POST /preauth/markback — pick-status ack.
    app.post('/preauth/markback', async (req, reply) => {
        const { pick_status, id } = req.body || {};
        const newStatus = pick_status === 1 ? 'picked' : (pick_status === 2 ? 'failed' : 'ready');
        db.prepare(`UPDATE seeded_preauths SET status=?, picked_at=datetime('now') WHERE preauth_id=?`)
          .run(newStatus, id);
        info('preauth markback', { id, newStatus });
        return reply.send(smartOK(String(id)));
    });
}
