import { db } from '../store/db.js';
import { smartOK } from '../util/response.js';
import { info } from '../util/log.js';
import { pickCountry, pickCustomerId } from '../util/params.js';

export function registerClaims(app) {
    // §2.1  POST /claims/edi — return ready seeded claims for the country.
    // Query params: country (or countrycode), customerid, isUpdate, limit.
    // Response shape matches guide §2.1 example exactly (not smartOK envelope).
    app.post('/claims/edi', async (req, reply) => {
        const q = req.query;
        const limit    = parseInt(q.limit || '100', 10);
        const isUpdate = q.isUpdate === 'true';
        const country  = pickCountry(q) || 'KE';
        const cust     = pickCustomerId(req) || '';

        // Tenant isolation: a claim seeded for CUST-A is only served to
        // CUST-A. Seeds with an empty customerid are tenant-agnostic
        // (visible to any tenant) so pre-isolation seeds keep working.
        const rows = db.prepare(`
            SELECT claim_id, payload FROM seeded_claims
            WHERE status = 'ready' AND country = ? AND (customerid = ? OR customerid = '')
            ORDER BY claim_id ASC
            LIMIT ?
        `).all(country, cust, limit);

        if (isUpdate) {
            const stmt = db.prepare(`UPDATE seeded_claims SET status='picked', picked_at=datetime('now') WHERE claim_id=?`);
            for (const r of rows) stmt.run(r.claim_id);
        }

        const claims = rows.map((r) => JSON.parse(r.payload));
        info('claims fetched', { count: claims.length, isUpdate, customerid: pickCustomerId(req) });

        // Guide §2.1 response envelope — NOT smartOK.
        return reply.send({
            status_msg: null,
            successful: true,
            fetch_id_from: rows[0]?.claim_id ?? 0,
            fetch_id_to:   rows[rows.length - 1]?.claim_id ?? 0,
            claim_count:   claims.length,
            has_more:      false,
            claims,
        });
    });

    // §2.2  POST /claims/edi/status — Curis ack after materialisation.
    // Query params: customerid, countrycode, statusMsg, status, claimId.
    // status: 0=not picked, 1=picked successfully, 2=failed.
    app.post('/claims/edi/status', async (req, reply) => {
        const q = req.query;
        const country  = pickCountry(q) || 'KE';
        const { claimId, status, statusMsg } = q;

        const newStatus = status === '1' ? 'picked' : (status === '2' ? 'failed' : 'ready');

        // Update the seeded_claims lifecycle.
        db.prepare(`UPDATE seeded_claims SET status=?, picked_at=datetime('now') WHERE claim_id=?`)
          .run(newStatus, parseInt(claimId, 10));

        // Persist the ack audit record including statusMsg.
        const result = db.prepare(`
            INSERT INTO claim_status_acks (claim_id, status, status_msg, customerid, country)
            VALUES (?, ?, ?, ?, ?)
        `).run(
            claimId || null,
            status != null ? parseInt(status, 10) : null,
            statusMsg || null,
            pickCustomerId(req),
            country,
        );

        info('claim markback', { claimId, newStatus, statusMsg });
        return reply.send(smartOK(claimId, result.changes));
    });
}
