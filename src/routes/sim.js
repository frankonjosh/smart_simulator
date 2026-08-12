import { db } from '../store/db.js';

export function registerSimHelpers(app) {
    // GET /sim/state — snapshot of every table (bounded).
    app.get('/sim/state', async (_req, reply) => {
        return reply.send({
            schemes: db.prepare('SELECT * FROM schemes LIMIT 200').all(),
            categories: db.prepare('SELECT * FROM categories LIMIT 200').all(),
            benefits: db.prepare('SELECT * FROM benefits LIMIT 200').all(),
            members: db.prepare('SELECT * FROM members LIMIT 200').all(),
            copays: db.prepare('SELECT * FROM copays LIMIT 200').all(),
            batches: db.prepare('SELECT * FROM batches LIMIT 200').all(),
            money_movements: db.prepare('SELECT * FROM money_movements LIMIT 200').all(),
            seeded_claims: db.prepare('SELECT claim_id, status, picked_at, country, customerid FROM seeded_claims LIMIT 200').all(),
            seeded_preauths: db.prepare('SELECT preauth_id, status, picked_at, country, customerid FROM seeded_preauths LIMIT 200').all(),
            card_reprints: db.prepare('SELECT * FROM card_reprints LIMIT 200').all(),
            fingerprint_removals: db.prepare('SELECT * FROM fingerprint_removals LIMIT 200').all(),
            benefit_rules: db.prepare('SELECT * FROM benefit_rules LIMIT 200').all(),
            batch_invoices: db.prepare('SELECT * FROM batch_invoices LIMIT 200').all(),
            batch_invoice_tracking: db.prepare('SELECT * FROM batch_invoice_tracking LIMIT 200').all(),
            batch_payments: db.prepare('SELECT * FROM batch_payments LIMIT 200').all(),
            preauth_item_markbacks: db.prepare('SELECT * FROM preauth_item_markbacks LIMIT 200').all(),
            preauth_item_markback_items: db.prepare('SELECT * FROM preauth_item_markback_items LIMIT 200').all(),
            preauth_markbacks: db.prepare('SELECT * FROM preauth_markbacks LIMIT 200').all(),
            claim_status_acks: db.prepare('SELECT * FROM claim_status_acks LIMIT 200').all(),
        });
    });

    // POST /sim/seed/claim — insert one seeded claim.
    // Uses payload.claim_id as the row PK so markback (which addresses
    // by the payload's claim_id) can find the row later.
    app.post('/sim/seed/claim', async (req, reply) => {
        // customerid scopes which tenant's /claims/edi poll sees this claim.
        // Default '' = tenant-agnostic seed (visible to any customerid), so
        // old-style seeds without a customerid keep working.
        const { country = 'KE', customerid = '', payload } = req.body || {};
        if (!payload) return reply.status(400).send({ error: 'missing payload' });
        if (!payload.claim_id) return reply.status(400).send({ error: 'missing payload.claim_id' });
        db.prepare(`INSERT INTO seeded_claims (claim_id, payload, country, customerid) VALUES (?, ?, ?, ?)`)
          .run(payload.claim_id, JSON.stringify(payload), country, customerid || '');
        return reply.send({ claim_id: payload.claim_id, country, customerid: customerid || '' });
    });

    // POST /sim/seed/preauth — insert one seeded preauth.
    // Uses payload's Id/id as the row PK so markback can find it.
    app.post('/sim/seed/preauth', async (req, reply) => {
        // customerid scopes which tenant's /preauth/fetch sees this preauth.
        // Default '' = tenant-agnostic seed (visible to any customerid).
        const { country = 'KE', customerid = '', payload } = req.body || {};
        if (!payload) return reply.status(400).send({ error: 'missing payload' });
        const preauthId = payload.Id || payload.id;
        if (!preauthId) return reply.status(400).send({ error: 'missing payload.Id' });
        db.prepare(`INSERT INTO seeded_preauths (preauth_id, payload, country, customerid) VALUES (?, ?, ?, ?)`)
          .run(preauthId, JSON.stringify(payload), country, customerid || '');
        return reply.send({ preauth_id: preauthId, country, customerid: customerid || '' });
    });

    // POST /sim/reset — nuke every table (idempotent, dev-only).
    // Keep in sync with schema.sql: every CREATE TABLE belongs here,
    // child tables before their parents.
    app.post('/sim/reset', async (_req, reply) => {
        const tables = [
            'tokens', 'events',
            'seeded_preauths', 'seeded_claims',
            'preauth_item_markback_items', 'preauth_item_markbacks', 'preauth_markbacks',
            'claim_status_acks', 'money_movements',
            'batch_invoice_tracking', 'batch_payments', 'batch_invoices', 'batches',
            'copays', 'benefit_rules',
            'card_reprints', 'fingerprint_removals',
            'members', 'benefits', 'categories', 'schemes',
        ];
        for (const t of tables) db.prepare(`DELETE FROM ${t}`).run();
        return reply.send({ reset: true });
    });
}
