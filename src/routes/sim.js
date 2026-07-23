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
            seeded_claims: db.prepare('SELECT claim_id, status, picked_at, country FROM seeded_claims LIMIT 200').all(),
            seeded_preauths: db.prepare('SELECT preauth_id, status, picked_at, country FROM seeded_preauths LIMIT 200').all(),
        });
    });

    // POST /sim/seed/claim — insert one seeded claim.
    app.post('/sim/seed/claim', async (req, reply) => {
        const { country = 'KE', payload } = req.body || {};
        if (!payload) return reply.status(400).send({ error: 'missing payload' });
        const result = db.prepare(`INSERT INTO seeded_claims (payload, country) VALUES (?, ?)`)
                         .run(JSON.stringify(payload), country);
        return reply.send({ claim_id: result.lastInsertRowid, country });
    });

    // POST /sim/seed/preauth — insert one seeded preauth.
    app.post('/sim/seed/preauth', async (req, reply) => {
        const { country = 'KE', payload } = req.body || {};
        if (!payload) return reply.status(400).send({ error: 'missing payload' });
        const result = db.prepare(`INSERT INTO seeded_preauths (payload, country) VALUES (?, ?)`)
                         .run(JSON.stringify(payload), country);
        return reply.send({ preauth_id: result.lastInsertRowid, country });
    });

    // POST /sim/reset — nuke every table (idempotent, dev-only).
    app.post('/sim/reset', async (_req, reply) => {
        const tables = ['tokens', 'events', 'seeded_preauths', 'seeded_claims', 'money_movements',
                        'batch_invoices', 'batches', 'copays', 'members', 'benefits', 'categories', 'schemes'];
        for (const t of tables) db.prepare(`DELETE FROM ${t}`).run();
        return reply.send({ reset: true });
    });
}
