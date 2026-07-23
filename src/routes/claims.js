import { db } from '../store/db.js';
import { smartOK } from '../util/response.js';
import { info } from '../util/log.js';

export function registerClaims(app) {
    // POST /claims/edi — return ready seeded claims for the country.
    app.post('/claims/edi', async (req, reply) => {
        const limit = parseInt(req.query.limit || '100', 10);
        const isUpdate = req.query.isUpdate === 'true';
        const country = req.query.country || 'KE';

        const rows = db.prepare(`
            SELECT claim_id, payload FROM seeded_claims
            WHERE status = 'ready' AND country = ?
            ORDER BY claim_id ASC
            LIMIT ?
        `).all(country, limit);

        if (isUpdate) {
            const stmt = db.prepare(`UPDATE seeded_claims SET status='picked', picked_at=datetime('now') WHERE claim_id=?`);
            for (const r of rows) stmt.run(r.claim_id);
        }

        const claims = rows.map((r) => JSON.parse(r.payload));
        info('claims fetched', { count: claims.length, isUpdate });
        return reply.send({
            successful: true,
            claim_count: claims.length,
            has_more: false,
            fetch_id_from: rows[0]?.claim_id ?? 0,
            fetch_id_to: rows[rows.length - 1]?.claim_id ?? 0,
            claims,
        });
    });

    // POST /claims/edi/status — Curis ack after materialisation.
    app.post('/claims/edi/status', async (req, reply) => {
        const { claimId, status } = req.query;
        const newStatus = status === '1' ? 'picked' : (status === '2' ? 'failed' : 'ready');
        db.prepare(`UPDATE seeded_claims SET status=?, picked_at=datetime('now') WHERE claim_id=?`)
          .run(newStatus, parseInt(claimId, 10));
        info('claim markback', { claimId, newStatus });
        return reply.send(smartOK(claimId));
    });
}
