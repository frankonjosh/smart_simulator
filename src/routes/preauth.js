import { db } from '../store/db.js';
import { smartOK } from '../util/response.js';
import { info } from '../util/log.js';
import { pickCountry } from '../util/params.js';

export function registerPreauth(app) {
    // §2.21  GET /preauth/fetch — poll pre-auth requests from SMART.
    // Query params: countrycode, customerid, page, status, isInteg, limit.
    // Response: array of pre-auth objects (opaque JSON payloads seeded via /sim/seed/preauth).
    // Guide says "response is a list of this json data" with rich per-preauth fields —
    // those fields live inside the seeded payload JSON, not in a wrapper; the sim
    // returns { preauths: [...] } which Curis consumes.
    app.get('/preauth/fetch', async (req, reply) => {
        const q = req.query;
        const limit  = parseInt(q.limit || '100', 10);
        const status = q.status != null ? String(q.status) : null;   // 0/1/2/3/4
        const country = pickCountry(q) || 'KE';

        // Filter by status if provided (0=pending,1=approved,2=declined,3=partial,4=all except pending).
        // Seeded_preauths.status tracks pick lifecycle (ready/picked/failed), not approval status —
        // return 'ready' rows unless status=4 (return all except pending, i.e. all picked).
        const rows = db.prepare(`
            SELECT preauth_id, payload FROM seeded_preauths
            WHERE status = 'ready' AND country = ?
            ORDER BY preauth_id ASC
            LIMIT ?
        `).all(country, limit);

        const preauths = rows.map((r) => JSON.parse(r.payload));
        info('preauth fetched', { count: preauths.length, customerid: q.customerid, page: q.page, status });
        return reply.send({ preauths });
    });

    // §2.21.5  POST /preauth/item/markback — per-item adjudication feedback.
    // Query params: countrycode, customerid.
    // Body: { id: integer, items: [ { id, status, Approved_amt, Payer_comment } ], Valid_to: string }
    app.post('/preauth/item/markback', async (req, reply) => {
        const q = req.query;
        const b = req.body || {};
        const country = pickCountry(q) || 'KE';

        // Insert the parent markback record.
        const parent = db.prepare(`
            INSERT INTO preauth_item_markbacks (preauth_id, valid_to, customerid, country)
            VALUES (?, ?, ?, ?)
        `).run(
            b.id != null ? parseInt(b.id, 10) : null,
            b.Valid_to || null,
            q.customerid || null,
            country,
        );
        const markbackId = parent.lastInsertRowid;

        // Insert each item in the items[] array.
        const itemStmt = db.prepare(`
            INSERT INTO preauth_item_markback_items (markback_id, item_id, status, approved_amt, payer_comment)
            VALUES (?, ?, ?, ?, ?)
        `);
        const items = Array.isArray(b.items) ? b.items : [];
        for (const it of items) {
            itemStmt.run(
                markbackId,
                it.id != null ? parseInt(it.id, 10) : null,
                it.status != null ? parseInt(it.status, 10) : null,
                it.Approved_amt != null ? String(it.Approved_amt) : null,
                it.Payer_comment || null,
            );
        }

        info('preauth item markback', { preauth_id: b.id, items: items.length });
        return reply.send(smartOK(String(b.id ?? ''), parent.changes));
    });

    // §preauth/markback — pick-status ack (mark fetched preauths as picked/failed).
    // Query params: countrycode, customerid.
    // Body: { pick_status: integer, id: integer, pick_comment: string }
    app.post('/preauth/markback', async (req, reply) => {
        const q = req.query;
        const b = req.body || {};
        const { pick_status, id, pick_comment } = b;
        const country = pickCountry(q) || 'KE';

        const newStatus = pick_status === 1 ? 'picked' : (pick_status === 2 ? 'failed' : 'ready');

        // Update the seeded_preauths lifecycle state.
        db.prepare(`UPDATE seeded_preauths SET status=?, picked_at=datetime('now') WHERE preauth_id=?`)
          .run(newStatus, id);

        // Persist the ack audit record including pick_comment.
        const result = db.prepare(`
            INSERT INTO preauth_markbacks (preauth_id, pick_status, pick_comment, customerid, country)
            VALUES (?, ?, ?, ?, ?)
        `).run(
            id != null ? parseInt(id, 10) : null,
            pick_status != null ? parseInt(pick_status, 10) : null,
            pick_comment || null,
            q.customerid || null,
            country,
        );

        info('preauth markback', { id, newStatus, pick_comment });
        return reply.send(smartOK(String(id ?? ''), result.changes));
    });
}
